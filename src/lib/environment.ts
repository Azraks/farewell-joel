export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Demo content is opt-in and never substitutes for a failed live connection. */
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
export const isTestSubmission = import.meta.env.VITE_TEST_SUBMISSIONS === 'true';
export const isLive = !isDemo && Boolean(
  SUPABASE_URL && SUPABASE_KEY
  && !SUPABASE_URL.includes('YOUR-') && !SUPABASE_KEY.includes('YOUR-'),
);
