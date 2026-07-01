import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
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
    const { participant_code, competition_id, subject, ready } = await req.json();
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400);
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

    if (error) return json({ error: "Update failed" }, 500);
    return json({ ok: true });
  } catch {
    return json({ error: "Internal error" }, 500);
  }
});
