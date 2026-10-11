---
name: model-orchestra
description: Review an application section by section, or coordinate a substantial engineering job across available AI agents with checked evidence, model/effort/budget controls and independent verification. Use for whole-app audits, multi-agent review, model-orchestra requests, or explicit cost-aware delegation. Not needed for routine single-step edits.
---

# Model Orchestra

The lead owns judgment and the final result. Delegation is a means to get useful independent evidence, not a quota of agents to fill. Respect the user's model choices, existing authorization, runtime restrictions and project rules. This skill does not authorize deployment, secret access or a different scope by itself.

## Start with a reviewable scope

Read the repository rules and active handoffs. Preserve other sessions' work; use an owned worktree for changes. Record Goal, Acceptance, current commit, owned paths, budgets and the exact next action in a resumable handoff.

For an entire-app review, make a section-by-section coverage matrix before dispatch. Read [references/app-review.md](references/app-review.md). Include correctness, permissions/security, data compatibility/recovery, reliability, performance, design/accessibility/RTL, test quality, maintainability and release/documentation. Mark every dimension as inspected, exercised, not applicable or blocked with its evidence. “All” means this declared coverage, never a proof that no defect can exist.

Separate stable release acceptance from the audit queue. Triage additional findings by risk and project rules; do not restart a green release gate for every unrelated hardening suggestion. A user who expands the review scope gets an expanded matrix, not an unbounded review loop.

## Pick the runtime, model and effort from evidence

1. Inventory callable agent tools, CLI versions, supported models, permission modes, concurrency and billing basis. Read [references/dispatch.md](references/dispatch.md) for the runtime actually present. Prefer native agents when their required model and tools exist. Use a supported CLI worker when they do not; do not pretend a native model picker offers Haiku.
2. Use exact model versions and supported effort levels. An alias is only a request; attest the returned model metadata. Distinguish requested effort from applied effort when a runtime clamps it.
3. Copy `data/config.example.json` to a local configuration and refresh the cited pricing before a paid-cost decision. `node <skill-dir>/scripts/pair.mjs pick review-ui --config <config> --effort medium --allow-trial --json` creates an offline plan, not a model call. `--allow-trial` means every output is cheaply verifiable; omit it otherwise. Add `--max-task-usd` for an estimated per-request filter; runtime spend caps remain necessary.
4. The planner groups evidence by role, exact model and effort, including verified later misses. Its default compares recorded complete-task costs only when worker, verification and rework accounting is complete and comparable. The example config explicitly chooses `worker-request`, using sourced rates for a hypothetical request and excluding lead costs. Choose `--cost-mode complete-task|worker-request|quality` deliberately. Unknown costs are not cheap. Historical examples do not establish a model's capability; sparse evidence remains a trial, and an observed route is not “proven”. Read [references/evidence.md](references/evidence.md) when changing or recording controls.
5. Use a bounded pilot when quality/cost evidence is absent. Lower effort is suitable for cheaply checked search or wording; raise it only for an observed failure or a documented risk. Official effort guidance is a starting hypothesis, not your project's benchmark. Never claim globally optimal quality or price from one sample.

Money, stock, permissions, security, old-data migration and release verdicts stay the lead's responsibility. `--risk high` therefore returns no delegated decision; reviewers can still provide independent evidence. The author cannot independently approve its own fix. A different vendor is useful when available and justified, but an independent same-model reviewer is still independent of authorship; do not invent vendor diversity.

## Dispatch only work that can be checked

Give each worker a compact packet: goal, pinned commit/diff, repository rules, allowed paths/tools, exclusions, acceptance commands or artifacts, exact output shape, model/effort, time/spend cap and stop condition. Supply minimal context without supplying a first reviewer's desired answer. Read-only agents need actual read/search tools. Say a required test key is present but must not be opened; do not copy or print it for the agent.

Parallelize independent reads and disjoint writes within actual available slots. Shared integration, migrations, approvals and exclusive application tests remain sequential. One writer owns a file at a time; separate worktrees and preassigned test IDs prevent collisions. A reviewer uses a pinned detached tree, not a moving writer tree. New native agents are not automatically authorized by the presence of this skill; follow the host's delegation rules.

Design work follows the user's designated design model. Include screenshots/reference, viewport and theme/language coverage, keyboard/accessibility evidence and design intent. A wording-only Haiku pass is not evidence about the whole layout. If screenshots or a browser are unavailable, mark visual checks unverified.

Output: `id, section, dimension, priority, file:line, scenario, evidence, proposed check, blocking reason`. An empty finding list is valid. Require limitations and candidate/model attestation alongside findings.

## Verify, repair and finish

Reproduce a finding before declaring it confirmed. Verify every cheap worker's claim; review its diff and all callers. For money/stock/permission or migration defects, confirm a test fails for the actual defect before the fix, then verify green plus lifecycle/neighbour/old-data checks. Never hide a failure with weaker validation, edited expectations or expected-failure marks.

Fix a review round's blockers together. Follow the project's review cap; absent one, use two bounded rounds and a focused recheck of the last fix. New blockers introduced by that fix still need resolution; a round limit does not make a defect acceptable. Record unrelated findings in the queue with evidence. Run required gates on the final candidate once; broaden testing only when new failures or changed scope justify it.

Report a worker/runtime failure immediately and continue independent work. Correct a malformed invocation once; after repeated auth/quota/model/sandbox failure, checkpoint that path and use a permitted fallback or the lead. Never silently substitute a requested model, bypass permissions, discard partial edits or label an unrun check passed. A shared quota outage is not evidence against a model's reasoning quality.

Finish the authorized merge, push, packaging/publication and cleanup required by the project. Preserve other work, secrets and running user applications. Report concrete checks, residual risks and blocked external requirements; confidence comes from evidence, not “100%” rhetoric.

## Learn on every invocation, without accumulating dogma

Before reporting, append checked outcomes to your local ignored ledger using `pair.mjs log --file <outcome.json>`. Record failures and lead verification cost/time too. Empty reviews are not confirmed claims. Capture one judgment: what reduced total work, what caused rework, and whether a routing change is supported. Read [references/evidence.md](references/evidence.md).

Keep a proposed change local until it survives a relevant evaluation and independent review. Do not rewrite the installed skill automatically after every task. Promote a narrow rule with its evidence, expiry/recheck condition and scope; roll it back when counterevidence appears. The right improvement may be no change. Never upload private ledgers or project details without authorization.
