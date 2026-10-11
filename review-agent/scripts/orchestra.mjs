#!/usr/bin/env node
// One entry point. Routing, ledger and lessons live in pair.mjs; this adds measured usage, model discovery and benchmarks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cli as pairCli} from './pair.mjs';
import {sessionReport, latestSessions, projectDir} from './usage.mjs';
import {discover, buildRegistry, diffRegistry, saveRegistry, rollback, bench, TASKS} from './models.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DATA = process.env.AGENT_ORCHESTRA_DATA || path.join(HERE, '..', 'data');
const readJson = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')) : null;
const flag = (argv, name, fallback) => { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; };
const has = (argv, name) => argv.includes(name);
const out = (argv, value, text) => has(argv, '--json') || !text ? console.log(JSON.stringify(value, null, 2)) : text(value);

// Recommended Claude Code settings, each tied to a measured cause in docs/usage-root-causes.md.
export const TUNE = {
  // A full id: the short alias follows the installed CLI's table (2.1.251 sent `haiku` to the previous generation).
  env: {CLAUDE_CODE_SUBAGENT_MODEL: 'claude-haiku-5-5'},
  autoCompactWindow: 200000,
};
export function tune(settingsFile, apply) {
  const current = readJson(settingsFile) ?? {};
  const next = {...current, env: {...TUNE.env, ...current.env}, autoCompactWindow: current.autoCompactWindow ?? TUNE.autoCompactWindow};
  const changes = [];
  for (const [k, v] of Object.entries(TUNE.env)) if (current.env?.[k] === undefined) changes.push(`env.${k}=${v}`);
  if (current.autoCompactWindow === undefined) changes.push(`autoCompactWindow=${TUNE.autoCompactWindow}`);
  let backup = null;
  if (apply && changes.length) {
    if (fs.existsSync(settingsFile)) fs.copyFileSync(settingsFile, backup = `${settingsFile}.orchestra-${Date.now()}.bak`);
    fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2) + '\n');
  }
  return {settingsFile, changes, applied: !!(apply && changes.length), backup, kept: 'values you already set are never overwritten'};
}

export async function main(argv = process.argv.slice(2)) {
  const [command, sub] = argv;
  if (command === 'usage') {
    const file = flag(argv, '--session');
    const files = file ? [file] : latestSessions(flag(argv, '--project', projectDir()), Number(flag(argv, '--last', 1)));
    if (!files.length) throw new Error('no Claude Code transcript found for this folder; pass --project <dir> or --session <file.jsonl>');
    const pricing = (readJson(path.join(DATA, 'models.json')) ?? readJson(path.join(DATA, 'config.example.json')))?.models ?? {};
    const reports = files.map(f => sessionReport(f, pricing));
    return out(argv, reports, rs => { for (const r of rs) {
      console.log(`session ${r.session}: ${r.minutes} min, ${r.leadTurns} lead turns, ${r.agents} subagents, ${r.compactions} compactions, $${r.total.usd} list-price equivalent, lead share ${r.leadShare}`);
      console.table(r.rows.map(x => ({who: x.who.slice(0, 50), model: x.model, requests: x.requests, cacheReadM: +(x.cacheRead / 1e6).toFixed(2), outputK: +(x.output / 1e3).toFixed(1), usd: x.usd})));
      for (const f of r.findings) console.log(`- ${f}`);
    } });
  }
  if (command === 'models') {
    const file = path.join(DATA, 'models.json');
    if (sub === 'rollback') return console.log(`restored ${rollback(DATA)}`);
    if (sub === 'list') return out(argv, readJson(file) ?? {models: {}}, r => console.table(Object.entries(r.models).map(([k, m]) => ({model: k, pool: m.pool, tier: m.tier, in: m.pricing?.input, out: m.pricing?.output, efforts: (m.efforts ?? []).join(','), bench: m.bench ?? '', available: m.available !== false}))));
    if (sub === 'discover' || sub === 'update') {
      const found = await discover({fetchCatalogue: !has(argv, '--offline')});
      if (sub === 'discover') return out(argv, found, f => { console.log(JSON.stringify(f.hardware)); for (const r of f.runtimes) console.log(`${r.runtime} [${r.pool}]: ${r.models.map(m => m.id).join(', ') || '(no models listed)'}`); });
      // First run: start from the shipped provider prices (cache writes, long-prompt tiers), not only the public catalogue.
      const previous = readJson(file) ?? readJson(path.join(HERE, '..', 'data', 'config.example.json')) ?? {models: {}};
      const registry = buildRegistry(found, previous, readJson(path.join(DATA, 'overrides.json')) ?? {});
      const changes = diffRegistry(previous, registry);
      saveRegistry(DATA, registry);
      console.log(changes.length ? changes.join('\n') : 'no model or price changes');
      console.log(`registry: ${file} (previous kept in data/history; undo with: models rollback)`);
      if (has(argv, '--bench')) return main(['bench', '--new', ...argv.slice(2)]);
      return;
    }
    throw new Error('usage: orchestra.mjs models discover|update [--bench] [--offline]|list|rollback');
  }
  if (command === 'bench') {
    const registry = readJson(path.join(DATA, 'models.json'));
    let targets = (flag(argv, '--targets') ?? '').split(',').filter(Boolean).map(t => { const [runtime, model, effort = 'low'] = t.split(':'); return {runtime, model, effort}; });
    if (!targets.length && registry) targets = Object.values(registry.models).filter(m => m.available !== false && ['claude-code', 'codex'].includes(m.runtime) && (!has(argv, '--new') || !m.bench) && m.tier !== 'strong').map(m => ({runtime: m.runtime, model: m.id, effort: 'low'}));
    if (!targets.length) throw new Error('bench --targets claude-code:claude-haiku-5-5:low,codex:gpt-6-luna:low (or run models update first)');
    const tasks = TASKS.filter(t => !flag(argv, '--tasks') || flag(argv, '--tasks').split(',').includes(t.id));
    const rows = bench(targets, {tasks}).map(r => ({...r, date: new Date().toISOString().slice(0, 10)}));
    fs.mkdirSync(DATA, {recursive: true});
    fs.appendFileSync(path.join(DATA, 'bench.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    if (registry) {
      for (const t of targets) { const mine = rows.filter(r => r.model === t.model && r.runtime === t.runtime && r.ok); const key = Object.keys(registry.models).find(k => registry.models[k].id === t.model && registry.models[k].runtime === t.runtime); if (key && mine.length) registry.models[key].bench = `${mine.filter(r => r.pass).length}/${mine.length} @${t.effort} ${mine[0].date}`; }
      saveRegistry(DATA, registry);
    }
    return out(argv, rows, rs => { console.table(rs.map(({error, ...r}) => ({...r, error: error?.slice(0, 60)}))); console.log('rows appended to data/bench.jsonl; a quota error is a note, not a failed answer'); });
  }
  if (command === 'tune') return out(argv, tune(flag(argv, '--settings', path.join(os.homedir(), '.claude', 'settings.json')), has(argv, '--apply')), r => {
    console.log(r.changes.length ? `${r.applied ? 'applied' : 'would apply (add --apply)'}: ${r.changes.join(', ')}` : 'already tuned');
    if (r.backup) console.log(`backup: ${r.backup}`);
  });
  return pairCli(argv);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
}
