import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = new URL('../', import.meta.url);
const planFile = new URL('.cache/admin/cleanup-plan.json', projectRoot);
const columns = 'id,created_at,name,message,photo_paths,video_path,approved,deleted_at,is_test';

export function createPlan(projectUrl, scope, rows) {
  if (!['tests', 'all'].includes(scope)) throw new Error('Scope must be tests or all.');
  if (scope === 'tests' && rows.some((row) => row.is_test !== true)) throw new Error('A non-test submission was included.');
  const sorted = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  const selection = JSON.stringify({ projectUrl, scope, rows: sorted });
  return { projectUrl, scope, rows: sorted, confirmation: createHash('sha256').update(selection).digest('hex') };
}

export function verifyPlan(saved, current, confirmation) {
  if (!confirmation || saved.confirmation !== confirmation || current.confirmation !== confirmation) {
    throw new Error('Confirmation does not match or the selected data has changed. Generate a fresh preview.');
  }
}

async function readEnvironment(file) {
  const text = await readFile(new URL(file, projectRoot), 'utf8').catch(() => '');
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return values;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Preview: node scripts/admin-cleanup.mjs --scope=tests (or --scope=all)');
    console.log('Execute saved preview: node scripts/admin-cleanup.mjs --execute --confirm=HASH');
    console.log('Requires .env.admin.local with SUPABASE_SERVICE_ROLE_KEY. Never expose this key to the browser.');
    return;
  }
  const environment = { ...await readEnvironment('.env.local'), ...await readEnvironment('.env.admin.local'), ...process.env };
  const projectUrl = (environment.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!/^https:\/\/[^/]+\.supabase\.co$/.test(projectUrl) || !key || key.startsWith('sb_publishable_')) {
    throw new Error('Provide the project URL and a server-only key in .env.admin.local. No action was taken.');
  }
  async function api(path, method = 'GET', body) {
    const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Administrator request failed (HTTP ${response.status}). Check setup and regenerate the preview.`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async function selectRows(scope, ids) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      let query = `tributes?select=${columns}&deleted_at=is.null&order=created_at.asc,id.asc&limit=500&offset=${offset}`;
      if (scope === 'tests') query += '&is_test=eq.true';
      if (ids) query += `&id=in.(${ids.join(',')})`;
      const page = await api(query);
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  if (!args.includes('--execute')) {
    const scope = args.find((arg) => arg.startsWith('--scope='))?.slice(8) ?? 'tests';
    if (!['tests', 'all'].includes(scope)) throw new Error('Scope must be tests or all.');
    const plan = createPlan(projectUrl, scope, await selectRows(scope));
    await mkdir(new URL('.cache/admin/', projectRoot), { recursive: true });
    await writeFile(planFile, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
    const attachments = plan.rows.reduce((total, row) => total + row.photo_paths.length + (row.video_path ? 1 : 0), 0);
    console.log(`Preview only: ${plan.rows.length} ${scope === 'tests' ? 'test' : 'selected'} submissions, ${attachments} attachment references.`);
    for (const row of plan.rows) console.log(`${row.id}  ${JSON.stringify(row.name)}  ${row.created_at}`);
    console.log(`Private preview: ${fileURLToPath(planFile)}`);
    if (plan.rows.length) console.log(`Confirm only after reviewing: node scripts/admin-cleanup.mjs --execute --confirm=${plan.confirmation}`);
    return;
  }
  const saved = JSON.parse(await readFile(planFile, 'utf8'));
  if (saved.projectUrl !== projectUrl) throw new Error('The preview belongs to another project.');
  if (!Array.isArray(saved.rows) || saved.rows.length === 0) throw new Error('The preview contains no submissions.');
  if (saved.rows.some((row) => !/^[0-9a-f-]{36}$/i.test(row.id))) throw new Error('Invalid preview IDs.');
  const currentRows = [];
  for (let index = 0; index < saved.rows.length; index += 100) {
    currentRows.push(...await selectRows(saved.scope, saved.rows.slice(index, index + 100).map((row) => row.id)));
  }
  verifyPlan(saved, createPlan(projectUrl, saved.scope, currentRows), args.find((arg) => arg.startsWith('--confirm='))?.slice(10));
  let withdrawn = 0;
  try {
    for (const row of saved.rows) {
      // UPDATE triggers preserve media manifests. Never TRUNCATE or delete batch records.
      const testFilter = saved.scope === 'tests' ? '&is_test=eq.true' : '';
      const updated = await api(`tributes?id=eq.${row.id}&deleted_at=is.null${testFilter}&select=id`, 'PATCH', { approved: false, deleted_at: new Date().toISOString() });
      withdrawn += updated.length;
    }
  } catch (error) {
    throw new Error(`${withdrawn} submissions withdrawn before interruption. Generate a fresh preview for the remainder. ${error.message}`);
  }
  console.log(`${withdrawn} submissions withdrawn. Attachment cleanup is queued; check the scheduled cleanup job before treating storage as cleared.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
