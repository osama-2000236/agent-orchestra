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
const config = {models: {cheap: {pricing: prices(1, 5)}, strong: {pricing: prices(4, 20)}}};
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
  const c = {models: {a: {pricing: prices(5, 25)}, b: {pricing: prices(2, 10)}, c: {pricing: prices(0.1, 0.5)}}};
  for (const models of [['a', 'b', 'c'], ['c', 'a', 'b'], ['b', 'c', 'a']]) {
    assert.equal(run({models, rows, config: c, allowTrial: true}).pick, 'b');
  }
});
test('invalid outcomes and malformed costs fail before logging', () => {
  assert.throws(() => validateRow(row('cheap', {verified: false}), true), /verified/);
  assert.throws(() => validateRow(row('cheap', {confirmed: -1}), true), /confirmed/);
  assert.throws(() => validateRow(row('cheap', {cost: {basis: 'actual', workerUsd: 1}}), true), /source/);
  assert.throws(() => run({effort: 'unsupported'}), /effort/);
  assert.throws(() => run({maxTaskUsd: NaN}), /maxTaskUsd/);
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
