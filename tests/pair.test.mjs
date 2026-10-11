import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {plan, estimateCost, validateRow, tally, inspectReport} from '../skill/scripts/pair.mjs';

const now = new Date('2026-10-11T12:00:00Z');
const prices = (input, output) => ({source: 'https://example.test/provider-price', checkedAt: '2026-10-11', input, output});
const row = (model, values = {}) => ({task: 'one bounded review', role: 'review-ui', model, effort: 'medium', verified: true, candidate: 'abc123', evidence: 'lead reproduction', confirmed: 4, refuted: 0, rework: 0, ...values});
const config = {costMode: 'worker-request', models: {cheap: {pricing: prices(1, 5)}, strong: {pricing: prices(4, 20)}}};
const run = values => plan({role: 'review-ui', config, models: ['strong', 'cheap'], now, ...values});

test('no evidence does not silently approve a trial', () => {
  assert.equal(run({}).pick, null);
  const trial = run({allowTrial: true});
  assert.equal(trial.pick, 'cheap');
  assert.equal(trial.candidates[1].evidence, 'trial');
});
test('three claims from one task remain trial rather than proven', () => {
  const result = run({rows: [row('cheap', {confirmed: 3})]});
  assert.equal(result.candidates[1].evidence, 'trial');
  assert.equal(result.pick, null);
});
test('exact generation, effort and lead verification separate evidence', () => {
  const rows = [row('cheap-v1'), row('cheap', {effort: 'high'}), row('cheap', {verified: false}), row('cheap')];
  assert.equal(tally(rows, 'cheap', 'review-ui', 'medium').confirmed, 4);
  assert.equal(tally(rows, 'cheap', 'review-ui', 'high').confirmed, 4);
});
test('empty reviews cannot create claim precision evidence', () => {
  const result = run({rows: Array.from({length: 4}, () => row('cheap', {confirmed: 0}))});
  assert.equal(result.candidates[1].checked, 0);
  assert.equal(result.candidates[1].evidence, 'trial');
});
test('quality floor excludes cheap but repeatedly wrong work', () => {
  const rows = [row('cheap', {confirmed: 1, refuted: 9}), row('strong', {confirmed: 10})];
  assert.equal(run({rows, allowTrial: true}).pick, 'strong');
});
test('high-risk verdict cannot be delegated by a favorable score', () => {
  const result = run({rows: [row('cheap', {confirmed: 100})], allowTrial: true, risk: 'high'});
  assert.equal(result.pick, null);
  assert.match(result.decision, /lead retains/);
});
test('unknown cost is not assigned an invented cheap weight', () => {
  const result = run({config: {models: {cheap: {}, strong: {pricing: prices(4, 20)}}}, rows: [row('strong', {confirmed: 10})], allowTrial: true});
  assert.equal(result.pick, 'strong');
  assert.equal(result.candidates[1].cost.usd, null);
});
test('unavailable model and unsupported effort are ineligible', () => {
  assert.equal(run({allowTrial: true, config: {models: {cheap: {available: false}, strong: {efforts: ['low']}}}}).pick, null);
});
test('stale price snapshot refuses estimated budget comparison', () => {
  assert.equal(estimateCost({pricing: {...prices(1, 5), checkedAt: '2025-01-01'}}, {}, now).usd, null);
  assert.equal(run({allowTrial: true, maxTaskUsd: 0.00001}).pick, null);
  assert.equal(run({allowTrial: true, maxTaskUsd: 1, config: {models: {cheap: {}}}, models: ['cheap']}).pick, null);
});
test('Haiku long-context tier counts cache reads and writes in prompt length', () => {
  const m = {pricing: {...prices(0.1, 0.5), cacheRead: 0.01, cacheWrite: 0.125, overPromptTokens: {threshold: 100000, input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625}}};
  const low = estimateCost(m, {inputTokens: 1, outputTokens: 1, cacheReadTokens: 99999}, now);
  const high = estimateCost(m, {inputTokens: 1, outputTokens: 1, cacheReadTokens: 100000}, now);
  assert.equal(low.promptTokens, 100000);
  assert.equal(high.promptTokens, 100001);
  assert.equal(low.usd, (0.1 + 0.5 + 99999 * 0.01) / 1e6);
  assert.equal(high.usd, (0.5 + 2.5 + 100000 * 0.05) / 1e6);
});
test('anchored near-tie quality band is independent of candidate order', () => {
  const rows = [row('a', {confirmed: 20}), row('b', {confirmed: 10}), row('c', {confirmed: 5})];
  const c = {costMode: 'worker-request', models: {a: {pricing: prices(5, 25)}, b: {pricing: prices(2, 10)}, c: {pricing: prices(0.1, 0.5)}}};
  for (const models of [['a', 'b', 'c'], ['c', 'a', 'b'], ['b', 'c', 'a']]) {
    assert.equal(run({models, rows, config: c, allowTrial: true}).pick, 'b');
  }
});
test('invalid outcomes and malformed costs fail before logging', () => {
  assert.throws(() => validateRow(row('cheap', {verified: false}), true), /verified/);
  assert.throws(() => validateRow(row('cheap', {confirmed: -1}), true), /confirmed/);
  assert.throws(() => validateRow(row('cheap', {cost: {basis: 'actual', workerUsd: 1}}), true), /source/);
  assert.throws(() => run({effort: 'not an effort'}), /effort/);
  assert.throws(() => run({maxTaskUsd: NaN}), /maxTaskUsd/);
});
test('verified missed defects lower eligibility instead of only appearing in statistics', () => {
  const rows = Array.from({length: 3}, () => row('cheap', {confirmed: 4, missed: 100}));
  assert.equal(run({rows, models: ['cheap']}).pick, null);
  assert.ok(run({rows, models: ['cheap']}).candidates[0].score < 0.6);
});
test('complete-task routing includes verification and refuses mixed accounting bases', () => {
  const costs = (workerUsd, verificationUsd, basis = 'actual') => ({basis, workerUsd, verificationUsd, source: 'invoice fixture'});
  const rows = Array.from({length: 3}, () => [row('cheap', {cost: costs(0.01, 10)}), row('strong', {cost: costs(0.1, 0.1)})]).flat();
  assert.equal(run({rows, costMode: 'complete-task'}).pick, 'strong');
  const mixed = rows.map(r => r.model === 'strong' ? {...r, cost: {...r.cost, basis: 'api-equivalent'}} : r);
  assert.match(run({rows: mixed, costMode: 'complete-task'}).decision, /comparable cost unavailable/);
  assert.equal(run({rows, costMode: 'worker-request'}).pick, 'cheap');
  assert.match(run({rows, costMode: 'worker-request'}).decision, /verification and rework excluded/);
});
test('task budget uses the selected complete-task costs instead of a cheap worker request', () => {
  const rows = Array.from({length: 3}, () => row('cheap', {cost: {basis: 'actual', workerUsd: 0.01, verificationUsd: 10, source: 'invoice fixture'}}));
  const input = {rows, models: ['cheap'], maxTaskUsd: 1};
  const complete = run({...input, costMode: 'complete-task'});
  assert.equal(complete.pick, null);
  assert.equal(complete.candidates[0].budgetCost.usd, 10.01);
  assert.equal(run({...input, costMode: 'quality'}).pick, null);
  const worker = run({...input, costMode: 'worker-request'});
  assert.equal(worker.pick, 'cheap');
  assert.match(worker.budgetBasis, /verification\/rework excluded/);
});
test('configured custom runtime effort is accepted without a global-model assumption', () => {
  const custom = {models: {cheap: {efforts: ['minimal']}}};
  assert.equal(run({models: ['cheap'], config: custom, effort: 'minimal', allowTrial: true}).pick, 'cheap');
  validateRow(row('cheap', {effort: 'minimal'}), true);
  assert.equal(run({models: ['cheap'], effort: 'minimal', allowTrial: true}).pick, null);
  assert.throws(() => run({config: {models: {cheap: {efforts: 'medium'}}}, allowTrial: true}), /must be a list/);
});
test('hypothetical prices stay estimates rather than reported usage', () => {
  assert.equal(estimateCost({pricing: prices(1, 5)}, {}, now).basis, 'estimate');
});
test('malformed long-context thresholds fail instead of silently using the cheaper tier', () => {
  assert.throws(() => estimateCost({pricing: {...prices(1, 5), overPromptTokens: {threshold: '100k'}}}, {}, now), /threshold/);
  assert.throws(() => estimateCost({pricing: {...prices(1, 5), maxAgeDays: '30'}}, {}, now), /maxAgeDays/);
});
test('evidence thresholds cannot turn absent checked claims into observed work', () => {
  assert.throws(() => run({config: {policy: {minTasks: 0}}}), /positive integer/);
  assert.throws(() => run({config: {policy: {minClaims: 0}}}), /positive integer/);
});
test('empty ledger environment uses the private default instead of an empty filename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra env '));
  try {
    const scripts = path.join(dir, 'scripts');
    fs.mkdirSync(scripts);
    const script = path.join(scripts, 'pair.mjs');
    fs.copyFileSync(path.resolve('skill/scripts/pair.mjs'), script);
    const input = path.join(dir, 'outcome.json');
    fs.writeFileSync(input, JSON.stringify(row('cheap')));
    const output = spawnSync(process.execPath, [script, 'log', '--file', input], {encoding: 'utf8', env: {...process.env, MODEL_ORCHESTRA_LEDGER: ''}});
    assert.equal(output.status, 0, output.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'ledger.jsonl'), 'utf8')).model, 'cheap');
  } finally { fs.rmSync(dir, {recursive: true}); }
});
test('quota error remains failure even when CLI subtype says success', () => {
  const result = inspectReport({is_error: true, subtype: 'success', result: 'You’ve hit your weekly limit · resets Oct 15'});
  assert.equal(result.usable, false);
  assert.equal(result.errorKind, 'quota');
  assert.equal(result.cost.basis, 'unknown');
  assert.equal(result.cost.usd, null);
  assert.equal(inspectReport({is_error: false, subtype: 'error_max_budget_usd'}).usable, false);
  assert.equal(inspectReport({is_error: false, subtype: 'success', modelUsage: {'claude-haiku-5-5': {costBasis: 'list'}}, total_cost_usd: 0.02}).cost.basis, 'api-equivalent');
});
test('CLI file logging, personal stats and no-seed routing work on paths with spaces', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra cli '));
  const script = path.resolve('skill/scripts/pair.mjs');
  const ledger = path.join(dir, 'local evidence.jsonl');
  const input = path.join(dir, 'outcome.json');
  const call = args => spawnSync(process.execPath, [script, ...args, '--ledger', ledger], {encoding: 'utf8'});
  try {
    const first = call(['pick', 'review-ui', 'cheap', '--json']);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).seedUsedForRouting, false);
    assert.equal(JSON.parse(first.stdout).candidates[0].checked, 0);
    fs.writeFileSync(input, '\uFEFF' + JSON.stringify(row('cheap')));
    assert.equal(call(['log', '--file', input]).status, 0);
    const stats = call(['stats', '--json']);
    assert.equal(stats.status, 0, stats.stderr);
    assert.equal(JSON.parse(stats.stdout).rows[0].confirmed, 4);
    fs.writeFileSync(input, JSON.stringify(row('cheap', {verified: false})));
    assert.equal(call(['log', '--file', input]).status, 1);
    assert.equal(fs.readFileSync(ledger, 'utf8').trim().split('\n').length, 1);
  } finally { fs.rmSync(dir, {recursive: true}); }
});
