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

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, req);

  try {
    const { participant_code, competition_id, subject, ready } = await req.json();
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
    if (ready === true) update.ready = true;

    let query = supabase
      .from("competition_sessions")
      .update(update)
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id);
    if (subject) query = query.eq("subject", subject);
    const { error } = await query;

    if (error) return json({ error: "Update failed" }, 500, req);
    return json({ ok: true }, 200, req);
  } catch {
    return json({ error: "Internal error" }, 500, req);
  }
});
