#!/usr/bin/env node
// Evidence ledger for multi-model work. Each line of the ledger is one verified outcome:
// {date, project, task, model, role, confirmed, refuted, rework, minutes, note}
//   confirmed = claims or work the lead checked and found right
//   refuted   = claims the lead checked and found wrong
//   rework    = accepted work the lead had to fix afterwards
// Only verified outcomes go in. Never log a model's self-report.
//
// Which ledger is read:
//   1. $MODEL_ORCHESTRA_LEDGER, if set
//   2. data/ledger.jsonl next to this skill, if it exists (your own evidence)
//   3. data/ledger.example.jsonl (anonymized seed data, for a first look)
// `log` always writes to (1) or (2), never to the example file.
//
// Usage:
//   node pair.mjs pick <role> [model ...]   rank models for a role (default: every model in the ledger)
//   node pair.mjs stats                     every model x role
//   node pair.mjs log '<json>'              append one outcome (date defaults to today)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const WRITE_LEDGER = process.env.MODEL_ORCHESTRA_LEDGER || path.join(DATA, 'ledger.jsonl');
const READ_LEDGER = process.env.MODEL_ORCHESTRA_LEDGER
  || (fs.existsSync(WRITE_LEDGER) ? WRITE_LEDGER : path.join(DATA, 'ledger.example.jsonl'));

// Relative cost per unit of work. A cheaper model wins a near tie. Replace with your own price ratio.
const COST = {haiku: 1, sonnet: 3, codex: 3, opus: 5, fable: 8};
const NEAR_TIE = 0.08;
const MIN_EVIDENCE = 3; // fewer checked claims than this = trial: assign only with full verification

const rows = () => fs.existsSync(READ_LEDGER)
  ? fs.readFileSync(READ_LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

function tally(model, role) {
  const t = {model, role, tasks: 0, confirmed: 0, refuted: 0, rework: 0, minutes: 0};
  for (const r of rows()) if (r.model === model && r.role === role) {
    t.tasks++; t.confirmed += r.confirmed || 0; t.refuted += r.refuted || 0;
    t.rework += r.rework || 0; t.minutes += r.minutes || 0;
  }
  const checked = t.confirmed + t.refuted;
  // Laplace-smoothed precision, minus a penalty per reworked task.
  t.score = +((t.confirmed + 1) / (checked + 2) - 0.1 * t.rework / Math.max(t.tasks, 1)).toFixed(3);
  t.evidence = checked >= MIN_EVIDENCE ? 'proven' : 'trial';
  t.cost = COST[model] ?? 5;
  return t;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'log') {
  const r = JSON.parse(args.join(' '));
  for (const k of ['model', 'role', 'task']) if (!r[k]) throw new Error(`missing ${k}`);
  r.date ??= new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.dirname(WRITE_LEDGER), {recursive: true});
  fs.appendFileSync(WRITE_LEDGER, JSON.stringify(r) + '\n');
  console.log('logged', r.model, r.role, r.task, '->', WRITE_LEDGER);
} else if (cmd === 'pick') {
  const [role, ...given] = args;
  if (!role) throw new Error('pick <role> [model ...]');
  console.log('ledger:', READ_LEDGER);
  const models = given.length ? given : [...new Set(rows().map(r => r.model))];
  const ranked = models.map(m => tally(m, role))
    .sort((a, b) => Math.abs(a.score - b.score) <= NEAR_TIE ? a.cost - b.cost : b.score - a.score);
  console.table(ranked);
  const top = ranked[0];
  console.log(top ? `pick: ${top.model} (${top.evidence}${top.evidence === 'trial' ? ' - verify every claim' : ''})` : 'no candidates');
} else if (cmd === 'stats') {
  console.log('ledger:', READ_LEDGER);
  const pairs = [...new Set(rows().map(r => `${r.model}\t${r.role}`))].map(k => tally(...k.split('\t')));
  console.table(pairs.sort((a, b) => a.role.localeCompare(b.role) || b.score - a.score));
} else {
  console.log('usage: pair.mjs pick <role> [model ...] | stats | log <json>');
}
