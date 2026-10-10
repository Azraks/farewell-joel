import { defineConfig, loadEnv } from 'vite';
import { site } from './src/config.ts';
import { escapeHtml } from './src/lib/media.ts';

// Relative base supports the repository path on GitHub Pages.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if (env.VITE_REQUIRE_LIVE === 'true') {
    const url = env.VITE_SUPABASE_URL ?? '';
    const key = env.VITE_SUPABASE_ANON_KEY ?? '';
    if (!url.startsWith('https://') || !key || url.includes('YOUR-') || key.includes('YOUR-')) {
      throw new Error('Set Supabase project URL and publishable key before publishing.');
    }
    if (env.VITE_DEMO_MODE === 'true' || env.VITE_TEST_SUBMISSIONS === 'true') {
      throw new Error('Disable demo mode and test submissions before publishing.');
    }
  }
  const title = site.metadata.title || `Thank You, ${site.honoree.fullName} — Farewell`;
  return {
    base: './',
    cacheDir: '.cache/vite',
    plugins: [{
      name: 'site-content',
      transformIndexHtml(html: string) {
        return html.replaceAll('%SITE_TITLE%', escapeHtml(title))
          .replaceAll('%SITE_DESCRIPTION%', escapeHtml(site.metadata.description));
      },
    }],
    build: { outDir: 'dist', assetsInlineLimit: 0 },
  };
});
