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
    const { participant_code, competition_id } = await req.json();
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up session
    const { data: session, error: lookupErr } = await supabase
      .from("competition_sessions")
      .select("*")
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id)
      .single();

    if (lookupErr || !session) {
      return json({ error: "Invalid participant code" }, 404);
    }

    // Get competition state for duration + extra_seconds
    const { data: state } = await supabase
      .from("competition_state")
      .select("duration_seconds, extra_seconds")
      .eq("competition_id", competition_id)
      .limit(1)
      .single();

    const duration = state?.duration_seconds ?? 300;
    const extra = state?.extra_seconds ?? 0;
    const totalSeconds = duration + extra;
    const now = new Date();

    // Already completed — return existing result (idempotent)
    if (session.status === "completed") {
      return json({
        participant_id: session.participant_id,
        name: session.name,
        school: session.school,
        country: session.country,
        level: session.level,
        subject: session.subject,
        display_id: session.display_id,
        status: "completed",
        validated_score: session.validated_score,
        time_spent_seconds: session.time_spent_seconds,
        completed: true,
      });
    }

    // Already active — this is a RECONNECT
    if (session.status === "active" && session.started_at) {
      const startedAt = new Date(session.started_at);
      const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
      const remaining = totalSeconds - elapsed;

      if (remaining <= 0) {
        // Time expired while away — finalize from last synced answers
        let validatedScore = 0;
        const answersSnapshot = session.answers_snapshot as Array<{ question_id: string; submitted_answer: string }> | null;

        if (answersSnapshot && answersSnapshot.length > 0) {
          const { data: keys, error: keysErr } = await supabase
            .from("answer_keys")
            .select("question_id, correct_answer")
            .eq("subject", session.subject)
            .eq("level", session.level)
            .eq("competition_id", competition_id);

          if (keysErr) {
            return json({ error: "Failed to load answer keys" }, 500);
          }

          const keyMap = new Map((keys ?? []).map((k: { question_id: string; correct_answer: string }) => [k.question_id, k.correct_answer]));
          for (const a of answersSnapshot) {
            if (keyMap.get(a.question_id) === a.submitted_answer) validatedScore++;
          }

          // Insert audit rows
          const submissionRows = answersSnapshot.map((a) => ({
            participant_id: session.participant_id,
            question_id: a.question_id,
            submitted_answer: a.submitted_answer,
            is_correct: keyMap.get(a.question_id) === a.submitted_answer,
          }));
          await supabase.from("submissions").insert(submissionRows);
        }

        const { error: updateErr } = await supabase
          .from("competition_sessions")
          .update({
            status: "completed",
            validated_score: validatedScore,
            time_spent_seconds: Math.min(Math.round(elapsed), totalSeconds + 5),
            completed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("participant_id", session.participant_id);

        if (updateErr) {
          return json({ error: "Failed to finalize session" }, 500);
        }

        return json({
          participant_id: session.participant_id,
          name: session.name,
          school: session.school,
          country: session.country,
          level: session.level,
          subject: session.subject,
          display_id: session.display_id,
          status: "completed",
          validated_score: validatedScore,
          time_spent_seconds: Math.min(Math.round(elapsed), totalSeconds + 5),
          completed: true,
        });
      }

      // Still has time — resume
      return json({
        participant_id: session.participant_id,
        name: session.name,
        school: session.school,
        country: session.country,
        level: session.level,
        subject: session.subject,
        display_id: session.display_id,
        started_at: session.started_at,
        server_now: now.toISOString(),
        remaining: Math.round(remaining),
        resume: true,
        questions_answered: session.questions_answered,
        provisional_score: session.provisional_score,
        answers_snapshot: session.answers_snapshot,
      });
    }

    // Fresh start — set active
    const startedAt = now.toISOString();
    await supabase
      .from("competition_sessions")
      .update({
        status: "active",
        started_at: startedAt,
        updated_at: startedAt,
      })
      .eq("participant_id", session.participant_id);

    return json({
      participant_id: session.participant_id,
      name: session.name,
      school: session.school,
      country: session.country,
      level: session.level,
      subject: session.subject,
      display_id: session.display_id,
      started_at: startedAt,
      server_now: startedAt,
      remaining: totalSeconds,
      resume: false,
    });
  } catch (err) {
    return json({ error: "Internal error" }, 500);
  }
});
