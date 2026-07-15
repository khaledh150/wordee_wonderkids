import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://wordee-wonderkids.vercel.app",
  "https://wordee-sigma.vercel.app",
  "https://wordee.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5177",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : getCorsHeaders(new Request("http://localhost"));
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, req);

  try {
    const { participant_code, competition_id, subject, answers } = await req.json();
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400, req);
    }
    if (!Array.isArray(answers) || answers.length > 200) {
      return json({ error: "answers must be an array (max 200)" }, 400, req);
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
      return json({ error: "Invalid participant code" }, 404, req);
    }

    // IDEMPOTENT: if already completed, return existing official result
    if (session.status === "completed") {
      let rank: number | null = null;
      try {
        const { count } = await supabase
          .from("competition_sessions")
          .select("*", { count: "exact", head: true })
          .eq("competition_id", competition_id)
          .eq("subject", session.subject)
          .eq("level", session.level)
          .eq("status", "completed")
          .gt("validated_score", session.validated_score);
        rank = (count ?? 0) + 1;
      } catch {}
      return json({
        validated_score: session.validated_score,
        time_spent_seconds: session.time_spent_seconds,
        already_submitted: true,
        rank,
      }, 200, req);
    }

    // Must be active to submit
    if (session.status !== "active" || !session.started_at) {
      return json({ error: "Session not active" }, 400, req);
    }

    // Get competition state for duration + extra
    const { data: state } = await supabase
      .from("competition_state")
      .select("duration_seconds, extra_seconds")
      .eq("id", session.subject)
      .single();

    const duration = state?.duration_seconds ?? 300;
    const extra = state?.extra_seconds ?? 0;
    const allowedWindow = duration + extra + 5; // 5s grace

    // Compute server elapsed time
    const now = new Date();
    const startedAt = new Date(session.started_at);
    const serverElapsed = (now.getTime() - startedAt.getTime()) / 1000;
    const clampedTime = Math.min(Math.round(serverElapsed), allowedWindow);

    // Reject submissions that arrive way too late (>15s past deadline)
    if (serverElapsed > allowedWindow + 15) {
      return json({ error: "Submission window has closed" }, 410, req);
    }

    // Load answer keys (service role only — never sent to client)
    // Try competition-specific keys first, fall back to 'default'
    let { data: keys, error: keysErr } = await supabase
      .from("answer_keys")
      .select("question_id, correct_answer")
      .eq("subject", session.subject)
      .eq("level", session.level)
      .eq("competition_id", competition_id);

    if (keysErr) {
      return json({ error: "Failed to load answer keys" }, 500, req);
    }

    if (!keys || keys.length === 0) {
      const fallback = await supabase
        .from("answer_keys")
        .select("question_id, correct_answer")
        .eq("subject", session.subject)
        .eq("level", session.level)
        .eq("competition_id", "default");
      if (fallback.error) {
        return json({ error: "Failed to load answer keys" }, 500, req);
      }
      keys = fallback.data;
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

    // Write official result — atomic: only updates if still 'active' (prevents double-submit)
    const { data: updated, error: updateErr } = await supabase
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
      .eq("status", "active")
      .select("participant_id")
      .maybeSingle();

    if (updateErr) {
      return json({ error: "Failed to save result" }, 500, req);
    }

    // If no row was updated, another submit already completed this session
    if (!updated) {
      const { data: latest } = await supabase
        .from("competition_sessions")
        .select("validated_score, time_spent_seconds")
        .eq("participant_id", session.participant_id)
        .single();
      return json({
        validated_score: latest?.validated_score ?? validatedScore,
        time_spent_seconds: latest?.time_spent_seconds ?? clampedTime,
        already_submitted: true,
        rank: null,
      }, 200, req);
    }

    // Insert audit trail (batch)
    if (submissionRows.length > 0) {
      const { error: subErr } = await supabase.from("submissions").insert(submissionRows);
      if (subErr) {
        // Non-fatal: result is saved, audit trail failed
        console.error("Submissions insert failed:", subErr.message);
      }
    }

    // Calculate rank among same level/subject/competition peers
    // NOTE: Known limitation — concurrent submits with the same score may receive
    // the same rank due to the COUNT-based approach. This is acceptable because rank
    // is recalculated on subsequent reads (idempotent path above) and on the results page.
    let rank: number | null = null;
    try {
      const { count } = await supabase
        .from("competition_sessions")
        .select("*", { count: "exact", head: true })
        .eq("competition_id", competition_id)
        .eq("subject", session.subject)
        .eq("level", session.level)
        .eq("status", "completed")
        .gt("validated_score", validatedScore);
      rank = (count ?? 0) + 1;
    } catch {}

    return json({
      validated_score: validatedScore,
      time_spent_seconds: clampedTime,
      rank,
    }, 200, req);
  } catch (err) {
    return json({ error: "Internal error" }, 500, req);
  }
});
