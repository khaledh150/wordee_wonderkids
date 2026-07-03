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
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, req);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIp)) {
    return json({ error: "Too many attempts. Please wait a moment." }, 429, req);
  }

  try {
    const body = await req.json();
    const { participant_code, competition_id } = body;

    if (typeof participant_code !== "string" || typeof competition_id !== "string") {
      return json({ error: "Invalid input" }, 400, req);
    }
    if (participant_code.length < 4 || participant_code.length > 10) {
      return json({ error: "Invalid code format" }, 400, req);
    }
    if (competition_id.length > 50) {
      return json({ error: "Invalid competition ID" }, 400, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sessions, error: lookupErr } = await supabase
      .from("competition_sessions")
      .select("subject, name, status")
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id);

    if (lookupErr || !sessions || sessions.length === 0) {
      return json({ error: "Invalid participant code" }, 404, req);
    }

    // Check which subjects are unlocked
    const allSubjects = [...new Set(sessions.map((s) => s.subject))];
    const { data: states } = await supabase
      .from("competition_state")
      .select("id, is_unlocked")
      .in("id", allSubjects);

    const unlockedSet = new Set(
      (states ?? []).filter((s) => s.is_unlocked).map((s) => s.id)
    );

    // Return unlocked subjects where student hasn't completed yet
    const completedSubjects = new Set(
      sessions.filter((s) => s.status === "completed").map((s) => s.subject)
    );
    const availableSubjects = allSubjects.filter(
      (s) => unlockedSet.has(s) && !completedSubjects.has(s)
    );

    if (availableSubjects.length === 0) {
      return json({ error: "No competition is currently open for you" }, 403, req);
    }

    return json({
      valid: true,
      name: sessions[0].name,
      subjects: availableSubjects,
    }, 200, req);
  } catch {
    return json({ error: "Internal error" }, 500, req);
  }
});
