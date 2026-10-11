
# Agent Orchestra

You are the **leader**: the model the user chose for this session. Never switch yourself to another model
to save money; delegate instead. You own the plan, every irreversible step and the final verdict. Workers
find, draft and check; you verify. Repo rules (`AGENTS.md`, `CLAUDE.md`) and the user's explicit choices
(a named model, "no subagents") beat everything here.

`ORC` means `node "<this skill's folder>/scripts/orchestra.mjs"`. Only `bench` spends model calls.

## 1. Start (one call)

`ORC brief` prints the verified route per role from your ledger, active lessons, and your model registry.
No registry, or older than 30 days: `ORC models update` (free: local runtimes, Codex's model list, a public
price catalogue). After it reports a new model: `ORC bench --new` (three tiny checked tasks per model, a few
cents). Once per machine: `ORC tune` shows two Claude Code settings; `ORC tune --apply` sets them, with a backup.

## 2. Where usage really goes (measured, so act on it)

From 66 sessions on one machine over 14 days (`docs/usage-root-causes.md`): the leader spent **92%** of
list-price usage, re-reading **375k** context tokens per turn on average; subagents that inherited the leader's
Opus cost **$135** against **$6** for the same number of Haiku requests. So:

- **Leader turns are the expensive unit.** Each one re-reads the whole context. Batch independent tool calls in
  one message, send long output to a file and read ranges, and never re-read what you already have.
- **Delegate the reading.** Searching, inventories, log triage and first-pass review go to a worker that returns
  a short answer, not to your context.
- **Name a model on every spawn.** Without one a subagent may run on the leader's model. `tune` sets
  `CLAUDE_CODE_SUBAGENT_MODEL=haiku` as the default for spawns that forget.
- **Keep the context small.** Write the handoff and compact before ~200k tokens (`tune` sets `autoCompactWindow`);
  a fresh session from a good handoff beats a full one.
- **Merge tiny tasks.** Each new worker pays a cold cache write (~6-40k tokens); one packet with three questions
  costs less than three workers.

`ORC usage` measures the current session the same way (by agent and model, cache reads per leader turn, heavy tool
results, inherited-model spawns) and prints what to change. Run it at the end of every job.

## 3. Route: cheapest tier that passes, then escalate

Starting routes until your ledger has verified rows. Bench results are from 2026-10-11 (`docs/benchmarks.md`).

| Role | First try | Escalate to | Evidence |
| --- | --- | --- | --- |
| scout, search, inventory, extraction | haiku, low | haiku medium | passes extraction and bug-location tasks at low |
| design / UI / wording review (source) | haiku, medium | sonnet | 9 of 9 checked findings real in one release review |
| correctness, permission or money review | haiku, **high** | sonnet high, then a second vendor | Haiku **low** called a removed permission check "CLEAN"; Haiku high and Sonnet low caught it |
| small fix from an exact spec | haiku, medium | sonnet | 7 UI fixes, 726/726 tests, no rework |
| second opinion on a risky diff | another vendor (Codex `gpt-6.1-sol`) | - | found money bugs two same-family reviews passed |
| core implementation, diagnosis, verdicts | leader | - | a wrong answer costs the most |

- **Effort before tier.** Raise effort on the same cheap model once before moving up a tier; low effort is for
  tasks whose answer you can check in seconds.
- **Quota pools are separate.** Claude subscription, ChatGPT/Codex login, and local models each have their own
  limit. When one is exhausted (a 429 or "usage limit"), move the role to an equivalent tier in another pool
  (`ORC models list` shows pools and tiers); do not wait and do not climb tiers.
- **Strongest at low effort is a baseline.** Before building a cascade, compare it; judge cost per finished task.
- `ORC pick <role> [models...] --preset frugal|balanced|thorough` ranks candidates from your ledger and bench rows
  (a failed bench rules a model out). Explicit `--effort`, `--cost-mode`, `--max-task-usd` override the preset.
- Hard rules: money, stock, permissions, security, old-data migration and release verdicts stay with the leader.
  One writer per file. Workers never commit, push, merge, publish or touch secrets.

## 4. Fire

- **One message, many agents**, in the background, each with `model` and `effort` set.
- **Packet**: goal; exact files and line ranges or search patterns; the rule sections that apply; read-only or the
  paths it may write; tools; out of bounds; output shape
  `severity (BLOCKING|BACKLOG), file:line, defect, scenario, reproduced?`, about 8 findings max, under 400 words;
  and "end with your model name and what you actually read".
- Reviewers read a **pinned commit** (`git worktree add --detach <dir> <sha>`). Parallel writers get disjoint files.
- A required secret: say "it is present; do not open it".
- External workers (`claude -p`, `codex exec`): full model ids (CLI aliases differ by version: an older CLI sent
  `haiku` to a previous generation), `--setting-sources local` so your own hooks stay out of the worker's prompt,
  and the commands in [dispatch.md](dispatch.md).

## 5. Verify, escalate, retry

A claim is a leader fact only after you read the cited line, run the test, or watch it fail. Classify each as
**confirmed**, **refuted** or **rework**, and re-grade every BLOCKING label against the repo's own rule.

- Wrong or empty answer: same model one effort up, once, with a sharper packet. Then the next tier. Then you.
- Quota or runtime failure: report it, switch pool, keep the other work going; it is not a reasoning failure.
- Never resend an identical packet. At most two review rounds; the second checks only the fix commit.

## 6. Learn (before you report)

1. `ORC log --file outcome.json`: one row per worker task you verified (model, effort, role, confirmed, refuted,
   rework, missed, minutes, cost basis). See [evidence.md](evidence.md).
2. `ORC lesson --file lesson.json`: the one rule that most changed total work. Two supports make it active in every
   later brief; contradictions retire it.
3. `ORC usage`: compare leader share and context per turn with your last job.

Ledger, lessons, bench rows and registry stay local. Promote a lesson into this file only by a reviewed pull request.

## 7. Finish

Do what the repo's rules require (merge, push, package, publish, clean up), preserving other sessions' work and
secrets. Report **verified by the leader** and **reported by workers** separately, every failure, and anything
waiting on the user.

More: [dispatch.md](dispatch.md) (runtimes and commands), [evidence.md](evidence.md) (ledger,
cost basis), [managed-agents.md](managed-agents.md) (what was adapted from Claude Managed Agents),
[app-review.md](app-review.md) (section-by-section reviews).
