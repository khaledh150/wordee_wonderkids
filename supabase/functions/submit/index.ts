import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { participant_code, competition_id, subject, answers } = await req.json();
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400);
    }
    if (!Array.isArray(answers)) {
      return json({ error: "answers must be an array" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up session
    let lookupQuery = supabase
      .from("competition_sessions")
      .select("*")
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id);
    if (subject) lookupQuery = lookupQuery.eq("subject", subject);
    const { data: session, error: lookupErr } = await lookupQuery.single();

    if (lookupErr || !session) {
      return json({ error: "Invalid participant code" }, 404);
    }

    // IDEMPOTENT: if already completed, return existing official result
    if (session.status === "completed") {
      return json({
        validated_score: session.validated_score,
        time_spent_seconds: session.time_spent_seconds,
        already_submitted: true,
      });
    }

    // Must be active to submit
    if (session.status !== "active" || !session.started_at) {
      return json({ error: "Session not active" }, 400);
    }

    // Get competition state for duration + extra
    const { data: state } = await supabase
      .from("competition_state")
      .select("duration_seconds, extra_seconds")
      .eq("competition_id", competition_id)
      .limit(1)
      .single();

    const duration = state?.duration_seconds ?? 300;
    const extra = state?.extra_seconds ?? 0;
    const allowedWindow = duration + extra + 5; // 5s grace

    // Compute server elapsed time
    const now = new Date();
    const startedAt = new Date(session.started_at);
    const serverElapsed = (now.getTime() - startedAt.getTime()) / 1000;
    const clampedTime = Math.min(Math.round(serverElapsed), allowedWindow);

    // Load answer keys (service role only — never sent to client)
    const { data: keys, error: keysErr } = await supabase
      .from("answer_keys")
      .select("question_id, correct_answer")
      .eq("subject", session.subject)
      .eq("level", session.level)
      .eq("competition_id", competition_id);

    if (keysErr) {
      return json({ error: "Failed to load answer keys" }, 500);
    }

    // Build answer key map and compute validated score
    const keyMap = new Map((keys ?? []).map((k: { question_id: string; correct_answer: string }) => [k.question_id, k.correct_answer]));
    let validatedScore = 0;
    const submissionRows: Array<{
      participant_id: string;
      question_id: string;
      submitted_answer: string;
      is_correct: boolean;
    }> = [];

    for (const a of answers) {
      const correct = keyMap.get(a.question_id);
      const isCorrect = correct !== undefined && correct === a.submitted_answer;
      if (isCorrect) validatedScore++;
      submissionRows.push({
        participant_id: session.participant_id,
        question_id: a.question_id,
        submitted_answer: a.submitted_answer ?? "",
        is_correct: isCorrect,
      });
    }

    // Write official result
    const { error: updateErr } = await supabase
      .from("competition_sessions")
      .update({
        validated_score: validatedScore,
        status: "completed",
        completed_at: now.toISOString(),
        time_spent_seconds: clampedTime,
        questions_answered: answers.length,
        answers_snapshot: answers,
        updated_at: now.toISOString(),
      })
      .eq("participant_id", session.participant_id)
      .eq("status", "active");

    if (updateErr) {
      return json({ error: "Failed to save result" }, 500);
    }

    // Insert audit trail (batch)
    if (submissionRows.length > 0) {
      const { error: subErr } = await supabase.from("submissions").insert(submissionRows);
      if (subErr) {
        // Non-fatal: result is saved, audit trail failed
        console.error("Submissions insert failed:", subErr.message);
      }
    }

    return json({
      validated_score: validatedScore,
      time_spent_seconds: clampedTime,
    });
  } catch (err) {
    return json({ error: "Internal error" }, 500);
  }
});
