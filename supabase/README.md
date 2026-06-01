# Competition System — Supabase Setup

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Copy your **Project URL** and **anon key** from Settings > API.
3. Copy your **service_role key** (keep this secret — never expose in client code).

## 2. Configure Environment

Create a `.env` file in the project root (see `.env.example`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. Run the Migration

In the Supabase dashboard:
1. Go to **SQL Editor**
2. Paste the contents of `supabase/migrations/001_competition_schema.sql`
3. Click **Run**

This creates all 4 tables, RLS policies, indexes, and seeds initial state rows.

## 4. Seed Data

### Answer Keys

Prepare a JSON file with your answer keys (see `scripts/examples/sample-answer-keys.json`):

```bash
node scripts/loadAnswerKeys.js path/to/answers.json 2026-08-finals
```

### Participant Roster

Prepare a JSON file with participants (see `scripts/examples/sample-roster.json`).
Leave `participant_code` blank to auto-generate 8-char codes:

```bash
node scripts/loadRoster.js path/to/roster.json 2026-08-finals
```

This also outputs a `*-codes.json` file with the generated codes.

### Print Code Cards

Generate printable HTML cards with QR codes (3 per row, A4):

```bash
node scripts/printCodes.js path/to/roster-codes.json https://your-app-url.vercel.app/play codes.html
```

Open `codes.html` in a browser and print.

## Tables Overview

| Table | Purpose | Client Access |
|---|---|---|
| `competition_state` | Toggle start, set level, broadcast announcements | Anon SELECT only |
| `competition_sessions` | One row per student | Authenticated SELECT only (admin/projector) |
| `answer_keys` | Correct answers per question | None (service role only) |
| `submissions` | Per-answer audit trail | None (service role only) |

## Security Model

- Students **never log in** and have **no write access** to any table.
- All student writes go through **Edge Functions** using the service role.
- `answer_keys` is invisible to all clients — only Edge Functions can read it.
- `competition_sessions` is readable only by authenticated admin/projector.
- Realtime is enabled only on `competition_sessions`.
