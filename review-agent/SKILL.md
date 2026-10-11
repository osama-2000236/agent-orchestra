---
name: review-agent
description: Perform a defect-first review of code changes or an entire application with explicit evidence and quality coverage. Default to read-only independent review; coordinate subagents or implement fixes only when the user explicitly requests those modes.
---

# Review Agent

Select the requested mode, not the broadest possible mode. Read applicable repository rules and preserve the user's authorization and exclusions.

## Independent change review (default)

Inspect the target directly. Do not modify files, commit, push, post comments or delegate this independent opinion unless the request explicitly authorizes a coordinating role. A reviewer asked by another agent to inspect a diff remains a read-only non-author reviewer.

Inspect the complete diff and enough callers, tests and supported data shapes to demonstrate every actionable regression. Continue through the whole target after the first finding. For a base-branch review, resolve the local comparison branch/upstream, prefer its upstream when ahead, compute `git merge-base HEAD <comparison-ref>`, then inspect the change that would actually merge. Try a configured upstream before declaring a local ref unavailable.

Flag a change-review issue only when it is introduced by this diff, discrete and meaningful, demonstrated from a real scenario/call path, and likely worth fixing. Include correctness, security/permissions, reliability, compatibility, performance and maintainability; inspect design/accessibility when the diff changes the interface and real artifacts are available. Do not invent defects, reopen unrelated old paths or turn taste into a regression.

## Entire-application review

When explicitly asked to review the whole app, map its actual sections across [the quality dimensions](references/app-review.md). The scope includes existing actionable defects, not only a recent diff. Mark source inspection, executed checks, unavailable evidence and remaining uncertainty separately. Cross-section joins and old data need concrete attention. No wording-only or source-only pass proves the rendered interface or real hardware behavior.

Keep this mode read-only unless fixes are requested. If the user requests fixes, coordinate the defect-first implementation, verification and authorized finish described below; preserve an independent non-author review before release.

## Coordinating or fixing, when explicitly requested

Read [the orchestration workflow](references/orchestration.md). It covers available native/CLI agents, exact model/effort/cost controls, scoped section workers, bounded learning and required project gates. Read [dispatch](references/dispatch.md) only for the runtime used and [evidence controls](references/evidence.md) when choosing or recording model/effort/cost options.

Follow the user's designated design model. Do not silently substitute it on quota failure; preserve its partial artifacts and continue independent sections. The presence of this skill never supplies missing authorization for agent spawning, secret access, deployment or external messages.

## Return evidence and judgment

Findings first, ordered by severity, one issue each:

`[P1] Imperative finding title — path/to/file:line`

Explain the concrete scenario, consequence and evidence in a short paragraph. Cite a minimal relevant location overlapping the diff for change review; whole-app findings cite the current responsible path. P0 is a universal/critical release blocker, P1 urgent, P2 ordinary, P3 low impact but actionable. “No findings.” is valid.

Finish with the actual candidate, checks run, material gaps/risks and a brief evidence-based judgment. A non-author read-only reviewer returns that judgment for the lead to record; it does not write a ledger or mutate the skill. In an authorized coordinating mode, record checked outcomes locally and promote only independently evaluated improvements. No proof of exhaustive correctness or cheapest/best model quality is implied.
