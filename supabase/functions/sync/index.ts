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
    const body = await req.json();
    const { participant_code, competition_id, subject } = body;
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400, req);
    }
    const answers = Array.isArray(body.answers) ? body.answers : null;
    const maxPossible = answers ? answers.length : 200;
    const provisional_score = typeof body.provisional_score === "number" ? Math.min(Math.max(0, Math.floor(body.provisional_score)), maxPossible) : 0;
    const questions_answered = typeof body.questions_answered === "number" ? Math.max(0, Math.floor(body.questions_answered)) : 0;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up session
    let lookupQuery = supabase
      .from("competition_sessions")
      .select("participant_id, status, started_at, updated_at, answers_snapshot")
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id);
    if (subject) lookupQuery = lookupQuery.eq("subject", subject);
    const { data: session, error: lookupErr } = await lookupQuery.single();

    if (lookupErr || !session) {
      return json({ error: "Invalid participant code" }, 404, req);
    }

    // Reject if not active
    if (session.status === "completed") {
      return json({ ok: true, note: "already completed" }, 200, req);
    }
    if (session.status !== "active") {
      return json({ error: "Session not active" }, 400, req);
    }

    // Rate limit: throttle rapid syncs but still allow score updates through
    if (session.answers_snapshot != null && session.updated_at) {
      const lastUpdate = new Date(session.updated_at).getTime();
      const now = Date.now();
      if (now - lastUpdate < 2_000) {
        return json({ ok: true, throttled: true }, 200, req);
      }
    }

    // Version guard: never overwrite a longer answers_snapshot with a shorter one
    const existingLen = Array.isArray(session.answers_snapshot) ? session.answers_snapshot.length : 0;
    if (answers && answers.length < existingLen) {
      return json({ ok: true, stale: true }, 200, req);
    }

    // Compute server-side time_spent
    const now = new Date();
    let timeSpent = 0;
    if (session.started_at) {
      timeSpent = Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000);
    }

    // Update session with provisional data + answers snapshot
    const { error: updateErr } = await supabase
      .from("competition_sessions")
      .update({
        provisional_score: provisional_score ?? 0,
        questions_answered: questions_answered ?? 0,
        time_spent_seconds: timeSpent,
        answers_snapshot: answers ?? null,
        last_seen_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("participant_id", session.participant_id)
      .eq("status", "active");

    if (updateErr) {
      return json({ error: "Sync failed" }, 500, req);
    }

    return json({ ok: true, time_spent_seconds: timeSpent }, 200, req);
  } catch (err) {
    return json({ error: "Internal error" }, 500, req);
  }
});
