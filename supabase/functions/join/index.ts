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
    const { participant_code, competition_id, subject, device_id, action } = await req.json();
    if (!participant_code || !competition_id) {
      return json({ error: "participant_code and competition_id required" }, 400, req);
    }

    // Handle "leave" action — student pressed "Not me?" to release the code lock
    if (action === "leave") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase
        .from("competition_sessions")
        .update({ device_id: null })
        .eq("participant_code", participant_code)
        .eq("competition_id", competition_id);
      return json({ ok: true }, 200, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up session — filter by subject if provided
    let query = supabase
      .from("competition_sessions")
      .select("*")
      .eq("participant_code", participant_code)
      .eq("competition_id", competition_id);
    if (subject) query = query.eq("subject", subject);
    const { data: session, error: lookupErr } = await query.single();

    if (lookupErr || !session) {
      return json({ error: "Invalid participant code" }, 404, req);
    }

    // ── Device lock: one code = one device at a time ──
    const incomingDevice = (typeof device_id === "string" && device_id) ? device_id : null;
    if (
      incomingDevice &&
      session.device_id &&
      session.device_id !== incomingDevice &&
      (session.status === "waiting" || session.status === "active")
    ) {
      // Safety valve: if the old device is dead (no heartbeat for 5+ min), allow takeover
      const lastSeen = session.last_seen_at ? new Date(session.last_seen_at) : null;
      const secSinceLastSeen = lastSeen
        ? (new Date().getTime() - lastSeen.getTime()) / 1000
        : 9999;
      if (secSinceLastSeen < 300) {
        return json({
          error: "This code is already active on another device. Press 'Not me?' on that device first.",
        }, 409, req);
      }
    }

    // Get competition state — check is_unlocked, started_at, duration
    const stateId = session.subject || subject || "english";
    const { data: state } = await supabase
      .from("competition_state")
      .select("is_unlocked, started_at, duration_seconds, extra_seconds")
      .eq("id", stateId)
      .single();

    if (!state?.is_unlocked) {
      return json({ error: "Competition is not open yet" }, 403, req);
    }

    const duration = state?.duration_seconds ?? 300;
    const extra = state?.extra_seconds ?? 0;
    const totalSeconds = duration + extra;
    const now = new Date();
    const competitionStarted = !!state.started_at;

    // Already completed — return existing result (idempotent)
    if (session.status === "completed") {
      // Compute rank among completed peers
      const { data: peers } = await supabase
        .from("competition_sessions")
        .select("participant_id, validated_score, time_spent_seconds")
        .eq("competition_id", competition_id)
        .eq("subject", session.subject)
        .eq("level", session.level)
        .eq("status", "completed")
        .not("validated_score", "is", null);
      let rank: number | null = null;
      if (peers) {
        const sorted = peers.sort((a: any, b: any) =>
          (b.validated_score ?? 0) - (a.validated_score ?? 0) ||
          (a.time_spent_seconds ?? 9999) - (b.time_spent_seconds ?? 9999)
        );
        rank = sorted.findIndex((p: any) => p.participant_id === session.participant_id) + 1 || null;
      }
      return json({
        participant_id: session.participant_id,
        name: session.name,
        nickname: session.nickname,
        school: session.school,
        country: session.country,
        level: session.level,
        subject: session.subject,
        display_id: session.display_id,
        photo_url: session.photo_url,
        status: "completed",
        validated_score: session.validated_score,
        time_spent_seconds: session.time_spent_seconds,
        rank,
        completed: true,
      }, 200, req);
    }

    // Already active — this is a RECONNECT
    if (session.status === "active" && session.started_at) {
      const startedAt = new Date(session.started_at);
      const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
      const remaining = totalSeconds - elapsed;

      if (remaining <= 0) {
        // Time expired while away — finalize from last synced answers
        let validatedScore = 0;
        let submissionRows: Array<{ participant_id: string; question_id: string; submitted_answer: string; is_correct: boolean }> = [];
        const answersSnapshot = session.answers_snapshot as Array<{ question_id: string; submitted_answer: string }> | null;

        if (answersSnapshot && answersSnapshot.length > 0) {
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
            const fb = await supabase
              .from("answer_keys")
              .select("question_id, correct_answer")
              .eq("subject", session.subject)
              .eq("level", session.level)
              .eq("competition_id", "default");
            if (!fb.error) keys = fb.data;
          }

          if (!keys || keys.length === 0) {
            return json({ error: "No answer keys found — contact admin" }, 500, req);
          }
          const keyMap = new Map(keys.map((k: { question_id: string; correct_answer: string }) => [k.question_id, k.correct_answer]));
          for (const a of answersSnapshot) {
            if (keyMap.get(a.question_id) === a.submitted_answer) validatedScore++;
          }

          submissionRows = answersSnapshot.map((a) => ({
            participant_id: session.participant_id,
            question_id: a.question_id,
            submitted_answer: a.submitted_answer,
            is_correct: keyMap.get(a.question_id) === a.submitted_answer,
          }));
        }

        const { data: updated } = await supabase
          .from("competition_sessions")
          .update({
            status: "completed",
            validated_score: validatedScore,
            time_spent_seconds: Math.min(Math.round(elapsed), totalSeconds + 5),
            completed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("participant_id", session.participant_id)
          .eq("status", "active")
          .select("participant_id")
          .maybeSingle();

        if (!updated) {
          const { data: latest } = await supabase
            .from("competition_sessions")
            .select("validated_score, time_spent_seconds")
            .eq("participant_id", session.participant_id)
            .single();
          return json({
            participant_id: session.participant_id,
            name: session.name, nickname: session.nickname, school: session.school,
            country: session.country, level: session.level, subject: session.subject,
            display_id: session.display_id, photo_url: session.photo_url,
            status: "completed",
            validated_score: latest?.validated_score ?? validatedScore,
            time_spent_seconds: latest?.time_spent_seconds ?? Math.min(Math.round(elapsed), totalSeconds + 5),
            completed: true,
          }, 200, req);
        }

        if (submissionRows.length > 0) {
          await supabase.from("submissions").insert(submissionRows);
        }

        return json({
          participant_id: session.participant_id,
          name: session.name,
          nickname: session.nickname,
          school: session.school,
          country: session.country,
          level: session.level,
          subject: session.subject,
          display_id: session.display_id,
          photo_url: session.photo_url,
          status: "completed",
          validated_score: validatedScore,
          time_spent_seconds: Math.min(Math.round(elapsed), totalSeconds + 5),
          completed: true,
        }, 200, req);
      }

      // Still has time — resume
      return json({
        participant_id: session.participant_id,
        name: session.name,
        nickname: session.nickname,
        school: session.school,
        country: session.country,
        level: session.level,
        subject: session.subject,
        display_id: session.display_id,
        photo_url: session.photo_url,
        started_at: session.started_at,
        server_now: now.toISOString(),
        remaining: Math.round(remaining),
        resume: true,
        questions_answered: session.questions_answered,
        provisional_score: session.provisional_score,
        answers_snapshot: session.answers_snapshot,
      }, 200, req);
    }

    // Competition not started by admin yet — put student in waiting/lobby
    if (!competitionStarted) {
      // Update status to waiting + mark last_seen + lock device
      await supabase
        .from("competition_sessions")
        .update({
          status: "waiting",
          ready: false,
          last_seen_at: now.toISOString(),
          updated_at: now.toISOString(),
          ...(incomingDevice ? { device_id: incomingDevice } : {}),
        })
        .eq("participant_id", session.participant_id)
        .in("status", ["registered", "waiting", "lobby"]);

      return json({
        participant_id: session.participant_id,
        name: session.name,
        nickname: session.nickname,
        school: session.school,
        country: session.country,
        level: session.level,
        subject: session.subject,
        display_id: session.display_id,
        photo_url: session.photo_url,
        not_started: true,
      }, 200, req);
    }

    // Competition IS started — activate the student with full duration
    const startedAt = now.toISOString();
    // Each student gets full time from when THEY start, not from admin start
    const remaining = totalSeconds;

    if (remaining <= 0) {
      return json({ error: "Competition has ended" }, 410, req);
    }

    const { data: updated, error: startErr } = await supabase
      .from("competition_sessions")
      .update({
        status: "active",
        started_at: startedAt,
        last_seen_at: startedAt,
        updated_at: startedAt,
        ...(incomingDevice ? { device_id: incomingDevice } : {}),
      })
      .eq("participant_id", session.participant_id)
      .in("status", ["registered", "waiting", "lobby"])
      .select("participant_id")
      .maybeSingle();

    if (startErr || !updated) {
      return json({ error: "Session already started" }, 409, req);
    }

    return json({
      participant_id: session.participant_id,
      name: session.name,
      nickname: session.nickname,
      school: session.school,
      country: session.country,
      level: session.level,
      subject: session.subject,
      display_id: session.display_id,
      photo_url: session.photo_url,
      started_at: startedAt,
      server_now: startedAt,
      remaining,
      resume: false,
    }, 200, req);
  } catch (err) {
    return json({ error: "Internal error" }, 500, req);
  }
});
