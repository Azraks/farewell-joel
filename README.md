# Farewell site for Joel

A public farewell page for sharing messages, photos and short videos. GitHub Pages
hosts the website; Supabase stores submissions and media. Visitors do not need an
account. Submissions appear immediately, and each submission gets a private deletion link.

## Features

The hero photo viewer includes the full built-in collection. Messages and photos
appear on the tribute wall; videos have a separate gallery. The slideshow presents
one contributor at a time, with scrollable text, stacked photos and video playback.

The constellation displays every submission with a message or photo as a star
around Joel’s bright centre star. Positions are randomised on each page load;
hover to see a contributor’s name, or click or tap to open their tribute. Video-only
submissions appear in the video gallery. Constellation lines do not represent
reporting relationships.

Uploads support up to four photos (source ≤20 MiB, compressed JPEG ≤5 MiB each),
plus one video (MP4/MOV/WebM ≤20 MiB) or an HTTPS video link. Video transcoding
is not provided.

## Development

Use Node 22.18 or later. CI uses Node 22; dependencies are pinned in `package-lock.json`.

```sh
npm ci --ignore-scripts --cache .cache/npm
```

Create `.env.local` in the project root:

```dotenv
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Use a publishable / anon key only. Never put a service-role key in a `VITE_*` variable
or commit local environment files.

```sh
npm run dev      # Start the development server
npm run check    # Check frontend and Edge Function types
npm run build    # Create the production site in dist/
npm run preview  # Preview the production build
```

Optional local settings:

- `VITE_DEMO_MODE=true` shows fictional content and simulates submissions and deletion.
- `VITE_TEST_SUBMISSIONS=true` marks real trial submissions for selective cleanup.

Restart the development server after changing environment variables. The deployment
workflow disables both settings.

## Project layout

| Location | Purpose |
| --- | --- |
| `index.html` | Page structure and dialog markup |
| `src/main.ts` | Page startup and feature coordination |
| `src/config.ts` | Names, page copy, dates and Mission Log entries |
| `src/assets/hero/` | Built-in photos for the hero rotation and photo viewer |
| `src/features/` | Page content, photo viewer, tribute wall, video gallery and submission form |
| `src/effects/` | Hero rotation, starfield, constellation, slideshow and animation helpers |
| `src/lib/` | Data access, uploads, deletion, media handling and shared utilities |
| `src/demo/` | Fictional content and sample media for demo mode |
| `src/styles/main.css` | Page, component and responsive styles |
| `supabase/functions/tribute-api/` | Edge Function for submissions, deletion and media cleanup |
| `supabase/video-only-submissions.sql` | Database migration allowing video-only submissions |
| `scripts/admin-cleanup.mjs` | Administrative cleanup utility with a preview by default |
| `.github/workflows/deploy.yml` | GitHub Pages build and deployment |
| `vite.config.ts` | Build settings, asset handling and deployment base path |
| `tsconfig.json` | Frontend TypeScript settings |
| `package.json` / `package-lock.json` | Commands, dependencies and locked versions |
