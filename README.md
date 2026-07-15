# HoloVault

Premium, franchise-agnostic TCG **pack opening** experience — nostalgia, collection, global scarcity, and skill-based coins.

> Branding is intentionally **not** tied to a single franchise. Card data is loaded from the [Pokémon TCG API](https://docs.pokemontcg.io/) so the engine can later support other games without renaming the product.

## Features

- **Landing** — full-screen particles, floating holographic cards, live rare feed
- **Pack opening** — drop → zoom → wiggle → drag-to-tear foil → slide cards → flip (rarest last) → confetti / shake for ultra+
- **Global scarcity** — every pull decrements world supply and lowers future odds
- **Collection binder** — page flips, silhouettes, glow holos, detail modal
- **Marketplace** — trending, scarce, recent pulls, Chart.js analytics
- **Mini-games** — memory, reaction, trivia, puzzle, guess, spot, skill wheel, treasure (coins only — no gambling)
- **Daily rewards & achievements**
- **Leaderboards** — packs, score, rares, completion %, lucky pulls
- **Auth** — simple email/password (JWT cookie)
- **PWA** — manifest + installable shell
- **Stack** — Next.js, TypeScript, Tailwind CSS, Framer Motion, Prisma, SQLite, in-memory cache (Redis-ready)

## Quick start

```bash
cd holovault
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo account

- Email: `demo@holovault.app`
- Password: `demo1234`

First API hit seeds expansions/cards (live TCG API when reachable, curated fallback otherwise) and the demo user.

### Auth

- **Bot check** — Pikachu quiz (4 options) before login / register / guest
- **Play as guest** — random `Guest_xxxxxx` trainer, no email
- Demo: `demo@holovault.app` / `demo1234` (still needs bot check)

### Deploy on Railway (yes, it works)

1. Push this repo to GitHub  
2. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**  
3. Select the `holovault` repo  
4. Set variables:

| Variable | Value |
|----------|--------|
| `JWT_SECRET` | long random string |
| `DATABASE_URL` | `file:/data/holovault.db` (Docker default) |
| `POKEMONTCG_API_KEY` | optional, higher TCG API rate limits |

5. **Volume (recommended):** Settings → Volumes → mount path `/data` so SQLite persists across redeploys  
6. Generate a public domain: Settings → Networking → Generate Domain  

`railway.toml` uses the **Dockerfile**. First boot runs `prisma db push` then `next start`.

**Alternative:** Railway Postgres plugin  
- Add PostgreSQL service, set `DATABASE_URL` to the Postgres URL  
- Change `provider = "postgresql"` in `prisma/schema.prisma` and redeploy  
- Better for multi-instance / no volume  

Local SQLite stays as `file:./dev.db` in `.env`.

### Optional env

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me"
POKEMONTCG_API_KEY=""   # optional — higher rate limits
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npx prisma studio` | Browse DB |

## Architecture notes

- **Pack engine** (`src/lib/pack-engine.ts`) — scarcity-weighted rarity pulls, rare+ slot, reveal order
- **TCG client** (`src/lib/tcg-api.ts`) — cached fetches + offline fallbacks
- **Cache** (`src/lib/cache.ts`) — in-process TTL cache; swap for Redis in production
- Coins are earned via **games only** — packs are not real-money loot boxes

## Roadmap hooks

Friends, trading, chat, GIF share, collection heatmap, and multi-TCG adapters are scaffolded in the product vision; core loops above ship ready to extend.

## License

Private project — use card APIs in accordance with their terms. Do not use official franchise logos or product names in shipping branding without rights.
