import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isLive, SUPABASE_URL, SUPABASE_KEY } from './environment';

export interface Tribute {
  id: string;
  created_at: string;
  name: string;
  team: string | null;
  message: string;
  photo_paths: string[];
  video_path: string | null;
  video_link: string | null;
  video_title?: string | null;
  video_description?: string | null;
  video_priority?: number;
}

const BUCKET = 'tributes';

const supabase: SupabaseClient | null = isLive
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  : null;

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Vite serves imported demo images as local URLs; Storage paths have no leading slash.
  if (/^(https?:|data:|blob:)/.test(path)
    || path.startsWith('/') || path.startsWith('assets/') || path.startsWith('./assets/')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export function photoUrls(t: Tribute): string[] {
  return t.photo_paths.map(mediaUrl).filter((url): url is string => url !== null);
}

export async function fetchTributes(): Promise<Tribute[]> {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return (await import('../demo/data')).demoTributes();
  if (!supabase) throw new Error('Supabase configuration is missing. Sample messages are disabled.');
  const { data, error } = await supabase
    .from('tributes')
    .select('id, created_at, name, team, message, photo_paths, video_path, video_link, video_title, video_description, video_priority')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
