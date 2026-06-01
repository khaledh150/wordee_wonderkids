# Competition System — Full Build Plan (Vite + Supabase Free Tier)

**Target:** up to ~500 students per subject, one physical venue, mostly one shared WiFi, free Supabase tier. English app first, then reuse for Math.

---

## Locked decisions (read this first)

These are the choices the whole plan is built on. They exist because of your exact constraints.

1. **Students never use Supabase Realtime, and never log in.**
   The free tier allows only ~200 concurrent Realtime connections, and 500 devices on one WiFi share one public IP — which would trip Supabase's per-IP auth rate limit if they all signed in at once. So:
   - Students **poll** one tiny `competition_state` row to know when you've started (a cheap read, no login).
   - Students **write** (join / sync score / submit) through **Edge Functions**, authorized by a participant code, not by Supabase Auth.
   - Only the **Admin dashboard** and the **Projector** use Realtime and a real login. That's 2 connections total — nowhere near the 200 limit.

2. **Two scores per student: provisional and validated.**
   - `provisional_score`: what the student's device reports during the race. Drives the live/exciting projector board. Doesn't matter if it's slightly gameable mid-race.
   - `validated_score`: computed **server-side** by an Edge Function against an answer key the client can never read. This is the **official** score used for trophies and the final podium. This is your anti-sabotage layer.

3. **The timer is display-only on the device; the server is the authority.**
   You cannot make a browser timer tamper-proof. So the device shows MM:SS for the kid, but the server stamps the real start time and, at submission, rejects/caps anything outside the 5-minute window.

4. **Build once, use twice (monorepo).**
   English and Math share a `competition-core` package (engine, waiting room, leaderboard, admin, Supabase types). You do **not** rebuild the competition for Math — you import it.

5. **Images are served from your frontend host's CDN, not Supabase Storage.**
   Hosting the ~70 WebP images per level on Vercel/Netlify/Cloudflare Pages (generous free bandwidth + global CDN) keeps all that traffic off Supabase's limited egress, and they get cached so the 2nd–500th kid is a cache hit.

---

## Architecture at a glance

```
Student device (potato-phone friendly, no login, no realtime)
   ├─ polls   competition_state        (anon SELECT, 1 tiny row, every ~4s + jitter)
   ├─ preloads 70 WebP images          (from frontend CDN, concurrency-limited)
   ├─ calls   fn:join                  (claims a participant code)
   ├─ calls   fn:sync     every ~60s   (provisional score, for live board)
   └─ calls   fn:submit   at the end   (full answers -> SERVER validates -> official score)

Edge Functions (service role, the only thing that writes student rows)
   ├─ join     -> creates/claims session, stamps started_at
   ├─ sync     -> updates provisional_score / progress
   └─ submit   -> recomputes score vs answer_keys, caps by server time, writes validated_score

Admin dashboard (you log in, uses Realtime)
   ├─ toggles is_unlocked
   ├─ live leaderboard + readiness count
   └─ print-clean trophy list (Rank 1..last)

Projector (one screen, logs in, uses Realtime)
   └─ F1-style live board -> podium reveal on validated scores
```

---

## PHASE 0 — Foundations: monorepo, database, security

**Goal:** A monorepo with the Supabase schema, locked-down security, and seeded answer keys. Nothing visual yet — just a solid base both apps stand on.

**Run in a fresh empty folder:**

```text
Phase 0: Monorepo + Supabase foundation for a live competition system.

Set up a pnpm monorepo (Turborepo) with this structure:
- apps/english        (Vite + React + TS)  -- existing app will move here
- apps/math           (Vite + React + TS)  -- placeholder for now
- apps/admin          (Vite + React + TS)  -- admin dashboard
- apps/projector      (Vite + React + TS)  -- venue leaderboard screen
- packages/competition-core (shared TS lib: engine, components, supabase client, types)

SUPABASE SCHEMA (write as SQL migrations):
1. competition_state:
   id text primary key,           -- 'english' | 'math'
   is_unlocked boolean default false,
   active_level int,              -- nullable; null = all levels
   round_label text,
   updated_at timestamptz default now()

2. competition_sessions:
   participant_id uuid primary key default gen_random_uuid(),
   participant_code text unique not null,  -- pre-issued code the kid types in
   display_id text,                        -- ID shown on trophy list
   name text,
   subject text, level int,
   status text default 'waiting',          -- waiting|active|completed
   provisional_score int default 0,        -- client-reported (live board)
   validated_score int,                    -- server-computed (official), null until submit
   questions_answered int default 0,
   time_spent_seconds int default 0,
   ready boolean default false,            -- images preloaded + connection ok
   started_at timestamptz, completed_at timestamptz,
   updated_at timestamptz default now()

3. answer_keys:
   question_id text primary key, subject text, level int, correct_answer text
   -- this table is NEVER readable by clients

4. submissions (audit trail for disputes):
   id bigint generated always as identity primary key,
   participant_id uuid references competition_sessions(participant_id),
   question_id text, submitted_answer text, is_correct boolean,
   created_at timestamptz default now()

SECURITY (critical — get this exactly right):
- Enable RLS on all tables.
- competition_state: allow anon SELECT only. UPDATE allowed only for an authenticated 'admin' user (policy on a specific admin uid or a custom claim).
- competition_sessions: NO direct anon INSERT/UPDATE/DELETE at all. Allow SELECT for authenticated admin/projector only (the live board reads here). All student writes happen exclusively through Edge Functions using the service role.
- answer_keys: revoke all access from anon and authenticated. Only the service role (inside Edge Functions) can read it.
- submissions: no client access; written only by Edge Functions.
- Add an index on competition_sessions (subject, level, status, validated_score desc, time_spent_seconds asc) for the leaderboard sort.

REALTIME:
- Enable Realtime only on competition_sessions (for admin + projector). Do NOT have students subscribe.

SEED:
- Provide a script that loads answer_keys from a CSV/JSON (question_id, subject, level, correct_answer) so I can paste in the real English level data later.
- Provide a script to bulk pre-create competition_sessions rows from a roster (participant_code, display_id, name, subject, level) so everyone is registered BEFORE event day (this avoids any signup traffic on the day).

Output: working migrations, seed scripts, a typed Supabase client in packages/competition-core, and a README explaining how to run migrations and seed data.
```

---

## PHASE 1 — Edge Functions (the server brain + anti-cheat)

**Goal:** Three functions that are the *only* way student data gets written. Server-side validation lives here. Test them with curl before building any UI.

**Run from the repo root:**

```text
Phase 1: Supabase Edge Functions for the competition (Deno). Three functions, all using the service role, all validating a participant_code.

1. join:
   Input: { participant_code }
   - Look up the session by participant_code. If not found, reject.
   - If status is 'completed', return the existing result (so a refresh can't restart).
   - Set status='active', started_at=now() if not already set. Return { participant_id, name, level, subject, started_at, server_now }.

2. sync:
   Input: { participant_code, provisional_score, questions_answered }
   - Validate the code. Reject if status='completed'.
   - Update provisional_score, questions_answered, time_spent_seconds (computed server-side as now - started_at), updated_at. This feeds the live projector board only.
   - Keep it lightweight and idempotent.

3. submit (the important one):
   Input: { participant_code, answers: [{ question_id, submitted_answer }], client_elapsed_seconds }
   - Validate the code. If already 'completed', return existing official result (idempotent).
   - Load answer_keys for this subject+level via service role (never sent to client).
   - Recompute the score: count answers where submitted_answer matches correct_answer. This server number is authoritative.
   - Compute server_elapsed = now - started_at. If server_elapsed > 300s + small grace (e.g. 5s), still accept but flag/clip — do not trust client_elapsed_seconds.
   - Write validated_score, status='completed', completed_at=now(), time_spent_seconds=server_elapsed (clamped to 300).
   - Insert per-answer rows into submissions for audit.
   - Return { validated_score, time_spent_seconds }.

GENERAL:
- All three: verify_jwt false (students aren't logged in) but require a valid participant_code; rate-limit per code defensively.
- Return clear JSON; never leak answer_keys or other students' data.
- Add jitter guidance in the response is not needed (client handles jitter).
- Provide curl examples for each function in a README so I can test before any UI exists.
```

---

## PHASE 2 — Admin Dashboard

**Goal:** Your control panel. You toggle start, watch readiness, watch the live board, and print the official trophy list.

**Run in `apps/admin`:**

```text
Phase 2: Admin Dashboard (Vite + React + Tailwind), authenticated as the admin user. Single cohesive page component, no over-abstraction.

1. AUTH: simple email/password login as the admin user (just you). Gate the whole dashboard behind it.

2. CONTROL: a large, obvious Start toggle bound to competition_state.is_unlocked (with a confirm step so you can't flip it by accident). A dropdown to set active_level and a round_label field. Show updated_at.

3. READINESS PANEL: show a live count "X / N students ready" by subscribing to competition_sessions via Realtime and counting ready=true. Show a small list of who is NOT ready yet (name + code) so you know when it's safe to start.

4. LIVE LEADERBOARD: Realtime table sorted by status, then provisional_score desc, then time_spent_seconds asc. Columns: Rank, Name, Display ID, Level, Score, Time, Status. Use provisional_score during the race.

5. OFFICIAL RESULTS / PRINT: a separate view that shows validated_score (the official number) sorted Rank 1..last. Add an @media print block: hide the toggle, nav, and all chrome; print clean high-contrast black-on-white rows (Rank, Name, Display ID, Score, Time) so I can read names while handing out trophies. One row per student, no truncation, page-break friendly.

6. Use exactly ONE Realtime channel for the whole dashboard. Clean it up on unmount.
```

---

## PHASE 3 — The Competition Engine (shared core)

**Goal:** The brain that runs on each student device. Built once in `competition-core`, used by English and Math. Designed to be unbreakable on bad WiFi.

**Run targeting `packages/competition-core`:**

```text
Phase 3: useCompetitionEngine hook in packages/competition-core. All logic in one cohesive file. Built to survive flaky venue WiFi on low-end devices.

Behavior:
1. STATE POLLING: poll competition_state every ~4 seconds WITH random jitter (so 500 devices don't hit at the same instant) to detect is_unlocked. Stop polling once active. Reads only — no realtime, no login.

2. START: when the student taps Start, call the join Edge Function, get started_at + server_now, and begin a 300-second DISPLAY countdown derived from server time (resync the display to server time, but treat it as cosmetic — the server is the real judge).

3. LOCAL ANSWER LOG: keep an in-memory + localStorage array of { question_id, submitted_answer }. Append on each answer. Compute a provisional score locally for instant UI feedback.

4. OFFLINE-FIRST SYNC QUEUE: every ~60s (with jitter) call the sync Edge Function with provisional_score + questions_answered. Wrap in try/catch: on failure, keep the latest payload in localStorage and retry next tick. NEVER throw a UI error or block the game. Show only a subtle, non-blocking "syncing…" dot.

5. AUTO-COMPLETE: when the timer hits 0 OR the last question is answered, stop the timer, clear intervals, and fire the submit Edge Function ONCE with the full answers array (add 0–3s random jitter before sending so 500 devices don't all submit in the same second). Retry from localStorage if it fails, until confirmed. Set local status to completed and surface the returned validated_score.

6. RESILIENCE: idempotent submit (safe to retry). If the page reloads mid-game, restore from localStorage and continue. If reloaded after completion, show the completed state, never restart.

Keep the per-second timer tick isolated so it does not re-render the question UI. Expose: { phase, timeLeft, currentScore, questionsAnswered, recordAnswer(), finish(), isSyncing }.
```

---

## PHASE 4 — Waiting Room + Image Preloader + Readiness

**Goal:** Where kids wait for you to start. Silently caches their 70 images so the race has zero loading lag, and reports "ready" to your dashboard.

**Run in `apps/english` (component goes in core where reusable):**

```text
Phase 4: CompetitionWaitingRoom for the English app (shared logic in competition-core where possible).

1. JOIN SCREEN: student enters their participant_code (and we confirm their name + level from the join lookup). No password, no signup.

2. LOCK STATE: poll competition_state (via the engine). While is_unlocked is false, show a calm "Waiting for the host to start…" screen. When true, reveal a glowing, large "Start" button.

3. SILENT PRELOADER (low-end-device safe):
   - Fetch the JSON list of ~70 WebP image URLs for this student's level (served from the frontend CDN, not Supabase).
   - Preload with a CONCURRENCY LIMIT of ~5 at a time (never 70 parallel requests — that kills shared WiFi and potato phones). Use new Image() + img.decode(); store in a Cache API / service worker cache so a page reload doesn't re-download.
   - Show a quiet progress bar ("Getting ready… 42/70").

4. READINESS HEARTBEAT: once all images are cached and a quick connection check passes, call sync (or a tiny ready flag) to set ready=true on the session. This is what powers the "X/N ready" count on the admin dashboard so the host knows when it's safe to start.

5. HANDOFF: when the student taps Start (only enabled after is_unlocked AND ready), navigate to the active competition route and initialize the engine. Natural human tapping staggers entry — no synchronized network spike.
```

---

## PHASE 5 — English Game UI

**Goal:** Wire the engine into your existing drag-and-drop / multiple-choice components, in competition (not learn) mode.

**Run in `apps/english`:**

```text
Phase 5: ActiveCompetitionView for the English app.

1. ENGINE: initialize useCompetitionEngine from competition-core.

2. REUSE + STRIP: pull in the existing Drag-and-Drop (levels 3 & 4) and Multiple-Choice (levels 1 & 2) components, but remove all Learn-mode features — no hints, no "hear the word" replays beyond the prompt, no correct/incorrect popups, no immediate feedback. Competition mode is clean and fast.

3. LAYOUT (lightweight, no heavy animation libs on student devices):
   - A pinned, calm "Time Remaining MM:SS" at top (red pulse only in the final 30s).
   - A "Progress 12/70" bar.
   - Use preloaded images with reserved fixed dimensions so there is ZERO layout shift between questions.

4. FLOW: on each submission, call engine.recordAnswer({question_id, submitted_answer}) and immediately render the next question (optimistic — never wait on the network). Advance instantly.

5. FINALE: when the engine signals completion (timer 0 or last question), lock the screen and show a premium "Score submitted safely ✓" overlay. Do not show the validated score as final until the submit function confirms (show "submitting…" briefly if needed). Disable all further input.
```

---

## PHASE 6 — Projector F1 Leaderboard

**Goal:** The big screen for the crowd. Live rank-shuffling during the race, dramatic podium at the end. This is the one place heavy animation is fine (single powerful device).

**Run in `apps/projector`:**

```text
Phase 6: ProjectorView for a large venue screen, logged in as the projector/admin user, using ONE Realtime channel.

1. DATA: subscribe to competition_sessions, filtered to the active subject + level. Sort by provisional_score desc, then time_spent_seconds asc during the race. Students appear/animate in as they join and as they complete.

2. F1 RACING MOTION: render large, highly scannable rows. Use Framer Motion (AnimatePresence + layout) so when a student's rank changes, their row physically slides up/down the grid like a live racing leaderboard. Big fonts, high contrast, readable from across a hall. Add a subtle highlight when a student locks in their final (status -> completed).

3. DRAMA (optional but recommended): a countdown moment when the host starts, and a "final 30 seconds" intensifier.

4. PODIUM REVEAL: when array.every(status === 'completed'), fade out the grid and animate in a 1st/2nd/3rd podium. IMPORTANT: the podium must rank by validated_score (the official server number), not provisional_score. Show top-3 names, display IDs, and official scores, then optionally the full ranked list.
```

---

## PHASE 7 — Load test, hardening, and Math rollout

**Goal:** Prove it holds at 500+ before the day, smooth out low-end devices, and stamp out the Math app from the shared core.

**Run from repo root:**

```text
Phase 7: Load testing + hardening + Math app.

1. LOAD TEST (k6 or Artillery): a script simulating 600 virtual students (headroom over 500) doing the REAL sequence:
   - poll competition_state for ~30s,
   - call join,
   - call sync every 60s for 5 minutes,
   - call submit with ~70 answers, with 0–3s jitter.
   Run it against a staging Supabase project. Report: function error rate, p95 latency, DB load, and confirm zero data loss. Tune jitter/intervals if anything spikes.

2. LOW-END HARDENING:
   - Confirm the student bundle is small (no Framer Motion or heavy libs in apps/english — only in projector).
   - Verify image preload concurrency cap and Cache API persistence across reload.
   - Throttle DevTools to "Slow 4G" + 4x CPU and confirm the game stays smooth, no layout shift, timer doesn't jank.

3. MATH APP: scaffold apps/math by importing competition-core (engine, waiting room, leaderboard wiring, admin/projector already shared). Only the question UI differs (4-option multiple choice, no learn section, no images = even lighter). Reuse everything else verbatim. Seed math answer_keys.
```

---

## Extra recommendations (to make it genuinely smooth + exciting)

**Pre-event (do these days before, not on the day):**
- **Pre-register every participant** with the bulk script (Phase 0) so there is zero signup traffic on event day.
- **Do a full rehearsal** with as many real, cheap devices as you can borrow, on the actual venue WiFi if possible. This is the single highest-value thing you can do.
- **Add a 60-second "warm-up" round** kids run when they arrive — it pre-caches images and verifies their connection early, well before the real start. Doubles as your readiness check.
- **Host images on the frontend CDN** (Vercel/Netlify/Cloudflare Pages), pre-compressed WebP sized to the real display dimensions. Keep them off Supabase to protect free-tier egress.

**On the day:**
- **Watch the readiness count** before flipping the switch — only start once you see ~all ready.
- Keep the **admin dashboard + Supabase logs** open during the race to spot anything early.
- The **offline queue means no answer is ever lost** even if WiFi blips — kids finish, and their submit retries until confirmed. This is your safety net; trust it instead of expecting a perfect network.

**Smoothness on potato phones:**
- Optimistic UI: advance to the next question instantly, sync in the background. The kid never waits on the network.
- Reserve image dimensions to eliminate layout shift.
- Isolate the timer so its tick doesn't re-render the question.
- Big tap targets, simple transitions (CSS transforms only on student devices).
- A tiny, non-blocking "syncing…" dot — never an error popup mid-game.

**Excitement (cheap wins):**
- Confetti + sound on the podium reveal.
- Rows briefly glow when a student locks in their final score.
- "Final 30 seconds" red pulse on the projector.
- For an international feel: show small flags or avatars next to names on the projector board.

**Anti-sabotage summary (so you don't worry):**
- Trophies are decided by `validated_score`, computed on the server against an answer key the device never sees.
- The timer is server-judged, not client-judged.
- Students can't write the database directly at all — every write goes through your Edge Functions.
- The `submissions` table is a full audit trail if anyone ever disputes a result.

---

## Pre-event checklist

- [ ] All participants pre-registered (codes + names + levels + display IDs).
- [ ] Answer keys seeded for every English level (and Math later).
- [ ] Images compressed (WebP), on the frontend CDN, listed per level.
- [ ] Load test passed at 600 simulated students, low error rate, no data loss.
- [ ] Rehearsal on real low-end devices + venue WiFi.
- [ ] Admin login works; toggle + readiness + live board + print all verified.
- [ ] Projector login works; rank motion + podium (on validated scores) verified.
- [ ] Offline/blip test: kill WiFi mid-game on a device, confirm answers resync and submit completes.
