import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {scan, price, priceFor, diagnose, sessionReport} from '../skill/scripts/usage.mjs';
import {catalogueId, tierOf, newestClaude, buildRegistry, diffRegistry, saveRegistry, rollback, TASKS} from '../skill/scripts/models.mjs';
import {tune, main, USAGE} from '../skill/scripts/orchestra.mjs';
import {plan} from '../skill/scripts/pair.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-test-'));
const turn = (id, model, usage, content = []) => ({type: 'assistant', requestId: id, timestamp: '2026-10-11T10:00:00Z', message: {model, usage, content}});

test('usage counts each API request once and splits cache writes by lifetime', () => {
  const u = {input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500, cache_creation: {ephemeral_1h_input_tokens: 200}};
  const s = scan([turn('r1', 'claude-opus-5-5', u), turn('r1', 'claude-opus-5-5', u), turn('r2', 'claude-opus-5-5', u)]);
  assert.deepEqual(s.models['claude-opus-5-5'], {requests: 2, input: 20, output: 200, cacheRead: 2000, cacheWrite5m: 600, cacheWrite1h: 400});
  assert.equal(price({input: 1e6, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0}, {input: 4, output: 20}), 4);
  assert.equal(price({input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 1e6}, {input: 4, output: 20}), 8);
  assert.equal(price(s.models['claude-opus-5-5'], undefined), null);
});

test('usage finds heavy tool results and names the measured causes', () => {
  const s = scan([turn('r1', 'm', {input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 300000}, [{type: 'tool_use', id: 't1', name: 'Bash'}]),
    {type: 'user', message: {content: [{type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(30000)}]}}]);
  assert.equal(s.tools.Bash.calls, 1);
  const findings = diagnose({lead: s, agents: [{requested: 'inherit', models: {}}], rows: [{who: 'lead', cacheRead: 300000, usd: 9}], total: {usd: 10}, leadUsd: 9});
  for (const words of ['lead spent 90%', '300k cached tokens per turn', 'Bash', 'inherited']) assert.ok(findings.some(f => f.includes(words)), words);
});

test('session report reads subagent transcripts beside the session', () => {
  const dir = tmp(), file = path.join(dir, 's.jsonl'), sub = path.join(dir, 's', 'subagents');
  fs.mkdirSync(sub, {recursive: true});
  fs.writeFileSync(file, JSON.stringify(turn('a', 'claude-opus-5-5', {input_tokens: 0, output_tokens: 1000})) + '\n');
  fs.writeFileSync(path.join(sub, 'agent-x.jsonl'), JSON.stringify(turn('b', 'claude-haiku-5-5', {input_tokens: 0, output_tokens: 1000})) + '\n');
  fs.writeFileSync(path.join(sub, 'agent-x.meta.json'), JSON.stringify({description: 'scout', model: 'haiku'}));
  const r = sessionReport(file, {'claude-opus-5-5': {pricing: {input: 4, output: 20}}, 'claude-haiku-5-5': {pricing: {input: 0.1, output: 0.5}}});
  assert.equal(r.agents, 1);
  assert.equal(r.total.usd, 0.02);
  assert.equal(r.leadShare, 0.98);
});

test('model ids map to the public catalogue and newest Claude tiers are chosen by version', () => {
  assert.equal(catalogueId('claude-haiku-5-5'), 'anthropic/claude-haiku-5.5');
  assert.equal(catalogueId('gpt-6.1-sol'), 'openai/gpt-6.1-sol');
  assert.equal(catalogueId('llama3:8b'), null);
  assert.deepEqual(newestClaude({'anthropic/claude-haiku-4.5': {}, 'anthropic/claude-haiku-5.5': {}, 'anthropic/claude-opus-5': {}, 'anthropic/claude-sonnet-5.5': {}}), ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5', 'fable']);
  assert.deepEqual(['free', 'cheap', 'mid', 'strong', 'unknown'], [{output: 0}, {output: 0.5}, {output: 10}, {output: 20}, undefined].map(tierOf));
});

test('registry update keeps provider prices and overrides, marks vanished models, and rolls back', () => {
  const found = d => ({discoveredAt: `${d}T00:00:00Z`, hardware: {}, prices: {'openai/gpt-6-luna': {input: 0.1, output: 0.5, source: 'https://openrouter.ai/api/v1/models'}},
    runtimes: [{runtime: 'codex', pool: 'chatgpt', models: [{id: 'gpt-6-luna', efforts: ['low']}]}, {runtime: 'claude-code', pool: 'claude', models: [{id: 'claude-haiku-5-5'}]}]});
  const first = buildRegistry(found('2026-10-11'), {models: {'claude-haiku-5-5': {pricing: {input: 0.1, output: 0.5, source: 'https://platform.claude.com/docs/en/about-claude/pricing', checkedAt: '2026-10-11'}}, 'old-model': {id: 'old-model', runtime: 'codex'}}}, {'codex:gpt-6-luna': {note: 'mine'}});
  assert.equal(first.models['claude-haiku-5-5'].pricing.source, 'https://platform.claude.com/docs/en/about-claude/pricing');
  assert.equal(first.models['codex:gpt-6-luna'].tier, 'cheap');
  assert.equal(first.models['codex:gpt-6-luna'].note, 'mine');
  assert.equal(first.models['old-model'].available, false);
  assert.ok(diffRegistry({models: {}}, first).some(c => c.startsWith('+ codex:gpt-6-luna')));
  const dir = tmp();
  saveRegistry(dir, first);
  saveRegistry(dir, {...first, models: {}});
  assert.match(rollback(dir), /^models-\d+\.json$/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, 'models.json'), 'utf8')).models['codex:gpt-6-luna']);
  assert.throws(() => rollback(dir), /no earlier registry/);
});

test('benchmark checks accept only the right answers', () => {
  const [bug, extract, review, trace] = TASKS;
  assert.ok(bug.check('4') && !bug.check('2') && !bug.check('14'));
  assert.ok(extract.check('{"total":42,"currency":"ILS"}') && !extract.check('{"total":42.5,"currency":"ILS"}'));
  assert.ok(review.check('BLOCKING: removed the canRefund permission check') && !review.check('CLEAN'));
  assert.ok(trace.check('BLOCKING: delete subtracts points the return already took') && !trace.check('BLOCKING: points can go negative') && !trace.check('BLOCKING: no guard against negative or NaN points') && !trace.check('CLEAN'));
});

test('a failed benchmark rules a model out of the role; a pass keeps it a trial', () => {
  const config = {models: {cheap: {pricing: {source: 'x', checkedAt: '2026-10-11', input: 0.1, output: 0.5}}, mid: {pricing: {source: 'x', checkedAt: '2026-10-11', input: 2, output: 10}}}};
  const bench = [{model: 'cheap', role: 'review-code', effort: 'low', ok: true, pass: false}, {model: 'cheap', role: 'review-code', effort: 'low', ok: true, pass: true}, {model: 'mid', role: 'review-code', effort: 'low', ok: false, pass: false}];
  const r = plan({role: 'review-code', effort: 'low', config, bench, allowTrial: true, costMode: 'worker-request', now: new Date('2026-10-11T12:00:00Z')});
  assert.match(r.candidates.find(c => c.model === 'cheap').reasons.join(), /failed benchmark \(1\/2\)/);
  assert.equal(r.pick, 'mid');
});

test('tune adds only missing settings and backs up the file it changes', () => {
  const file = path.join(tmp(), 'settings.json');
  fs.writeFileSync(file, JSON.stringify({model: 'opus', env: {CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet'}}));
  assert.deepEqual(tune(file, false).changes, ['autoCompactWindow=200000']);
  const r = tune(file, true);
  assert.ok(r.applied && fs.existsSync(r.backup));
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual([after.model, after.env.CLAUDE_CODE_SUBAGENT_MODEL, after.autoCompactWindow], ['opus', 'sonnet', 200000]);
  assert.deepEqual(tune(file, true).changes, []);
});

test('streamed blocks of one request count once with their final usage, and dated ids find their price', () => {
  const s = scan([turn('r1', 'claude-haiku-4-5-20251001', {input_tokens: 5, output_tokens: 2}), turn('r1', 'claude-haiku-4-5-20251001', {input_tokens: 5, output_tokens: 500})]);
  assert.deepEqual([s.turns, s.models['claude-haiku-4-5-20251001'].output, s.models['claude-haiku-4-5-20251001'].input], [1, 500, 5]);
  assert.equal(priceFor({'claude-haiku-4-5': {pricing: {input: 1, output: 5}}}, 'claude-haiku-4-5-20251001').output, 5);
});

test('a model that comes back after going missing is available again', () => {
  const r = buildRegistry({discoveredAt: '2026-10-12T00:00:00Z', hardware: {}, prices: {}, runtimes: [{runtime: 'claude-code', pool: 'claude', models: [{id: 'claude-haiku-5-5'}]}]}, {models: {'claude-haiku-5-5': {runtime: 'claude-code', available: false}}});
  assert.equal(r.models['claude-haiku-5-5'].available, true);
});

test('help never spends: bench --help prints usage instead of running a bench', async () => {
  const seen = []; const log = console.log; console.log = s => seen.push(s);
  try { for (const argv of [['bench', '--help'], ['bench', '-h'], ['help'], []]) await main(argv); } finally { console.log = log; }
  assert.deepEqual(seen, [USAGE, USAGE, USAGE, USAGE]);
});
