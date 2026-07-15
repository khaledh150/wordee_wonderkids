# WonderKids App

## Supabase — FREE TIER (project: rlsuwlvzeaioanudtmxp)

This project uses Supabase **free tier**. All code, queries, and architecture decisions MUST respect these limits:

- **Edge function concurrency**: ~25 concurrent invocations
- **API rate limit**: ~500 requests/minute through REST API
- **Database connections**: ~60 via connection pooler
- **Realtime connections**: 200 concurrent
- **Database size**: 500 MB
- **Edge function timeout**: 150s max
- **Storage**: 1 GB
- **No daily backups** on free tier

### Implications
- Batch requests, never blast hundreds simultaneously
- Use jittered polling intervals to avoid thundering herd
- Keep realtime subscriptions minimal (students use HTTP polling, not realtime)
- Design for graceful degradation when rate limits are hit
- Auto-submit jitter is 15s to spread load
- Competition max tested capacity: ~200 concurrent students on free tier

## Security
- NEVER log, echo, print, or expose .env keys (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY)
- Don't ask user to run SQL manually

## Tech Stack
- React 19 + Vite + Tailwind CSS v4 (@tailwindcss/vite, @theme directive, no tailwind.config.js)
- Framer Motion + Lucide React
- Supabase (DB + Edge Functions + Auth + Realtime + Storage)
- VitePWA with workbox (registerType: autoUpdate, skipWaiting, clientsClaim, generateSW)
- Fredoka font via Google Fonts CDN
- State-based navigation in App.jsx (no React Router), hash-based history

## Versioning
- Always bump APP_VERSION in src/App.jsx AND public/version.json on every commit

## Deployment
- Hosted on Vercel, auto-deploys on git push to main
- User tests locally first before deploying
- MathWiz app (separate repo): do NOT deploy
