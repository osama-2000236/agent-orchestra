# Bounded playbooks

The installed skill contains the operational references: [app review](../skill/references/app-review.md), [dispatch](../skill/references/dispatch.md), [evidence](../skill/references/evidence.md). Choose only what the current task needs.

1. **Application review:** map actual sections and quality dimensions, then dispatch bounded independent reads within free slots. Trace cross-section lifecycles after the first pass. Preserve findings with source/test evidence; visual and real-hardware criteria need their own artifacts.
2. **Defect-first fix:** reproduce, write a test that fails for the real defect, trace every caller, make the root fix, verify green plus neighbours and compatible old data. A fixture typo is not red proof.
3. **Independent review:** pin the candidate and give a non-author reviewer the diff, rules and acceptance. Prefer a different model/vendor for uncertain high-risk paths when available. Batch blockers into one fix; follow repository review caps and recheck only the final fix after the last round. No blocker is accepted merely because a round cap expired.
4. **Parallel implementation:** disjoint paths, owned worktrees, preassigned test IDs and one integration owner. Exclusive app tests and deployment stay sequential. Preserve other sessions' dirty work.
5. **Evidence-based research:** group related decisions, use primary sources and distinguish stable policy from owner choices. Official model guidance starts a trial; measurements on your complete tasks justify tuning.

`examples/` contains older workflow-runner sketches, not native Claude/Codex APIs or default dispatch policies. Their fixed Haiku/two-skeptic fan-out is illustrative and can be expensive; apply current runtime, budget and risk judgment before adapting them. They were syntax-checked as bodies but no live runner execution is claimed.
