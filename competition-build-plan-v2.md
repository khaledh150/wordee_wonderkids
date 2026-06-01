# Competition System — Full Build Plan v2 (Vite + Supabase Free Tier)

**Target:** up to ~500 students per subject (built with headroom for more), one physical venue, mostly one shared WiFi, free Supabase tier. English app first, then copied into Math.

**This v2 folds in the full code review** (skip monorepo, add operational must-haves, longer codes, earlier load test, etc.) **plus the requested features**: per-student question randomization, haptic timer warnings (no sound), branded projector waiting screen with QR, country flag badges, QR-code join, and PDF certificate generation.

---

## Stack note (important)

- Your existing apps are **plain Vite + React + JavaScript (JSX)** — not TypeScript. All app-side prompts below are written for **JS/JSX** to match. Don't let Claude Code "upgrade" you to TS mid-build.
- **Edge Functions are Deno + TypeScript** — that's the normal, standard way to write them and is a separate codebase from your apps, so it doesn't affect your app stack.
- **No monorepo.** You build everything inside the **existing English app** as new routes (`/admin`, `/projector`, `/play`). One Supabase project serves both apps. When English is proven, you copy the competition files into the Math app.

---

## Locked decisions (the foundation everything rests on)

1. **Students never use Supabase Realtime and never log in.** Free tier caps ~200 concurrent Realtime connections, and 500 devices on one WiFi share one public IP (which would trip Supabase's per-IP auth limit if they all signed in). So students **poll** one tiny state row and **write only through Edge Functions** authorized by a participant code. Only the **Admin** and **Projector** screens log in and use Realtime — 2 connections total.

2. **Two scores.** `provisional_score` (device-reported, drives the exciting live board) and `validated_score` (computed **server-side** against an answer key the device never sees — the **official** trophy number). This is your anti-sabotage layer.

3. **Server is the timekeeper.** A browser timer can't be made tamper-proof, so the device shows MM:SS only for the kid; the server stamps `started_at` and enforces the real window on submit.

4. **`sync` carries the full answers array, not just the score.** Tiny payload, but it means the server always holds a near-complete answer set — so a student who closes their tab and vanishes can still be finalized. This is the backbone of reconnection + no-show resilience.

5. **Images AND audio are served from Vercel** (`public/` folder → Vercel CDN automatically). Keeps all that bandwidth off Supabase's limited free egress, and Vercel caches so the 2nd–500th kid gets cache hits.

---

## Architecture at a glance

```
Student device (no login, no realtime, JS/JSX, potato-phone friendly)
   ├─ polls   competition_state          (anon SELECT, 1 row, every ~4s + jitter)
   │            └─ reads is_unlocked, active_level, extra_seconds, announcement
   ├─ preloads ~70 WebP images + ~70 audio clips  (from Vercel CDN, concurrency-capped)
   ├─ calls   fn:join     (claims code, gets started_at + remaining time -> supports RESUME)
   ├─ calls   fn:sync     every ~60s  (provisional score + FULL answers array)
   └─ calls   fn:submit   at the end  (final flush -> SERVER validates -> official score)

Edge Functions (service role — the ONLY writer of student rows)
   ├─ join    -> claim/resume session, stamp started_at, return remaining seconds
   ├─ sync    -> rate-limited; store provisional score + answers; compute server time
   ├─ submit  -> recompute score vs answer_keys, clamp to server window, write official
   └─ finalize-stragglers (admin-triggered) -> finalize no-shows from last synced answers

Admin dashboard (you log in; Realtime)
   ├─ start toggle + level + round label + announcement broadcast
   ├─ readiness count ("X / N ready") + who's not ready
   ├─ live leaderboard (per-level filter)
   ├─ PAUSE / EXTEND time, RESET round, finalize stragglers
   ├─ official results (validated) + print + CSV export
   └─ ONE realtime channel

Projector (logs in; Realtime)
   ├─ branded WAITING screen (event name, sponsor logos, QR to app URL)
   ├─ live F1 board: Top 20 + flags, per-level (auto-rotate or admin-set)
   └─ podium reveal on validated_score
```

---

## Rough timeline

These are working-day estimates with Claude Code doing the heavy lifting; pad them.

| Phase | What | Est. |
|---|---|---|
| 0 | Supabase schema + security + seed | 1 day |
| 1 | Edge Functions | 1–2 days |
| 1.5 | Early load test of functions | 0.5 day |
| 2 | Admin dashboard | 1–2 days |
| 3 | Competition engine | 1–2 days |
| 4 | Waiting room + preloader | 1 day |
| 4.5 | Practice / warm-up round | 0.5 day |
| 5 | English game UI | 1–2 days |
| 6 | Projector | 1–2 days |
| 7 | Certificates | 0.5–1 day |
| 8 | Full load test + hardening + Math copy | 1–2 days |

Front-load Phases 0–1.5: if the server can't take the load, you want to know before building any UI.

---

## PHASE 0 — Supabase foundation (schema + security + seed)

**Goal:** One Supabase project with the schema, locked-down security, and seed scripts. No UI yet.

**Run inside your existing English app repo (it already deploys to Vercel):**

```text
Phase 0: Supabase foundation for a live, venue-based competition. App is plain Vite + React + JavaScript (do NOT convert to TypeScript). Add a Supabase client and SQL migrations. No monorepo — competition lives in this app as new routes later.

SCHEMA (write as SQL migrations):
1. competition_state:
   id text primary key,                 -- 'english' | 'math'
   competition_id text not null,         -- e.g. '2026-08-08-finals' to separate events/rounds
   is_unlocked boolean default false,
   active_level int,                     -- null = all
   round_label text,
   duration_seconds int default 300,     -- the 5 minutes
   extra_seconds int default 0,          -- admin can bump this to EXTEND time live
   announcement text,                    -- broadcast to waiting rooms
   updated_at timestamptz default now()

2. competition_sessions:
   participant_id uuid primary key default gen_random_uuid(),
   competition_id text not null,
   participant_code text not null,       -- 8+ char random alphanumeric (NOT 001..500)
   display_id text,                      -- shown on trophy list
   name text, school text, country text, -- country = ISO code (e.g. 'fr') for flag images
   subject text, level int,
   status text default 'waiting',        -- waiting|active|completed
   provisional_score int default 0,
   validated_score int,                  -- official, null until finalized
   questions_answered int default 0,
   time_spent_seconds int default 0,
   ready boolean default false,
   started_at timestamptz, completed_at timestamptz,
   updated_at timestamptz default now(),
   unique (participant_code, competition_id)   -- codes can be reused across events safely

3. answer_keys:
   question_id text, subject text, level int, correct_answer text, competition_id text,
   primary key (question_id, competition_id)
   -- NEVER readable by any client

4. submissions (audit trail for disputes):
   id bigint generated always as identity primary key,
   participant_id uuid references competition_sessions(participant_id),
   question_id text, submitted_answer text, is_correct boolean,
   created_at timestamptz default now()

SECURITY (get this exactly right):
- Enable RLS on every table.
- competition_state: anon SELECT only. UPDATE only for the authenticated admin user.
- competition_sessions: NO anon insert/update/delete. SELECT only for authenticated admin/projector (live board reads here). ALL student writes go exclusively through Edge Functions (service role).
- answer_keys: revoke ALL access from anon and authenticated. Only service role (inside functions) reads it.
- submissions: no client access; functions write only.
- Index competition_sessions (competition_id, subject, level, status, validated_score desc, time_spent_seconds asc) and a second index on provisional_score desc for the live board.
- Enable Realtime ONLY on competition_sessions.

SEED SCRIPTS:
- loadAnswerKeys: import (question_id, subject, level, correct_answer, competition_id) from CSV/JSON.
- loadRoster: bulk pre-create competition_sessions from a roster (participant_code [generate 8-char random if blank], display_id, name, school, country, subject, level, competition_id) so EVERYONE is registered before event day — zero signup traffic on the day.
- A helper that prints each participant's code + a QR-ready app URL for sticker printing.

Deliver: migrations, seed scripts, typed-ish JS Supabase client, and a README (how to run migrations + seed).
```

---

## PHASE 1 — Edge Functions (server brain + anti-cheat + resume)

**Goal:** The only path that writes student data. Server validation and reconnection logic live here.

**Run from the repo:**

```text
Phase 1: Supabase Edge Functions (Deno + TypeScript). Four functions, all service-role, all keyed by participant_code + competition_id. Provide curl examples in a README so I can test BEFORE any UI exists.

1. join:
   Input { participant_code, competition_id }
   - Look up session; reject if not found.
   - If status='completed', return existing official result (a refresh/reopen can't restart).
   - If status='active' and started_at set: this is a RECONNECT. Compute remaining = (duration_seconds + extra_seconds) - (now - started_at). If remaining > 0 return { resume:true, remaining, ... }. If <= 0, finalize now from last synced answers and return the result.
   - Else: set status='active', started_at=now(). Return { participant_id, name, level, subject, school, country, started_at, server_now, remaining }.

2. sync:
   Input { participant_code, competition_id, provisional_score, questions_answered, answers:[{question_id, submitted_answer}] }
   - Validate code. Reject if completed.
   - RATE LIMIT: if now - updated_at < 25s, accept-but-ignore (return ok, do nothing) to absorb retries cheaply.
   - Store provisional_score, questions_answered, the latest answers array (overwrite — it's cumulative), time_spent_seconds = now - started_at (server-computed). This feeds the live board AND acts as the recovery snapshot.

3. submit (authoritative):
   Input { participant_code, competition_id, answers:[{question_id, submitted_answer}] }
   - Validate code. If already completed, return existing official result (IDEMPOTENT — safe to retry).
   - Load answer_keys for this subject+level+competition_id via service role (never sent to client).
   - Recompute score = count of answers whose submitted_answer matches correct_answer. This server number is official.
   - server_elapsed = now - started_at. Allowed window = duration_seconds + extra_seconds + 5s grace. If exceeded, still finalize but clamp time_spent_seconds to the window.
   - Write validated_score, status='completed', completed_at=now(). Insert per-answer rows into submissions (audit).
   - Return { validated_score, time_spent_seconds }.

4. finalize-stragglers (admin-only, called from dashboard):
   Input { competition_id, subject, level }
   - For every session still 'active' past its window, finalize from the last synced answers (validate against answer_keys, set completed). This rescues students who closed their tab / lost WiFi and never came back, so the podium can complete.

GENERAL:
- verify_jwt false (students aren't logged in) but a valid participant_code is required; never leak answer_keys or other students' rows.
- All functions return clear JSON. Defensive against duplicate/rapid calls.
```

---

## PHASE 1.5 — Early load test (do this BEFORE building UI)

**Goal:** Prove the server holds before you invest in screens. Moved early per the review.

**Run from the repo:**

```text
Phase 1.5: Early load test of the Edge Functions with k6 (or Artillery) against a STAGING Supabase project.
- Simulate 600 virtual students (headroom over 500): poll competition_state ~30s, call join (with 0–3s jitter to soften cold starts), call sync every 60s for 5 min, then submit with ~70 answers (0–3s jitter).
- Report function error rate, p95 latency, and confirm zero data loss / correct validated scores.
- Note Supabase free-tier cold starts on the first burst of joins; recommend a "warm-up ping" (a cheap scheduled call a minute before start) if the first batch is slow.
- Output a short results summary and any interval/jitter tuning needed.
```

---

## PHASE 2 — Admin Dashboard (`/admin` route)

**Goal:** Your control room. Start, monitor readiness, run the race, handle emergencies, export results.

```text
Phase 2: Admin Dashboard as an /admin route in the English Vite app (React + JS + Tailwind). Single cohesive page. Authenticated as the admin user (gate everything behind login). ONE Realtime channel, cleaned up on unmount.

CONTROLS:
- Large Start toggle bound to competition_state.is_unlocked, with a confirm step.
- active_level dropdown + round_label field. Show updated_at.
- ANNOUNCEMENT box: text that writes competition_state.announcement, shown in all waiting rooms (e.g. "Starting in 2 minutes", "WiFi issue, please hold").

EMERGENCY CONTROLS (critical):
- EXTEND TIME: +1 / +2 / +5 min buttons that increment competition_state.extra_seconds. This gives every active student more time at once (for a WiFi outage). Show current extra.
- RESET ROUND: double-confirm button that sets all sessions for this competition_id+subject back to waiting (clears scores/started_at) for a clean restart.
- FINALIZE STRAGGLERS: button calling the finalize-stragglers function so the podium can complete if someone never returns.

READINESS PANEL:
- Live "X / N ready" count (Realtime, count ready=true). List who is NOT ready (name + code) so you know when it's safe to start.

LIVE LEADERBOARD:
- Realtime table sorted by status, then provisional_score desc, then time_spent_seconds asc.
- PER-LEVEL FILTER tabs (running 4 levels at once on one list is chaos). Columns: Rank, Name, School, Display ID, Level, Score, Time, Status.

OFFICIAL RESULTS:
- Separate view using validated_score, sorted Rank 1..last, per-level filter.
- CSV EXPORT: Rank, Name, Display ID, School, Country, Level, Official Score, Time.
- PRINT: @media print block hides toggle/nav/chrome; clean high-contrast black-on-white rows (Rank, Name, Display ID, Score, Time), one per student, page-break friendly, for reading names at the trophy table.
```

---

## PHASE 3 — Competition Engine (shared hook, used by both apps)

**Goal:** The brain on each student device. Resilient on bad WiFi, light on weak phones. Includes haptics and per-student question shuffle.

```text
Phase 3: useCompetitionEngine hook (React + JS) living in src/competition/ so it can be copied to the Math app later. All logic in one cohesive file. Built to survive flaky venue WiFi on low-end devices.

1. STATE POLLING: poll competition_state every ~4s WITH random jitter to detect is_unlocked, active_level, extra_seconds, and announcement. Reads only — no realtime, no login. Stop the unlock-poll once active, but keep reading extra_seconds so live time extensions apply.

2. PER-STUDENT QUESTION ORDER: given the level's question list, shuffle it with a SEED derived from participant_id (stable across reloads — essential for resume). Neighbours get different orders so copying is useless. Answers always map back to their real question_id, so server validation is order-independent.

3. START / RESUME: on Start, call join. If it returns resume:true, restore the saved answers from localStorage and continue with `remaining` seconds. Otherwise begin a fresh DISPLAY countdown = (duration + extra) derived from server time. Treat the countdown as cosmetic; the server is the judge.

4. LOCAL ANSWER LOG: keep answers in memory + localStorage as [{question_id, submitted_answer}]. Compute provisional score locally for instant feedback.

5. OFFLINE-FIRST SYNC QUEUE: every ~60s (jittered) call sync with provisional_score + questions_answered + the full answers array. try/catch: on failure keep payload in localStorage, retry next tick, NEVER throw a UI error or block play. Expose a subtle isSyncing flag (non-blocking dot only).

6. HAPTIC TIMER WARNINGS: at 60s and 30s remaining, fire navigator.vibrate([...]) IF supported (Android). NO sound. On iOS (no vibrate API) and unsupported devices, fall back to a brief visual pulse only. Never assume vibrate exists — feature-detect.

7. AUTO-COMPLETE: when timer hits 0 OR last question answered, stop timer, clear intervals, and call submit ONCE with the full answers (add 0–3s jitter so 500 devices don't submit in the same second). Retry from localStorage until confirmed. Mark local status completed; surface returned validated_score.

8. RESILIENCE: submit/sync idempotent. On reload mid-game, restore from localStorage + the join resume path and continue. On reload after completion, show completed state — never restart.

Isolate the per-second tick so it does NOT re-render the question UI. Expose { phase, timeLeft, currentScore, questionsAnswered, orderedQuestions, recordAnswer(), finish(), isSyncing, announcement }.
```

---

## PHASE 4 — Waiting Room + Preloader + Confirmation (`/play` entry)

**Goal:** Where kids wait. Caches images + audio silently, confirms identity, reports ready, shows your announcements.

```text
Phase 4: CompetitionWaitingRoom (React + JS) in src/competition/, used as the entry of the /play route in the English app.

1. JOIN + CONFIRM: student enters participant_code. Call join's lookup, then show a CONFIRMATION screen: "You are [Name] — [School] — Level [X]. Correct?" with Confirm / Not me. Prevents wrong-code mistakes. No password, no signup.

2. LOCK STATE + ANNOUNCEMENTS: poll competition_state via the engine. While is_unlocked is false, show a calm, friendly waiting screen (their name, level, a gentle animation — not a blank "Waiting...") and display competition_state.announcement when present. When unlocked, reveal a glowing large Start button (enabled only when is_unlocked AND ready).

3. SILENT PRELOADER (low-end safe):
   - Fetch the JSON list of this level's ~70 WebP image URLs AND ~70 audio clip URLs (served from Vercel /public, NOT Supabase).
   - Preload with a CONCURRENCY CAP of ~5 at a time (never 70 parallel — that kills shared WiFi and weak phones). Images via new Image()+decode(); audio via preload. Store in Cache API where available; if Cache API is unsupported (some old Android webviews), just allow fast re-fetch from CDN on reload — do NOT crash.
   - Quiet progress bar ("Getting ready… 42/140").

4. READINESS HEARTBEAT: once assets are cached and a quick connection check passes, set ready=true (via a tiny function call). This powers the admin "X/N ready" count.

5. HANDOFF: on Start, go to the active competition view and init the engine. Natural human tapping staggers entry — no synchronized network spike.
```

---

## PHASE 4.5 — Practice / Warm-up Round (formal phase)

**Goal:** A non-scored mini-round students run on arrival. Proves their device + WiFi works, warms the cache, teaches the competition UI. Per the review, this is a must-have, not a nicety.

```text
Phase 4.5: Warm-up round in the English app.
- A "Practice" entry (separate from the real competition) with 3–5 non-scored questions using the SAME competition UI and engine, but writing nothing official (no validated score, status stays 'waiting').
- Confirms the device renders questions, plays audio, registers taps/drags, and that images+audio are cached.
- At the end: "You're ready! Wait for the host to start the real competition." Returns them to the waiting room with ready=true.
- Reuse Phase 5's components; just flag mode='practice' so the engine skips all official syncing/submitting.
```

---

## PHASE 5 — English Game UI (`/play` active view)

**Goal:** Wire the engine into your existing drag-drop / multiple-choice components, in competition mode.

```text
Phase 5: ActiveCompetitionView (React + JS) for the English app.

1. ENGINE: init useCompetitionEngine. Render questions in engine.orderedQuestions (per-student shuffled).

2. REUSE + STRIP: pull in existing Multiple-Choice (levels 1–2, pic + audio + 3 choices) and Drag-and-Drop (level 3 partial build, level 4 full build). Remove ALL Learn-mode extras: no hints, no correct/incorrect popups, no immediate feedback.

3. AUDIO AS THE PROMPT: levels 1–3 auto-play the word audio ONCE on question load (it's part of the question). Provide a single replay button (decision: one replay allowed — change if you want stricter). Use the preloaded audio so there's no delay.

4. LAYOUT (no heavy anim libs on student devices — keep the student bundle tiny):
   - Pinned "Time MM:SS" (calm; red VISUAL pulse in final 30s, plus the engine's haptic buzz on Android).
   - "Progress 12/70" bar.
   - Reserve fixed image dimensions so there is ZERO layout shift between questions.

5. FLOW: on each answer, call engine.recordAnswer({question_id, submitted_answer}) and immediately render the next question (optimistic — never wait on network).

6. FINALE: on completion (timer 0 or last question), lock the screen and show a premium "Score submitted safely ✓" overlay. Show "submitting…" briefly until submit confirms; then optionally show their own score. Disable all further input.
```

---

## PHASE 6 — Projector (`/projector` route)

**Goal:** The big screen. Branded waiting state with QR, live Top-20 racing board with flags, dramatic podium on official scores.

```text
Phase 6: ProjectorView as a /projector route, logged in as admin/projector, ONE Realtime channel. Heavy animation is fine here (one strong device).

1. BRANDED WAITING SCREEN (before is_unlocked): event name/title, sponsor logos, and a QR CODE that encodes the plain app URL (just the URL — NOT pre-filled with any student code). A short "scan to join" line. Looks like a real event, not a blank page.

2. LIVE F1 BOARD (during race): subscribe to competition_sessions filtered to active subject + current level. Sort by provisional_score desc, then time_spent_seconds asc.
   - Show TOP 20 only (500 rows is unreadable from across a hall). Big, high-contrast rows readable at distance.
   - Each row: rank, name, COUNTRY FLAG (small SVG via flag-icons from the country ISO code — do NOT use emoji flags; they render as letters on Windows), school, score.
   - Use Framer Motion (AnimatePresence + layout) so rows physically slide up/down when ranks change, like a racing grid. Subtle highlight when a student locks in (status -> completed).
   - LEVEL HANDLING: if multiple levels run at once, auto-rotate the board between levels every ~15s, or follow competition_state.active_level if the admin pins one.

3. PODIUM REVEAL: when all sessions for the shown level are completed, fade out the grid and animate in a 1st/2nd/3rd podium. RANK BY validated_score (official), not provisional. Show top-3 names, schools, flags, and official scores. Optional confetti.
```

---

## PHASE 7 — Certificates (PDF)

**Goal:** A simple auto-generated certificate per student.

```text
Phase 7: Certificate generation (client-side, jsPDF or pdf-lib, React + JS).
- After results are final, each student can download a PDF certificate: Name, Rank (official), Score, Level, School, Event name, Date. Clean branded layout.
- Also add an admin batch option: a script/route that generates all certificates for a level (loop with care — for ~500, generate on demand or in small batches, don't freeze the browser).
- Pull rank from validated_score ordering. Country flag optional on the certificate (use the same SVG source, embedded as image).
```

---

## PHASE 8 — Full load test, low-end hardening, Math rollout

```text
Phase 8: Final hardening + Math app.

1. FULL LOAD TEST: rerun the 600-student k6/Artillery sequence end to end (poll → join → sync-with-answers → submit), now including readiness calls. Confirm error rate, p95 latency, zero data loss, correct validated scores, and that EXTEND/RESET/finalize-stragglers behave under load. IMPORTANT: also test on the ACTUAL venue WiFi with as many real devices as you can — k6 tests Supabase, not the WiFi, and the WiFi is the bigger unknown for 500 devices in one room.

2. LOW-END HARDENING:
   - Confirm the STUDENT bundle is tiny — no Framer Motion or heavy libs in the play path (those live only in /projector).
   - Verify preload concurrency cap and Cache API persistence + the no-Cache-API fallback.
   - Throttle DevTools to "Slow 4G" + 4x CPU: game stays smooth, no layout shift, timer doesn't jank, audio still plays from cache, haptics fire on Android.

3. MATH APP: copy the src/competition/ folder (engine, waiting room, practice, active view shell) into the Math app. Math differs only in the question UI: 4-option multiple choice, NO learn section, NO images/audio (so even lighter — preloader is trivial). Reuse admin/projector by pointing the same Supabase project at subject='math'. Seed math answer_keys.
```

---

## Extra recommendations

**Pre-event (days before, not on the day):**
- **Pre-register everyone** via the roster script — zero signup traffic on the day.
- **Print code + QR stickers** for each desk (QR opens the app URL; the student types their own code — codes are 8+ random chars, so not guessable by neighbours).
- **Full rehearsal** on the real venue WiFi with as many cheap borrowed devices as possible. Single highest-value thing you can do.
- **Compress audio** too (Opus/AAC, small) — it's now part of the preload, so it counts toward bandwidth.
- **Warm the functions** a minute before start (one cheap ping) to dodge first-batch cold starts.

**On the day:**
- Watch the **readiness count**; only flip Start near ~all-ready.
- Keep **admin + Supabase logs** open during the race.
- If WiFi dies completely: the game keeps running locally (offline-first), answers are stored and retry when it returns; use **EXTEND TIME** to give back lost minutes; **finalize stragglers** at the end so the podium still completes. This is your full-failure fallback.

**Smoothness on weak phones:**
- Optimistic UI (advance instantly, sync in background).
- Reserved image dimensions (no layout shift).
- Isolated timer tick.
- Big tap targets; CSS transforms only on student devices.
- Non-blocking "syncing…" dot — never an error popup mid-game.

**Anti-sabotage summary (so you don't worry):**
- Trophies = `validated_score`, server-computed against a hidden answer key.
- Server-judged time window; client timer is cosmetic.
- Students can't write the DB directly — every write goes through your functions.
- Per-student shuffled question order defeats copying.
- 8+ char random codes resist guessing another student's identity.
- `submissions` table = full audit trail for any dispute.

---

## Pre-event checklist

- [ ] Everyone pre-registered (8-char codes, names, schools, countries, levels, display IDs).
- [ ] Answer keys seeded for every English level (Math later).
- [ ] Images (WebP) **and audio** compressed, in Vercel `public/`, listed per level.
- [ ] Code + QR stickers printed per desk.
- [ ] Early load test (Phase 1.5) passed — server holds at 600.
- [ ] Full load test (Phase 8) + real-device test on venue WiFi.
- [ ] Admin: start, announcement, **extend, reset, finalize-stragglers**, readiness, per-level board, print, CSV all verified.
- [ ] Projector: branded waiting screen + QR, Top-20 with **SVG flags** (tested on the actual projector laptop/OS), level rotation, podium on validated scores.
- [ ] Haptics fire on an Android device; visual pulse confirmed on an iPhone (no vibrate there).
- [ ] Practice round caches assets + confirms readiness.
- [ ] Reconnect test: close the tab mid-race, reopen, re-enter code → resumes with correct remaining time.
- [ ] Full-WiFi-drop test: kill WiFi mid-game → game continues, answers resync, submit completes (or finalize-stragglers catches it).
- [ ] Certificates generate with correct name/rank/score/event/date.

---

## Implementation Notes (watch during build)

1. **`join` must NOT re-stamp `started_at` on reconnect.** If `started_at` is already set and `status='active'`, compute remaining time from the existing `started_at` — never overwrite it. Otherwise a student who reconnects gets a fresh 5 minutes.

2. **Keep polling `extra_seconds` during the race.** The engine stops polling `is_unlocked` once active, but must continue reading `extra_seconds` at ~4s+jitter so live time extensions from the admin take effect mid-race. The display timer should adjust when `extra_seconds` increases.

3. **Use a seeded PRNG for question shuffle, not `Math.random()`.** The shuffle must be deterministic given a `participant_id` so the same student gets the same order on page reload (critical for resume). Use a simple seeded algorithm (e.g., mulberry32 or xorshift128).

4. **iOS audio auto-play requires a user gesture.** The "Start" button tap satisfies this requirement, but make sure the first question's audio auto-play fires in the same gesture chain (or after it). Preloading audio files is fine — iOS just blocks playback until a tap.

5. **Certificate batch generation for 500 students may be slow client-side.** Consider generating certificates on-demand only (student clicks "Download Certificate") rather than batch. If batch is needed, generate in small chunks with a progress bar, not all at once.

6. **Projector level auto-rotate needs smooth transitions.** Use a fade or slide (not a jarring cut) and show the current level label prominently so the audience knows which level they're watching.
```

