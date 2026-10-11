# Roles and ownership

The lead keeps high-risk decisions and verifies worker artifacts. Model selection is task-dependent; no role has an unconditional cheapest or most-capable default.

| Role | Output | Boundary |
| --- | --- | --- |
| Lead/integration | Scope, decisions, checked gate and final report | Cannot independently approve its own implementation |
| Scout/section reviewer | Locations, coverage, findings with evidence | Read-only, pinned candidate |
| Test writer | Defect-first failing test and actual output | Cannot weaken assertions or fix product logic in the same role |
| Implementer | Bounded diff, callers checked, tests run | Owned paths/worktree; release actions stay with lead |
| Design/accessibility reviewer | Artifact-specific visual/interaction findings | Use user-designated model; wording/source alone cannot certify visuals |
| Independent correctness reviewer | Scenario, evidence and blocking reason | Non-author, exact candidate; empty findings are allowed |
| Researcher | Primary sources, current behavior and choices | Cannot infer unsupported billing, business policy or authorization |

A packet names Goal/Acceptance, commit/diff, rule paths, permitted paths/tools, exclusions, test IDs if relevant, model/effort, time/cost limit, stop condition and output shape. A required secret may be present for the project's test command; the worker must not open, print or transmit it. Read-only workers receive read/search tools, not just a read-only instruction.
