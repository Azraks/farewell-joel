# Farewell site for Joel

A public farewell page with messages, photos and short videos. GitHub Pages hosts the
website; Supabase stores submissions and media. Visitors do not need an account.
Messages appear after organiser approval, and each submission gets a private deletion link.

## Development

Use Node 22.18 or later. CI uses Node 22; dependencies are pinned in `package-lock.json`.

```sh
# Only when dependencies are missing; installs and cache stay in the project.
npm ci --ignore-scripts --cache .cache/npm
```

Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable / anon key.
Never use a service-role key in a `VITE_*` variable or commit local environment files.

```sh
npm run dev
npm run check
npm run build
```

- `VITE_DEMO_MODE=true`: fictional messages and Mission Log entries; uploads and deletions are simulated.
- `VITE_TEST_SUBMISSIONS=true`: real local trial submissions are marked for selective cleanup.
- Restart the dev server after changing environment variables. GitHub deployment forces both flags off.

## Project layout

| Location | Purpose |
| --- | --- |
| `src/main.ts` | Page startup and coordination |
| `src/config.ts` | Editable names, page text, dates and real Mission Log entries |
| `src/features/` | Content, tribute views and submission form |
| `src/effects/` | Page animations, stars, constellation and slideshow |
| `src/lib/` | Environment, data access, media, upload/deletion API and UI helpers |
| `src/demo/` | Fictional samples and images; excluded from live builds |
| `src/styles/` | Styles grouped by page section |
| `supabase/` | Schema, Edge Function and scheduled cleanup |
| `scripts/` | Function bundling and preview-first admin cleanup |

The constellation uses approved submissions. Each page load randomises star positions
and decorative connections around Joel; lines do not represent reporting relationships.
Empty real milestones hide Mission Log outside demo mode.

## Deployment and maintenance
Uploads allow four photos (source ≤20 MiB, compressed JPEG ≤5 MiB each), plus one video
(MP4/MOV/WebM ≤20 MiB) or an HTTPS video link. Media URLs are public even before approval.
No video transcoding is provided. Confirm real content and keep company information out
of both the page and uploads before sharing.
