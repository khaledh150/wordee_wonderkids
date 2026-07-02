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

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIp)) {
    return json({ error: "Too many attempts. Please wait a moment." }, 429);
  }

  try {
    const body = await req.json();
    const { participant_code, competition_id } = body;

    if (typeof participant_code !== "string" || typeof competition_id !== "string") {
      return json({ error: "Invalid input" }, 400);
    }
    if (participant_code.length < 4 || participant_code.length > 10) {
      return json({ error: "Invalid code format" }, 400);
    }
    if (competition_id.length > 50) {
      return json({ error: "Invalid competition ID" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sessions, error: lookupErr } = await supabase
      .from("competition_sessions")
      .select("subject, name")
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id);

    if (lookupErr || !sessions || sessions.length === 0) {
      return json({ error: "Invalid participant code" }, 404);
    }

    // Check which subjects are unlocked
    const allSubjects = sessions.map((s) => s.subject);
    const { data: states } = await supabase
      .from("competition_state")
      .select("id, is_unlocked")
      .in("id", allSubjects);

    const unlockedSet = new Set(
      (states ?? []).filter((s) => s.is_unlocked).map((s) => s.id)
    );
    const availableSubjects = allSubjects.filter((s) => unlockedSet.has(s));

    if (availableSubjects.length === 0) {
      return json({ error: "No competition is currently open for you" }, 403);
    }

    return json({
      valid: true,
      name: sessions[0].name,
      subjects: availableSubjects,
    });
  } catch {
    return json({ error: "Internal error" }, 500);
  }
});
