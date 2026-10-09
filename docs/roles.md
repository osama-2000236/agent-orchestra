# Roles

A role is a bounded job with a fixed output shape. The lead assigns each role to the model with the best
verified record for it (see [cost-model.md](cost-model.md)). The defaults below are the starting point, before
the ledger has rows for a role.

| Role | Job | Output | Default model | Must not |
| --- | --- | --- | --- | --- |
| **lead** | Plans, decides irreversible calls, verifies every claim, gives the verdict | Plan, decisions, report | The most capable model you have | Hand off verdicts on money, stock, permission or security |
| **scout** | Reads code and reports where things are, with evidence | Findings with `file:line` | Cheapest model with a proven score | Edit files, run the test suite |
| **test-write** | Writes a reproduction and a test that fails today | Test file and its red output | Cheap model (Haiku class) | Fix the defect it found |
| **implement-core** | Makes a root-cause fix to logic that moves money, stock, permissions or data | Diff, tests run, caller check | Lead for money and permission; cheap model with a second reviewer otherwise | Commit, push, merge |
| **implement-ui** | Makes a bounded change to screens, styles and labels | Diff, UI test run | Cheap model for small changes | Touch core files in the same round |
| **implement-docs** | Edits documentation only | Diff, checks run | Cheap model | Change behaviour or rules |
| **review-core** | Reviews logic on a pinned commit | Findings with `file:line` and `blocking?` | Cheap model, plus a second vendor for money or permission diffs | Review a moving tree |
| **review-ui** | Reviews screens and styles on a pinned commit | Findings with `file:line` and `blocking?` | Cheap model | Review core logic |
| **research** | Researches how established products behave, with sources | Decisions with URLs | Cheap model with web access | Decide policy on its own |
| **diagnose** | Finds the root cause of a failure that is not obvious | Cause, proof, fix proposal | Lead | Patch before the cause is proven |
| **design** | Proposes an interaction or a layout for an open question | Options with trade-offs | Lead, with a cheap model as a second view | Add rules the owner did not ask for |
| **log-triage** | Sorts a failing log into causes | Groups with the first failing line | Cheap model | Decide which cause is the real one |

## Notes on the roles

- **implement-core** is the role where cheap models most often need a second look. In the example ledger, four
  of ten Haiku core-fix tasks needed a rework round after review. Each was caught before it merged. That is why a
  cheap core fix always gets a second reviewer.
- **review-core on a second vendor** is for blind spots. The ledger does not show that the second vendor is more accurate
  overall. In the example data its score is close to the cheap reviewer's, and the cheap reviewer wins the pick. The second
  vendor is kept on money and permission diffs. It caught a cost leak that the cheap UI reviewer missed, and in round two it caught a regression, in a fully offset foreign-currency debt, that a round-one fix had introduced.
- **diagnose** and **design** have few rows in most ledgers. Treat their picks as the lead's judgement until the ledger
  has three or more checked claims.
- The roles `implement-docs`, `design` and `log-triage` are not in the README table. They appear in the example ledger
  and are listed here so the rows make sense.

## Worker prompt checklist

Every worker prompt has:

1. the exact files and line ranges it may read or change;
2. the frozen Goal and Acceptance it serves;
3. the repo's rules file path, and the things it must never do;
4. the tools it needs, named in the prompt;
5. the output shape, with an empty answer allowed;
6. for parallel writers, the test ids reserved for it;
7. for a copied secret, the words "present, do not open it".
