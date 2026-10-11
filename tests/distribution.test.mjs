import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('review-agent distribution has current shared resources without private ledger', () => {
  for (const name of ['scripts/pair.mjs', 'scripts/orchestra.mjs', 'scripts/usage.mjs', 'scripts/models.mjs', 'references/managed-agents.md', 'data/config.example.json', 'data/ledger.example.jsonl', 'references/app-review.md', 'references/dispatch.md', 'references/evidence.md']) {
    assert.equal(fs.readFileSync(path.join('review-agent', name), 'utf8'), fs.readFileSync(path.join('skill', name), 'utf8'), name);
  }
  const body = fs.readFileSync('skill/SKILL.md', 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replaceAll('(references/', '(');
  assert.equal(fs.readFileSync('review-agent/references/orchestration.md', 'utf8'), body);
  assert.equal(fs.existsSync('review-agent/data/ledger.jsonl'), false);
});
test('installed skill Markdown references resolve within their distribution', () => {
  for (const root of ['skill', 'review-agent']) {
    const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);
    for (const file of walk(root)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (!target || /^[a-z]+:\/\//i.test(target)) continue;
        const actual = path.resolve(path.dirname(file), target);
        assert.ok(actual.startsWith(path.resolve(root) + path.sep), `${file} references outside its installed distribution: ${target}`);
        assert.ok(fs.existsSync(actual), `${file} missing ${target}`);
      }
    }
  }
});
test('legacy workflow sketches parse as async workflow bodies', () => {
  for (const file of fs.readdirSync('examples').filter(n => n.endsWith('.js'))) {
    const body = fs.readFileSync(path.join('examples', file), 'utf8').replace(/^export const meta/m, 'const meta');
    assert.doesNotThrow(() => new vm.Script(`(async function(){\n${body}\n})`), file);
  }
});
