import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {brief, lessonStatus, validateLesson, PRESETS} from '../skill/scripts/pair.mjs';

const lesson = (outcome, values = {}) => ({id: 'pin-reviewer-commit', rule: 'reviewers read a pinned commit', evidence: 'job 1', outcome, ...values});
const row = (model, role, values = {}) => ({task: 't', role, model, effort: 'medium', verified: true, candidate: 'abc', evidence: 'lead check', confirmed: 4, refuted: 0, rework: 0, ...values});
const script = path.resolve('skill/scripts/pair.mjs');
const pair = (args, env = {}) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', env: {...process.env, ...env}});

test('a lesson needs two supporting jobs to become active, and contradictions retire it', () => {
  assert.equal(lessonStatus([lesson('support')])[0].status, 'provisional');
  assert.equal(lessonStatus([lesson('support'), lesson('support')])[0].status, 'active');
  assert.equal(lessonStatus([lesson('support'), lesson('support'), lesson('contradict'), lesson('contradict')])[0].status, 'retired');
  assert.equal(lessonStatus([lesson('support'), lesson('support'), lesson('contradict')])[0].status, 'active');
});
test('malformed lessons are refused before they are written', () => {
  assert.throws(() => validateLesson(lesson('maybe')), /support or contradict/);
  assert.throws(() => validateLesson(lesson('support', {id: 'Not Kebab'})), /kebab-case/);
  assert.throws(() => validateLesson(lesson('support', {evidence: ''})), /evidence is required/);
});
test('brief picks the best verified route per role and ignores unverified rows', () => {
  const rows = [row('haiku', 'review-ui'), row('sonnet', 'review-ui', {confirmed: 1, refuted: 3}), row('opus', 'review-core', {verified: false})];
  const out = brief(rows, [lesson('support'), lesson('support')]);
  assert.deepEqual(out.roles.map(r => [r.role, r.model]), [['review-ui', 'haiku']]);
  assert.equal(out.lessons.active.length, 1);
});
test('a role whose every route is below the quality floor stays with the lead', () => {
  const out = brief([row('haiku', 'review-core', {confirmed: 0, refuted: 5})]);
  assert.equal(out.roles[0].model, 'lead');
});
test('presets set effort, cost mode and trial permission, and explicit flags win', () => {
  assert.deepEqual(PRESETS.frugal, {effort: 'low', costMode: 'worker-request', allowTrial: true});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra preset '));
  try {
    const ledger = path.join(dir, 'ledger.jsonl');
    fs.writeFileSync(ledger, JSON.stringify(row('cheap', 'review-ui', {effort: 'low'})) + '\n');
    const frugal = JSON.parse(pair(['pick', 'review-ui', 'cheap', '--preset', 'frugal', '--json'], {SUBAGENT_ORCHESTRA_LEDGER: ledger}).stdout);
    assert.equal(frugal.effort, 'low');
    assert.equal(frugal.costMode, 'worker-request');
    assert.equal(frugal.pick, 'cheap');
    const explicit = JSON.parse(pair(['pick', 'review-ui', 'cheap', '--preset', 'frugal', '--effort', 'high', '--json'], {SUBAGENT_ORCHESTRA_LEDGER: ledger}).stdout);
    assert.equal(explicit.effort, 'high');
    assert.notEqual(pair(['pick', 'review-ui', '--preset', 'cheapest']).status, 0);
  } finally { fs.rmSync(dir, {recursive: true}); }
});
test('lesson and brief commands round-trip through a local file on a path with spaces', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra lessons '));
  try {
    const file = path.join(dir, 'lesson.json'), lessons = path.join(dir, 'lessons.jsonl'), env = {SUBAGENT_ORCHESTRA_LESSONS: lessons, SUBAGENT_ORCHESTRA_LEDGER: path.join(dir, 'none.jsonl')};
    fs.writeFileSync(file, JSON.stringify(lesson('support')));
    assert.equal(JSON.parse(pair(['lesson', '--file', file], env).stdout).status, 'provisional');
    assert.equal(JSON.parse(pair(['lesson', '--file', file], env).stdout).status, 'active');
    const out = JSON.parse(pair(['brief', '--json'], env).stdout);
    assert.equal(out.lessons.active[0].id, 'pin-reviewer-commit');
    assert.deepEqual(out.roles, []);
  } finally { fs.rmSync(dir, {recursive: true}); }
});
test('a preset name inherited from Object is refused', () => {
  assert.notEqual(pair(['pick', 'review-ui', '--preset', 'toString']).status, 0);
});
