// Measured usage from Claude Code transcripts: where the tokens of a session went, by agent and model.
// Reads ~/.claude/projects/<project>/<session>.jsonl and <session>/subagents/*.jsonl. Never sends anything anywhere.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const lines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });

// One transcript -> per-model token totals (deduplicated by API request), compactions, and the heaviest tool results.
export function scan(records) {
  const seen = new Set(); const models = {}; const toolNames = new Map(); const tools = {};
  let compactions = 0, turns = 0, first, last;
  for (const r of records) {
    if (r.timestamp) { first ??= r.timestamp; last = r.timestamp; }
    if (r.isCompactSummary || r.subtype === 'compact_boundary') compactions += r.subtype === 'compact_boundary' ? 1 : 0;
    const m = r.message;
    if (r.type === 'assistant' && m?.usage && m.model && m.model !== '<synthetic>') {
      for (const c of Array.isArray(m.content) ? m.content : []) if (c.type === 'tool_use') toolNames.set(c.id, c.name);
      const key = r.requestId ?? m.id;
      if (seen.has(key)) continue;
      seen.add(key); turns++;
      const u = m.usage; const t = models[m.model] ??= {requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0};
      t.requests++; t.input += u.input_tokens ?? 0; t.output += u.output_tokens ?? 0; t.cacheRead += u.cache_read_input_tokens ?? 0;
      const w1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
      t.cacheWrite1h += w1; t.cacheWrite5m += (u.cache_creation_input_tokens ?? 0) - w1;
    }
    if (r.type === 'user' && Array.isArray(m?.content)) for (const c of m.content) if (c.type === 'tool_result') {
      const size = JSON.stringify(c.content ?? '').length; const name = toolNames.get(c.tool_use_id) ?? '?';
      const s = tools[name] ??= {calls: 0, chars: 0, max: 0}; s.calls++; s.chars += size; s.max = Math.max(s.max, size);
    }
  }
  const minutes = first && last ? +((Date.parse(last) - Date.parse(first)) / 60000).toFixed(1) : null;
  return {models, tools, compactions, turns, minutes};
}

// API-equivalent list price; subscriptions consume quota in proportion, not dollars. Unknown model -> null.
export function price(t, p) {
  if (!p) return null;
  const write5 = p.cacheWrite ?? p.input * 1.25, write1h = p.input * 2;
  return +((t.input * p.input + t.output * p.output + t.cacheRead * (p.cacheRead ?? p.input * 0.1) + t.cacheWrite5m * write5 + t.cacheWrite1h * write1h) / 1e6).toFixed(4);
}

export function sessionReport(file, pricing = {}) {
  const lead = scan(lines(file));
  const dir = path.join(path.dirname(file), path.basename(file, '.jsonl'), 'subagents');
  const agents = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => {
    const metaFile = path.join(dir, f.replace(/\.jsonl$/, '.meta.json'));
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
    return {agent: f.replace(/\.jsonl$/, ''), description: meta.description ?? '', requested: meta.model ?? 'inherit', ...scan(lines(path.join(dir, f)))};
  }) : [];
  const row = (who, s) => Object.entries(s.models).map(([model, t]) => ({who, model, ...t, usd: price(t, pricing[model]?.pricing ?? pricing[model])}));
  const rows = [...row('lead', lead), ...agents.flatMap(a => row(a.agent + ' ' + a.description.slice(0, 40), a))];
  const sum = (f) => rows.reduce((n, r) => n + (r[f] ?? 0), 0);
  const total = {usd: +sum('usd').toFixed(2), input: sum('input'), output: sum('output'), cacheRead: sum('cacheRead'), cacheWrite: sum('cacheWrite5m') + sum('cacheWrite1h')};
  const leadUsd = rows.filter(r => r.who === 'lead').reduce((n, r) => n + (r.usd ?? 0), 0);
  const findings = diagnose({lead, agents, rows, total: {...total, usd: sum('usd')}, leadUsd});
  return {session: path.basename(file, '.jsonl'), minutes: lead.minutes, leadTurns: lead.turns, compactions: lead.compactions, agents: agents.length, total, leadShare: sum('usd') ? +(leadUsd / sum('usd')).toFixed(2) : null, rows, heaviestTools: Object.entries(lead.tools).sort((a, b) => b[1].chars - a[1].chars).slice(0, 6).map(([name, s]) => ({name, ...s})), findings};
}

// Rules of thumb, each tied to a measured number, so the advice changes when the numbers do.
export function diagnose({lead, agents, rows, total, leadUsd}) {
  const out = [];
  if (total.usd && leadUsd / total.usd > 0.7) out.push(`lead spent ${Math.round(100 * leadUsd / total.usd)}% of the session: delegate reading, searching and drafting; keep only decisions and verification on the lead`);
  const leadRows = rows.filter(r => r.who === 'lead');
  const perTurn = leadRows.reduce((n, r) => n + r.cacheRead, 0) / Math.max(1, lead.turns);
  if (perTurn > 80000) out.push(`lead re-reads ${Math.round(perTurn / 1000)}k cached tokens per turn: every extra lead turn costs that much; batch tool calls, keep big outputs in files, compact or hand off earlier`);
  if (lead.compactions) out.push(`${lead.compactions} compaction(s): the context filled up; write the handoff before it does`);
  const big = Object.entries(lead.tools).filter(([, s]) => s.max > 20000).map(([n, s]) => `${n} (max ${Math.round(s.max / 1000)}k chars)`);
  if (big.length) out.push(`large tool results entered the lead's context: ${big.join(', ')}; read ranges, grep, or send output to a file`);
  const cold = agents.filter(a => Object.values(a.models).some(t => t.cacheWrite5m > 30000 && t.requests < 6));
  if (cold.length) out.push(`${cold.length} short subagent(s) paid a full cache write for few requests: merge tiny tasks into one packet`);
  const pricey = agents.filter(a => a.requested === 'inherit');
  if (pricey.length) out.push(`${pricey.length} subagent(s) inherited the lead's model: name a model for every spawn`);
  return out;
}

export function latestSessions(projectDir, n = 1) {
  return fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl')).map(f => path.join(projectDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, n);
}

export function projectDir(cwd = process.cwd()) {
  return path.join(os.homedir(), '.claude', 'projects', path.resolve(cwd).replace(/[^a-zA-Z0-9]/g, '-'));
}
