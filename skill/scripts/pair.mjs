#!/usr/bin/env node
// Offline planning only: never launches models or changes repository settings.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'data');
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const finite = (v, label) => {
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label} must be a nonnegative number`);
};
const text = (v, label) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${label} is required`);
};
const effortLabel = v => {
  text(v, 'effort');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v)) throw new Error('invalid effort label');
};
export function validateRow(r, strict = false) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('outcome must be an object');
  for (const k of ['model', 'role', 'task']) text(r[k], k);
  for (const k of ['confirmed', 'refuted', 'rework']) {
    finite(r[k] ?? 0, k);
    if (!Number.isInteger(r[k] ?? 0)) throw new Error(`${k} must be an integer`);
  }
  for (const k of ['minutes', 'verificationMinutes', 'missed']) if (r[k] !== undefined) finite(r[k], k);
  if (r.missed !== undefined && !Number.isInteger(r.missed)) throw new Error('missed must be an integer');
  if (r.effort !== undefined) effortLabel(r.effort);
  if (strict) {
    if (r.verified !== true) throw new Error('log only lead-verified outcomes: verified:true is required');
    for (const k of ['evidence', 'effort', 'candidate']) text(r[k], k);
  }
  if (r.cost !== undefined) {
    if (!['actual', 'api-equivalent', 'estimate', 'unknown'].includes(r.cost?.basis)) throw new Error('invalid cost basis');
    if (r.cost.basis !== 'unknown') {
      finite(r.cost.workerUsd, 'workerUsd');
      text(r.cost.source, 'cost source');
      if (r.cost.verificationUsd !== undefined) finite(r.cost.verificationUsd, 'verificationUsd');
      if (r.cost.reworkUsd !== undefined) finite(r.cost.reworkUsd, 'reworkUsd');
    }
  }
  return r;
}
export function inspectReport(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('report must be an object');
  const failed = r.is_error !== false || r.subtype !== 'success';
  const message = [r.result, ...(Array.isArray(r.errors) ? r.errors : [])].filter(v => typeof v === 'string').join('\n');
  const errorKind = !failed ? null : /weekly limit|quota|rate.limit|usage limit/i.test(message) ? 'quota' : /budget/i.test(message) ? 'budget' : 'runtime';
  const models = Object.entries(r.modelUsage ?? {}).map(([id, usage]) => ({model: usage.canonicalModel ?? id, costBasis: usage.costBasis ?? 'unknown'}));
  return {usable: !failed, errorKind, subtype: r.subtype ?? 'unknown', models,
    cost: {basis: models.length && models.every(m => m.costBasis === 'list') && Number.isFinite(r.total_cost_usd) ? 'api-equivalent' : 'unknown', usd: Number.isFinite(r.total_cost_usd) ? r.total_cost_usd : null},
    next: failed ? 'preserve partial artifacts, report the failure, continue independent work; do not score this as a model reasoning failure' : 'verify candidate, model, tools and every claim before acceptance'};
}
export function estimateCost(model, request, now = new Date()) {
  const p = model.pricing;
  if (!p) return {usd: null, basis: 'unknown', reason: 'no sourced price configuration'};
  text(p.source, 'pricing source');
  const checkedAt = Date.parse(p.checkedAt);
  if (!Number.isFinite(checkedAt)) throw new Error('pricing checkedAt must be a date');
  finite(p.maxAgeDays ?? 30, 'pricing maxAgeDays');
  if (p.overPromptTokens) finite(p.overPromptTokens.threshold, 'long-context threshold');
  const age = (now.getTime() - checkedAt) / 86400000;
  if (age < -1 || age > (p.maxAgeDays ?? 30)) return {usd: null, basis: 'unknown', reason: 'pricing snapshot needs refresh'};
  const r = {inputTokens: 10000, outputTokens: 2000, cacheReadTokens: 0, cacheWriteTokens: 0, ...request};
  for (const k of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']) finite(r[k], k);
  const promptTokens = r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens;
  const rates = p.overPromptTokens && promptTokens > p.overPromptTokens.threshold ? p.overPromptTokens : p;
  for (const k of ['input', 'output', 'cacheRead', 'cacheWrite']) if (rates[k] !== undefined) finite(rates[k], `pricing ${k}`);
  if (rates.input === undefined || rates.output === undefined || (r.cacheReadTokens && rates.cacheRead === undefined) || (r.cacheWriteTokens && rates.cacheWrite === undefined)) return {usd: null, basis: 'unknown', reason: 'token category has no sourced rate'};
  const usd = (r.inputTokens * rates.input + r.outputTokens * rates.output + r.cacheReadTokens * (rates.cacheRead ?? 0) + r.cacheWriteTokens * (rates.cacheWrite ?? 0)) / 1e6;
  return {usd, basis: 'estimate', rateBasis: 'api-equivalent', source: p.source, checkedAt: p.checkedAt, promptTokens};
}
export function tally(rows, model, role, effort, includeHistorical = false) {
  const t = {model, role, effort, tasks: 0, confirmed: 0, refuted: 0, rework: 0, minutes: 0, verificationMinutes: 0, missed: 0};
  const completeCosts = [];
  for (const r of rows) {
    validateRow(r);
    // Unknown efforts and different model generations cannot establish this route's quality.
    if (r.model !== model || r.role !== role || (r.effort ?? 'unknown') !== effort || (!includeHistorical && r.verified !== true)) continue;
    t.tasks++;
    for (const k of ['confirmed', 'refuted', 'rework', 'minutes', 'verificationMinutes', 'missed']) t[k] += r[k] ?? 0;
    if (['actual', 'api-equivalent'].includes(r.cost?.basis) && Number.isFinite(r.cost.verificationUsd) && (!r.rework || Number.isFinite(r.cost.reworkUsd))) completeCosts.push({basis: r.cost.basis, usd: r.cost.workerUsd + r.cost.verificationUsd + (r.cost.reworkUsd ?? 0)});
  }
  t.checked = t.confirmed + t.refuted;
  t.score = (t.confirmed + 1) / (t.checked + t.missed + 2) - 0.1 * t.rework / Math.max(t.tasks, 1);
  const comparable = t.tasks > 0 && completeCosts.length === t.tasks && completeCosts.every(c => c.basis === completeCosts[0].basis);
  t.completeCost = {usd: comparable ? completeCosts.reduce((sum, c) => sum + c.usd, 0) / t.tasks : null, basis: comparable ? completeCosts[0].basis : 'unknown', tasks: completeCosts.length};
  return t;
}
export function plan({rows = [], models = [], role, effort = 'medium', config = {}, request = {}, allowTrial = false, risk = 'ordinary', maxTaskUsd, costMode = config.costMode ?? 'complete-task', now}) {
  text(role, 'role');
  effortLabel(effort);
  if (!['complete-task', 'worker-request', 'quality'].includes(costMode)) throw new Error('invalid costMode');
  if (!['ordinary', 'high'].includes(risk)) throw new Error('risk must be ordinary or high');
  if (maxTaskUsd !== undefined) finite(maxTaskUsd, 'maxTaskUsd');
  const policy = {qualityFloor: 0.6, nearTie: 0.08, minTasks: 3, minClaims: 10, ...config.policy};
  for (const [k, v] of Object.entries(policy)) finite(v, k);
  if (policy.qualityFloor > 1 || policy.nearTie > 1) throw new Error('quality thresholds must be <= 1');
  for (const k of ['minTasks', 'minClaims']) if (!Number.isInteger(policy[k]) || policy[k] < 1) throw new Error(`${k} must be a positive integer`);
  if (!models.length) models = Object.keys(config.models ?? {});
  const candidates = [...new Set(models)].map(model => {
    const m = config.models?.[model] ?? {};
    const t = tally(rows, model, role, effort);
    const evidence = t.tasks >= policy.minTasks && t.checked >= policy.minClaims ? 'observed' : 'trial';
    const cost = estimateCost(m, request, now);
    const reasons = [];
    if (m.available === false) reasons.push('unavailable in this runtime');
    if (!(m.efforts ?? EFFORTS).includes(effort)) reasons.push('effort not supported by configured runtime');
    if (evidence === 'trial' && !allowTrial) reasons.push('trial needs explicit full-verification permission');
    if ((t.checked || t.missed) && t.score < policy.qualityFloor) reasons.push('below quality floor');
    if (maxTaskUsd !== undefined && (cost.usd === null || cost.usd > maxTaskUsd)) reasons.push('estimate unknown or exceeds task budget');
    return {...t, evidence, cost, eligible: !reasons.length, reasons};
  });
  const eligible = candidates.filter(c => c.eligible);
  const best = Math.max(...eligible.map(c => c.score));
  const band = eligible.filter(c => c.score >= best - policy.nearTie);
  // Anchoring the band at the highest score avoids order-dependent pairwise near-tie sorting.
  const costKey = costMode === 'worker-request' ? 'cost' : 'completeCost';
  const costComparable = costMode !== 'quality' && band.length > 0 && band.every(c => c[costKey].usd !== null && c[costKey].basis === band[0][costKey].basis);
  band.sort((a, b) => costComparable ? a[costKey].usd - b[costKey].usd || b.score - a.score || a.model.localeCompare(b.model) : b.score - a.score || a.model.localeCompare(b.model));
  return {
    role, effort, risk, costMode, pick: risk === 'high' ? null : band[0]?.model ?? null,
    decision: risk === 'high' ? 'lead retains responsibility; use independent reviewers as evidence' : !band.length ? 'no eligible worker; keep work with lead or repair configuration' : costComparable ? costMode === 'worker-request' ? 'lowest worker-request estimate inside quality band; verification and rework excluded' : 'lowest recorded mean complete-task cost inside quality band' : 'best quality proxy; comparable cost unavailable or cost ranking disabled',
    candidates, policy, limitation: 'Planning heuristic, not a capability guarantee or measured Pareto optimum. Checked claims and known misses do not establish exhaustive recall. Runtime attestation and project gates remain required.'
  };
}
export function cli(argv = process.argv.slice(2)) {
  const [command, ...raw] = argv;
  const args = []; const options = {};
  for (let i = 0; i < raw.length; i++) {
    const key = raw[i];
    if (['--json', '--allow-trial'].includes(key)) options[key.slice(2)] = true;
    else if (key.startsWith('--')) {
      if (!['--config', '--ledger', '--effort', '--risk', '--cost-mode', '--max-task-usd', '--input-tokens', '--output-tokens', '--cache-read-tokens', '--cache-write-tokens', '--file'].includes(key)) throw new Error(`unknown option ${key}`);
      if (!raw[i + 1] || raw[i + 1].startsWith('--')) throw new Error(`missing value for ${key}`);
      options[key.slice(2)] = raw[++i];
    } else args.push(key);
  }
  const ledger = options.ledger || process.env.MODEL_ORCHESTRA_LEDGER || path.join(DATA, 'ledger.jsonl');
  const exists = fs.existsSync(ledger);
  const read = exists ? ledger : path.join(DATA, 'ledger.example.jsonl');
  const rows = fs.existsSync(read) ? fs.readFileSync(read, 'utf8').split(/\r?\n/).filter(l => l.trim()).map((l, i) => {
    try { return validateRow(JSON.parse(l)); } catch (e) { throw new Error(`${read}:${i + 1}: ${e.message}`); }
  }) : [];
  if (command === 'inspect') {
    if (!options.file) throw new Error('inspect --file report.json');
    const result = inspectReport(JSON.parse(fs.readFileSync(options.file, 'utf8').replace(/^\uFEFF/, '')));
    console.log(JSON.stringify(result, null, 2));
    if (!result.usable) process.exitCode = 1;
  } else if (command === 'log') {
    const r = validateRow(JSON.parse(options.file ? fs.readFileSync(options.file, 'utf8').replace(/^\uFEFF/, '') : args.join(' ')), true);
    r.date ??= new Date().toISOString().slice(0, 10);
    fs.mkdirSync(path.dirname(ledger), {recursive: true});
    fs.appendFileSync(ledger, JSON.stringify(r) + '\n');
    console.log(JSON.stringify({logged: r.model, role: r.role, ledger}));
  } else if (command === 'pick') {
    const config = options.config ? JSON.parse(fs.readFileSync(options.config, 'utf8').replace(/^\uFEFF/, '')) : {};
    const request = {};
    for (const [flag, field] of [['input-tokens', 'inputTokens'], ['output-tokens', 'outputTokens'], ['cache-read-tokens', 'cacheReadTokens'], ['cache-write-tokens', 'cacheWriteTokens']]) if (options[flag] !== undefined) request[field] = Number(options[flag]);
    const result = plan({rows: exists ? rows : [], role: args[0], models: args.slice(1), config, effort: options.effort, risk: options.risk, costMode: options['cost-mode'], allowTrial: options['allow-trial'], request, maxTaskUsd: options['max-task-usd'] === undefined ? undefined : Number(options['max-task-usd'])});
    const out = {ledger: exists ? read : null, seedUsedForRouting: false, ...result};
    if (options.json) console.log(JSON.stringify(out, null, 2));
    else { console.table(result.candidates.map(c => ({model: c.model, effort: c.effort, checked: c.checked, tasks: c.tasks, score: +c.score.toFixed(3), evidence: c.evidence, estimatedUsd: c.cost.usd, eligible: c.eligible}))); console.log(`pick: ${result.pick ?? 'lead'}; ${result.decision}`); console.log(result.limitation); }
  } else if (command === 'stats') {
    const pairs = [...new Set(rows.map(r => `${r.model}\t${r.role}\t${r.effort ?? 'unknown'}`))];
    const out = {ledger: read, exampleOnly: !exists, rows: pairs.map(k => tally(rows, ...k.split('\t'), true))};
    if (options.json) console.log(JSON.stringify(out, null, 2));
    else { console.log(`ledger: ${read}${exists ? '' : ' (historical example; not used to route)'}`); console.table(out.rows); }
  } else throw new Error('usage: pair.mjs pick <role> [models...] [--config file --effort medium --allow-trial --json] | stats | log --file outcome.json | inspect --file report.json');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
