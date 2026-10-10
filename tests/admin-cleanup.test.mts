import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, verifyPlan } from '../scripts/admin-cleanup.mjs';
import { validateMessage } from '../supabase/functions/tribute-api/domain.ts';

const row = { id: 'test-1', name: 'Test colleague', is_test: true, photo_paths: [], video_path: null };
test('test-only preview refuses real submissions', () => {
  assert.throws(() => createPlan('https://project.supabase.co', 'tests', [{ ...row, is_test: false }]));
  assert.equal(createPlan('https://project.supabase.co', 'tests', [row]).rows.length, 1);
});
test('execution needs exact preview confirmation and unchanged selected records', () => {
  const plan = createPlan('https://project.supabase.co', 'tests', [row]);
  assert.throws(() => verifyPlan(plan, plan, undefined));
  assert.throws(() => verifyPlan(plan, plan, 'wrong'));
  assert.doesNotThrow(() => verifyPlan(plan, plan, plan.confirmation));
  const edited = createPlan(plan.projectUrl, 'tests', [{ ...row, name: 'Changed colleague' }]);
  assert.throws(() => verifyPlan(plan, edited, plan.confirmation));
  const missing = createPlan(plan.projectUrl, 'tests', []);
  assert.throws(() => verifyPlan(plan, missing, plan.confirmation));
});
test('test flag requires explicit boolean true and defaults to real', () => {
  const message = { name: 'Colleague', message: 'Thanks!' };
  assert.equal(validateMessage(message).is_test, false);
  assert.equal(validateMessage({ ...message, is_test: 'true' }).is_test, false);
  assert.equal(validateMessage({ ...message, is_test: true }).is_test, true);
});
