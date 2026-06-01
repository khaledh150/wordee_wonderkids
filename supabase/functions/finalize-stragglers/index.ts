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
    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization required" }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { competition_id, subject, level } = await req.json();
    if (!competition_id || !subject) {
      return json({ error: "competition_id and subject required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get competition state for duration + extra
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

    // Find all active sessions that are past their time window
    let query = supabase
      .from("competition_sessions")
      .select("*")
      .eq("competition_id", competition_id)
      .eq("subject", subject)
      .eq("status", "active")
      .not("started_at", "is", null);

    if (level != null) {
      query = query.eq("level", level);
    }

    const { data: stragglers, error: queryErr } = await query;

    if (queryErr) {
      return json({ error: "Failed to query sessions" }, 500);
    }

    if (!stragglers || stragglers.length === 0) {
      return json({ finalized: 0, message: "No stragglers found" });
    }

    // Load all answer keys for this subject (and optionally level)
    let keysQuery = supabase
      .from("answer_keys")
      .select("question_id, correct_answer, level")
      .eq("subject", subject)
      .eq("competition_id", competition_id);

    if (level != null) {
      keysQuery = keysQuery.eq("level", level);
    }

    const { data: allKeys } = await keysQuery;

    // Group keys by level
    const keysByLevel = new Map<number, Map<string, string>>();
    for (const k of allKeys ?? []) {
      if (!keysByLevel.has(k.level)) keysByLevel.set(k.level, new Map());
      keysByLevel.get(k.level)!.set(k.question_id, k.correct_answer);
    }

    // Process stragglers in parallel
    const eligible = stragglers.filter(session => {
      const elapsed = (now.getTime() - new Date(session.started_at).getTime()) / 1000;
      return elapsed > totalSeconds;
    });

    if (eligible.length === 0) {
      return json({ finalized: 0, message: "No stragglers past time window" });
    }

    const tasks = eligible.map(async (session) => {
      const elapsed = (now.getTime() - new Date(session.started_at).getTime()) / 1000;
      const keyMap = keysByLevel.get(session.level) ?? new Map();
      let validatedScore = 0;
      const answersSnapshot = session.answers_snapshot as Array<{ question_id: string; submitted_answer: string }> | null;
      const submissionRows: Array<{
        participant_id: string;
        question_id: string;
        submitted_answer: string;
        is_correct: boolean;
      }> = [];

      if (answersSnapshot && answersSnapshot.length > 0) {
        for (const a of answersSnapshot) {
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
      }

      await supabase
        .from("competition_sessions")
        .update({
          status: "completed",
          validated_score: validatedScore,
          time_spent_seconds: Math.min(Math.round(elapsed), totalSeconds + 5),
          completed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("participant_id", session.participant_id);

      if (submissionRows.length > 0) {
        await supabase.from("submissions").insert(submissionRows);
      }

      return {
        name: session.name,
        display_id: session.display_id,
        validated_score: validatedScore,
      };
    });

    const results = await Promise.all(tasks);
    return json({ finalized: results.length, results });
  } catch (err) {
    return json({ error: "Internal error" }, 500);
  }
});
