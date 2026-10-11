// Build the self-contained compatible reviewer distribution from shared public resources.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'skill');
const target = path.join(root, 'review-agent');
for (const name of ['scripts/pair.mjs', 'scripts/orchestra.mjs', 'scripts/usage.mjs', 'scripts/models.mjs', 'references/managed-agents.md', 'data/config.example.json', 'data/ledger.example.jsonl', 'references/app-review.md', 'references/dispatch.md', 'references/evidence.md']) {
  const out = path.join(target, name);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.copyFileSync(path.join(source, name), out);
}
const body = fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replaceAll('(references/', '(');
fs.writeFileSync(path.join(target, 'references/orchestration.md'), body);
console.log('review-agent resources synchronized; no private ledger copied');
