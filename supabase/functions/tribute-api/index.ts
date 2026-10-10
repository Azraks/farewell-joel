import { createBackend } from './backend.ts';
import { createHandler } from './handler.ts';

const projectUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins = (Deno.env.get('SITE_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
const cleanupSecret = Deno.env.get('CLEANUP_SECRET') ?? '';

Deno.serve(createHandler(createBackend(projectUrl, serviceKey), origins, cleanupSecret));
