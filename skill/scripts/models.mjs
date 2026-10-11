// Model discovery, registry update with rollback, and a small checkable benchmark.
// discover() only reads local files, local ports and public catalogues; bench() is the one part that spends quota.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const HOME = os.homedir();
const run = (cmd, args, opts = {}) => {
  // cmd.exe joins arguments unquoted, so quote the ones with spaces (paths); safe() already keeps names plain.
  if (process.platform === 'win32') args = args.map(a => /s/.test(a) ? `"${a}"` : a);
  const r = spawnSync(cmd, args, {encoding: 'utf8', timeout: opts.timeout ?? 15000, shell: process.platform === 'win32', input: opts.input, cwd: opts.cwd, env: {...process.env, ...opts.env}});
  return {ok: r.status === 0 && !r.error, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() || r.error?.message || ''};
};
const getJson = async (url, headers = {}, ms = 8000) => {
  try { const r = await fetch(url, {headers, signal: AbortSignal.timeout(ms)}); return r.ok ? await r.json() : null; } catch { return null; }
};
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
// Claude Code's short aliases follow the installed CLI's own table: CLI 2.1.251 still sent `haiku` to claude-haiku-4-5
// on 2026-10-11. So workers get full ids: the newest of each tier in the public catalogue, confirmed by bench.
const TIERS = ['haiku', 'sonnet', 'opus', 'fable'];
export function newestClaude(prices) {
  const best = {};
  for (const id of Object.keys(prices)) {
    const m = /^anthropic\/claude-(haiku|sonnet|opus|fable)-(\d+)(?:\.(\d+))?$/.exec(id);
    if (!m) continue;
    const v = +m[2] * 100 + +(m[3] ?? 0);
    if (!best[m[1]] || v > best[m[1]].v) best[m[1]] = {v, id: `claude-${m[1]}-${m[2]}${m[3] ? '-' + m[3] : ''}`};
  }
  return TIERS.map(t => best[t]?.id ?? t);
}
const safe = v => { if (!/^[\w.:\/\[\]-]{1,80}$/.test(v)) throw new Error(`unsafe model or effort name: ${v}`); return v; };

// Every runtime that can answer a prompt on this machine, and which quota pool it draws from.
// Separate pools matter: when the Claude subscription is exhausted, a ChatGPT-login Codex or a local model still works.
export async function discover({fetchCatalogue = true} = {}) {
  const runtimes = [];
  const prices = fetchCatalogue ? await catalogue() : {};
  const claude = run('claude', ['--version']);
  if (claude.ok) runtimes.push({runtime: 'claude-code', version: claude.out.split(' ')[0], pool: process.env.ANTHROPIC_API_KEY ? 'anthropic-api' : 'claude-subscription', models: newestClaude(prices).map(id => ({id, efforts: ['low', 'medium', 'high', 'xhigh', 'max']}))});
  const codex = run('codex', ['--version']);
  if (codex.ok) {
    const cache = readJson(path.join(HOME, '.codex', 'models_cache.json'));
    const models = (cache?.models ?? []).filter(m => m.visibility !== 'hide').map(m => ({id: m.slug, efforts: (m.supported_reasoning_levels ?? []).map(x => x.effort ?? x), defaultEffort: m.default_reasoning_level, context: m.context_window}));
    runtimes.push({runtime: 'codex', version: codex.out.split(' ').pop(), pool: fs.existsSync(path.join(HOME, '.codex', 'auth.json')) ? 'chatgpt-or-openai' : 'unknown', catalogueFetchedAt: cache?.fetched_at ?? null, models});
  }
  const gemini = run('gemini', ['--version']);
  if (gemini.ok) runtimes.push({runtime: 'gemini-cli', version: gemini.out, pool: 'google', models: []});
  const ollama = await getJson('http://localhost:11434/api/tags', {}, 2000);
  if (ollama) runtimes.push({runtime: 'ollama', pool: 'local', models: (ollama.models ?? []).map(m => ({id: m.name, sizeGb: +(m.size / 1e9).toFixed(1), params: m.details?.parameter_size}))});
  const lms = await getJson('http://localhost:1234/v1/models', {}, 2000);
  if (lms) runtimes.push({runtime: 'lmstudio', pool: 'local', models: (lms.data ?? []).map(m => ({id: m.id}))});
  for (const [name, env, url, auth] of [['anthropic-api', 'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1/models?limit=100', k => ({'x-api-key': k, 'anthropic-version': '2023-06-01'})], ['openai-api', 'OPENAI_API_KEY', 'https://api.openai.com/v1/models', k => ({authorization: `Bearer ${k}`})], ['xai-api', 'XAI_API_KEY', 'https://api.x.ai/v1/models', k => ({authorization: `Bearer ${k}`})]]) {
    if (!process.env[env]) continue;
    const list = await getJson(url, auth(process.env[env]));
    runtimes.push({runtime: name, pool: name, reachable: !!list, models: (list?.data ?? []).map(m => ({id: m.id}))});
  }
  const hardware = {platform: process.platform, cpus: os.cpus().length, memoryGb: +(os.totalmem() / 1e9).toFixed(1)};
  return {discoveredAt: new Date().toISOString(), hardware, runtimes, prices};
}

// Public per-token prices (USD per million) from OpenRouter's catalogue, keyed by its ids. Provider pages win when they disagree.
export async function catalogue() {
  const d = await getJson('https://openrouter.ai/api/v1/models', {}, 20000);
  const out = {};
  for (const m of d?.data ?? []) {
    if (m.id.includes(':')) continue;
    const p = m.pricing ?? {}; const per = v => v === undefined || v === null || v === '' ? undefined : +(Number(v) * 1e6).toFixed(4);
    out[m.id] = {input: per(p.prompt), output: per(p.completion), cacheRead: per(p.input_cache_read), cacheWrite: per(p.input_cache_write), context: m.context_length, source: 'https://openrouter.ai/api/v1/models'};
  }
  return out;
}

// Map a runtime model id to the catalogue: claude-haiku-5-5 -> anthropic/claude-haiku-5.5, gpt-6.1-sol -> openai/gpt-6.1-sol.
export function catalogueId(id) {
  if (/^claude-/.test(id)) return 'anthropic/' + id.replace(/-(\d+)-(\d+)$/, '-$1.$2');
  if (/^(gpt|o\d)/.test(id)) return 'openai/' + id;
  if (/^grok/.test(id)) return 'x-ai/' + id;
  return null;
}

// Price tier by output price per million tokens: the tier decides which roles a new, unmeasured model may trial.
export const tierOf = p => p?.output === undefined ? 'unknown' : p.output === 0 ? 'free' : p.output <= 1 ? 'cheap' : p.output <= 15 ? 'mid' : 'strong';

// Build the registry from a discovery, keeping provider prices from the old registry and the user's overrides.
export function buildRegistry(found, previous = {}, overrides = {}) {
  const models = {};
  for (const rt of found.runtimes) for (const m of rt.models) {
    const key = rt.runtime === 'claude-code' ? m.id : `${rt.runtime}:${m.id}`;
    const old = previous.models?.[key] ?? {};
    const cid = old.resolved ? catalogueId(old.resolved) : catalogueId(m.id);
    const listed = cid ? found.prices?.[cid] : undefined;
    const pricing = old.pricing?.source && !old.pricing.source.includes('openrouter') ? old.pricing
      : rt.pool === 'local' ? {input: 0, output: 0, source: 'local hardware', checkedAt: found.discoveredAt.slice(0, 10), maxAgeDays: 3650} : listed ? {...listed, checkedAt: found.discoveredAt.slice(0, 10), maxAgeDays: 30} : old.pricing;
    models[key] = {...old, runtime: rt.runtime, pool: rt.pool, id: m.id, efforts: m.efforts ?? old.efforts, defaultEffort: m.defaultEffort ?? old.defaultEffort, context: m.context ?? listed?.context ?? old.context, pricing, tier: tierOf(pricing), seen: found.discoveredAt.slice(0, 10), available: true, ...overrides[key]};
  }
  for (const [key, m] of Object.entries(previous.models ?? {})) if (!models[key] && m.runtime) models[key] = {...m, available: false};
  return {updatedAt: found.discoveredAt, hardware: found.hardware, models};
}

export function diffRegistry(a = {models: {}}, b) {
  const changes = [];
  for (const [k, m] of Object.entries(b.models)) {
    const o = a.models?.[k];
    if (!o) changes.push(`+ ${k} (${m.tier}${m.pricing?.output !== undefined ? `, $${m.pricing.input}/$${m.pricing.output}` : ''})`);
    else if (o.available !== false && m.available === false) changes.push(`- ${k} no longer found`);
    else if (o.pricing?.input !== m.pricing?.input || o.pricing?.output !== m.pricing?.output) changes.push(`~ ${k} price $${o.pricing?.input}/$${o.pricing?.output} -> $${m.pricing?.input}/$${m.pricing?.output}`);
  }
  return changes;
}

// Write the new registry, keeping every previous one so `models rollback` can restore it.
export function saveRegistry(dir, registry) {
  const file = path.join(dir, 'models.json'), hist = path.join(dir, 'history');
  fs.mkdirSync(hist, {recursive: true});
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(hist, `models-${Date.now()}.json`));
  fs.writeFileSync(file, JSON.stringify(registry, null, 2) + '\n');
  return file;
}
export function rollback(dir) {
  const hist = path.join(dir, 'history');
  const last = fs.existsSync(hist) ? fs.readdirSync(hist).filter(f => /^models-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7))).pop() : null;
  if (!last) throw new Error('no earlier registry to roll back to');
  fs.copyFileSync(path.join(hist, last), path.join(dir, 'models.json'));
  fs.rmSync(path.join(hist, last));
  return last;
}

// Four tiny tasks with one right answer each. They measure cost, speed and basic reliability per model and effort,
// not depth: a model that fails them should not get the role; passing them does not prove it can review a release.
export const TASKS = [
  {id: 'find-bug', role: 'review-code', prompt: 'Which line number has the bug? Reply with the number only.\n1 function split(total, n) {\n2   const part = Math.floor(total / n);\n3   const out = Array(n).fill(part);\n4   out[0] += total - part * (n - 1);\n5   return out;\n6 }\n// split must return n integers that sum to total', check: a => /^\D*4\D*$/.test(a)},
  {id: 'extract', role: 'scout', prompt: 'Return only JSON {"total":number,"currency":string} for: "Invoice 88 - 3 boxes at 12.50 each, shipping 4.50, total due 42.00 ILS".', check: a => { try { const j = JSON.parse(a.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); return j.total === 42 && /^ILS$/i.test(j.currency); } catch { return false; } }},
  {id: 'review-diff', role: 'review-code', prompt: 'Review this diff. Reply BLOCKING:<reason in 5 words> or CLEAN.\n-  if (!user.canRefund) throw new Error("denied");\n   refund(order.id, order.total);\n+  log("refund", order.id);', check: a => /BLOCKING/i.test(a) && /(permission|auth|denied|canRefund|guard|access)/i.test(a)},
  // From a real defect (SmartStore 3.65.2, found by GPT-6.1 Sol, 2026-10-11): a delete that ignores what a partial return
  // already took back. The three tasks above separate only Haiku at low effort from the rest; this one traces state.
  {id: 'trace-money', role: 'review-code', prompt: 'Review this code. Reply BLOCKING:<reason in 8 words> or CLEAN.\nfunction returnPart(sale, c, share) {\n  const took = Math.floor(sale.earned * share);\n  c.points -= took;\n  sale.earnedBack = (sale.earnedBack || 0) + took;\n}\nfunction deleteSale(sale, c) {\n  c.points -= sale.earned;\n}', check: a => /^\W*BLOCKING/i.test(a) && (/\bearnedBack\b/i.test(a) || /\b(?:partial(?:ly)? return(?:s|ed)?|(?:earlier|prior|previous) returns?|already (?:returned|reversed|refunded|took|taken)|(?:took|taken) back|returned earlier)\b/i.test(a))},
];

// One prompt through one runtime; returns the answer, seconds and API-equivalent cost when the runtime reports it.
export function ask(runtime, model, effort, prompt, cwd) {
  const t0 = Date.now(); safe(String(model)); safe(String(effort));
  if (runtime === 'claude-code') {
    const r = run('claude', ['-p', '--model', model, '--effort', effort, '--output-format', 'json', '--tools', '""', '--no-session-persistence', '--strict-mcp-config', '--setting-sources', 'local'], {input: prompt, cwd, timeout: 240000});
    const j = (() => { try { return JSON.parse(r.out); } catch { return null; } })();
    if (!j || j.is_error) return {ok: false, error: (j?.result ?? r.err ?? r.out).slice(0, 200), seconds: (Date.now() - t0) / 1000};
    // The model that really answered; a mismatch with `model` means the runtime substituted another one.
    const resolved = Object.keys(j.modelUsage ?? {}).includes(model) ? model : Object.keys(j.modelUsage ?? {}).sort((a, b) => (j.modelUsage[b].outputTokens ?? 0) - (j.modelUsage[a].outputTokens ?? 0))[0];
    return {ok: true, answer: String(j.result ?? '').trim(), seconds: (Date.now() - t0) / 1000, usd: j.total_cost_usd, resolved, tokens: j.usage};
  }
  if (runtime === 'codex') {
    const r = run('codex', ['exec', '-m', model, '-c', `model_reasoning_effort="${effort}"`, '--json', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only', '-C', cwd, '-'], {input: prompt, cwd, timeout: 240000});
    const events = r.out.split('\n').flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
    const msg = events.filter(e => e.item?.type === 'agent_message').pop()?.item?.text;
    const usage = events.filter(e => e.type === 'turn.completed').pop()?.usage;
    if (!msg) return {ok: false, error: (events.find(e => e.type === 'error' || e.type === 'turn.failed')?.message ?? r.err).slice(0, 200), seconds: (Date.now() - t0) / 1000};
    return {ok: true, answer: msg.trim(), seconds: (Date.now() - t0) / 1000, resolved: model, tokens: usage};
  }
  return {ok: false, error: `no bench adapter for ${runtime}`, seconds: 0};
}

export function bench(targets, {tasks = TASKS, cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-bench-'))} = {}) {
  const rows = [];
  for (const {runtime, model, effort} of targets) for (const task of tasks) {
    const r = ask(runtime, model, effort, task.prompt, cwd);
    rows.push({runtime, model, resolved: r.resolved, effort, task: task.id, role: task.role, ok: r.ok, pass: r.ok && task.check(r.answer), answer: r.answer?.slice(0, 120), seconds: +r.seconds.toFixed(1), usd: r.usd ?? null, inputTokens: r.tokens?.input_tokens, outputTokens: r.tokens?.output_tokens, error: r.error});
  }
  return rows;
}
