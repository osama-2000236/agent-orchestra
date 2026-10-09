---
name: model-orchestra
description: Orchestrate several AI models by role and by evidence. Use when the user says "orchestrate models", "combine models", "cut AI cost", "multi-agent review", "pair Opus with Haiku", "use a second vendor to review", or names model-orchestra. One lead model plans and verifies; cheaper models scout, write tests and implement bounded slices; an independent second vendor reviews a pinned commit. Every outcome is logged so the next model pick is based on evidence. Not for single-step edits.
---

# model-orchestra: roles by evidence

One **lead** (this session) owns the plan, every irreversible call and the final verdict. Workers get bounded
roles. Who gets which role comes from `scripts/pair.mjs` and `data/ledger.jsonl`, which hold verified outcomes
from past jobs, not from reputation. Every job writes its outcomes back, so the next pick is sharper.

`PAIR` below means `node "<skill-dir>/scripts/pair.mjs"`.

## 1. Start

1. Read the repo's rules file (`AGENTS.md`, `CLAUDE.md`, or similar). Repo rules beat this skill.
2. Freeze **Goal** and **Acceptance** before any edit. Each acceptance check names the command that proves it.
3. Split the job into roles. For each role run `PAIR pick <role> <candidates...>`:
   - `proven` top pick: assign it. The lead verifies its output at the normal level (section 3).
   - `trial` (fewer than 3 checked claims): assign only when verification is cheap. The lead checks **every** claim.
   - Score below 0.6: the lead keeps the role, or picks the next candidate.
4. Hard rules override the score:
   - Money, stock, permissions, security, data migration, posted history and release verdicts: the lead decides
     and verifies, whoever wrote the first draft.
   - One writer per file at a time. UI files and core files never share a writer in the same round.
   - Workers never commit, push, merge, package, delete, or touch secrets.

## 2. Dispatch

| Runtime | How |
| --- | --- |
| Claude models | `Agent` tool with `model: haiku`, `sonnet`, `opus` or `fable`. Pin it, and check the returned metadata names the same model. |
| Second vendor (for example Codex CLI) | Read-only review on a pinned commit (see below). |

Every worker prompt carries:
- exact files and line ranges, and the frozen Acceptance;
- the repo rule paths, and what is out of bounds (frozen directories, secrets);
- the tools it needs. Read-only workers still need Read, Grep and Glob. A missing tool list has failed a whole dispatch;
- the output shape: `file:line - claim - evidence - blocking?`.

Parallel writers on separate branches get their test ids pre-assigned ("ids FX-U39 to FX-U40 are yours"). Otherwise
they collide on merge. When a merge joins two appended blocks, check that the shared closing brace survived.

If a secret (a signing key, a token) is needed for tests, say "it is present, do not open it". "Never open X" alone
makes a worker skip the runs.

Independent roles go out in one message, in parallel.

**Reviewers review a pinned commit, never a moving tree.** Give each reviewer its own detached worktree:
`git worktree add --detach <tmp-dir> <sha>`. The writer can keep editing the branch while the reviewer reads.

**Second vendor, read-only.** Run the vendor's CLI in its read-only sandbox mode, from the detached worktree, with the
review packet as the prompt. Use `codex exec` for Codex CLI, and check the flags for your installed version with
`--help`. Ask for findings in the same output shape. Use it on money, permission and security diffs, where a
same-family reviewer is most likely to share a blind spot. Run it at a moderate effort, not the maximum.

## 3. Verify (the lead, always)

- A claim is not a fact until the lead reproduces it: read the cited line, run the test, or write the failing test.
- Code from a worker: read the diff, run the tests it touches. Defect-first: the failing test exists before the fix.
- Classify each claim: **confirmed** (right), **refuted** (wrong, or a "defect" that is by design), **rework**
  (accepted, but the lead had to fix it).
- Blocking findings: fix them together in one commit. At most two review rounds. Round two reviews only the fix commit.
- Anything else goes to a backlog line with the reviewer's evidence.

## 4. Record evidence (before reporting)

For every worker task, one line:

```
PAIR log '{"project":"<repo>","task":"<what>","model":"haiku","role":"review-core","confirmed":3,"refuted":2,"rework":0,"minutes":6,"note":"<what was wrong and why>"}'
```

Log the lead's own roles too (`opus` with `implement-core` or `diagnose`). The lead is a candidate like any other.
Orchestrator mistakes (a bad prompt, a missing tool) go in `note`, not against the model. `PAIR stats` shows the table.

## 5. Report

What merged or changed, the counts the lead ran, and two lists: **verified by the lead** and **reported by workers**,
each with how it was checked. Name anything waiting on the user.

## 6. Playbooks

Step-by-step versions are in `docs/playbooks.md` of the repository. The short forms:

1. **Audit fan-out with skeptics.** Freeze the scope (paths, PRs, time window). Run 4 to 6 read-only auditors in
   parallel, one per area, each returning findings with evidence. Each serious finding (blocking, money, stock,
   permission) gets two skeptics. A skeptic tries to refute it with concrete evidence from the code. A finding
   survives while at least one skeptic cannot refute it, and the lead checks every surviving blocking claim. A planner
   then orders the survivors into at most six jobs: money, stock and permission first; drop what is unverified or cosmetic.
2. **Defect-first fix loop.** Reproduce the defect with a scratch script. A test-writer writes a test that fails today and
   asserts the correct behaviour. The lead confirms the test is red. An implementer makes it green with the smallest
   fix, found at the root: grep every caller first. Never mark a failing test as skipped or expected-to-fail to get green.
3. **Bounded two-round review.** Round one: two or more reviewers in parallel, each on a detached worktree of the
   pinned commit (one Haiku-class, one second vendor for money or permission diffs). The lead classifies each claim.
   Blocking findings are fixed in one commit with their failing tests. Round two reviews only that fix commit. What
   remains goes to the backlog. No third round unless the user asks.
4. **Parallel slices in worktrees.** Split the job into slices on disjoint files. Each slice gets its own branch and
   worktree, and pre-assigned test ids. The lead integrates them in one place, reads each merge, and runs the
   tests that touch the joined files.
5. **Research by market practice.** One researcher per decision cluster, using vendor documentation first and blogs
   last, with the source URL for every claim. Recommend what most leading products do, or the most conservative
   correct option when they disagree. The lead decides. Anything that needs a legal or tax ruling goes to the user.

## 7. Failure handling

- A second vendor can fail for reasons outside the task: a broken sandbox (every command refused, or an
  "insufficient evidence" result in about 30 seconds) or a dropped connection (reconnect loops, timeouts).
- Probe before you plan on it: send a trivial packet ("run node --version") at low effort. If it fails, tell the user.
- Retry once. If the retry fails, take the next ledger pick for that role, and tell the user which model you used and why.
- Never report a result you did not get. A step that did not run is reported as not run.

## 8. Cost guidance

- Scouts, test-writers, UI reviewers and small UI implementers: the cheapest model with a proven score.
- Money, permission and security review: a second vendor, on the pinned commit, in addition to a cheap reviewer.
- Core money and permission logic, root-cause diagnosis, verdicts: the lead.
- Haiku-class core fixes often miss a sibling path. Give every cheap core fix a second reviewer and budget for a rework round.
- The ledger's `COST` weights are relative guesses. Replace them with your own price ratio in `scripts/pair.mjs`.
- Score ties: within 0.08, `pair.mjs` picks the cheaper model. The hard rules still apply.

## Starting defaults (used when the ledger has no row)

| Role | First choice | Why |
| --- | --- | --- |
| scout, log-triage, review-ui, implement-ui (small) | haiku | cheap and wide; the lead verifies |
| review-core, test-write | haiku, plus a second vendor for money or permission diffs | a second view on correctness |
| implement-core, diagnose, design decisions | lead | a wrong answer costs the most |

The ledger overrides these defaults as soon as it has verified outcomes for a role.
