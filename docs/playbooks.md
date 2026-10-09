# Playbooks

Five step-by-step recipes. Each one assumes the lead model has frozen a Goal and an Acceptance check
before starting (see [roles.md](roles.md) for who does what, and [cost-model.md](cost-model.md) for how
the model picks are made).

## 1. Audit fan-out with skeptics

Use it to find defects across a codebase, a set of pull requests, or a backlog, without letting one model's
guess become a fix.

1. **Freeze the scope.** Name the paths, the pull requests or the time window. Pin the commit every worker reads.
2. **Fan out.** One read-only auditor per area (four to six areas), in one parallel batch. Each returns findings
   as `id, kind, severity, claim, evidence, fix`. Evidence is `file:line` or a quoted line. An empty list is a valid answer.
3. **Verify the serious ones.** Every finding with severity `blocking`, `money`, `stock` or `permission` gets two
   skeptics. Each skeptic opens the cited code and tries to refute the claim. A skeptic who cannot give concrete
   counter-evidence says `refuted: false`.
4. **Keep the survivors.** A finding survives while at least one skeptic cannot refute it. A finding with no
   skeptic answer is kept and marked unverified, not dropped.
5. **Lead check.** The lead reads every surviving blocking claim and reproduces it before it becomes a job.
6. **Plan.** One planner orders the survivors into at most six jobs: documentation first, then money, stock and
   permission defects (one job each, with the failing test to write first), then efficiency, then cleanup. The
   planner drops what is unverified or cosmetic and names what needs a human decision.

Example: [`examples/audit-fanout.js`](../examples/audit-fanout.js).

**Ledger.** Log each auditor as `scout` and each skeptic-confirmed finding as a confirmed claim.
Log a refuted finding as refuted, with the skeptic's evidence in `note`.

## 2. Defect-first fix loop

Use it for every fix to money, stock, permission, or any path with a known regression.

1. **Reproduce in a scratch script.** Use real numbers, and explicit clocks rather than the real clock.
   Write the reproduction under a scratch folder outside the repo.
2. **Write the failing test.** A test-writer (cheap model) writes a test that fails today and asserts the correct
   behaviour. It goes in the test file the repo uses, with the next free id.
3. **Lead confirms red.** Run the test. It must fail for the stated reason, not for a typo.
4. **Fix at the root.** Before you edit, grep every caller of the function you are changing. A guard in the shared
   function is smaller than a guard in each caller, and it covers the siblings the report did not mention.
5. **Green and the neighbours.** Run the new test, then every test that touches the changed lines. Check that old
   data still loads.
6. **Review.** Go to playbook 3.

Rules that hold throughout: never weaken a validation to make a test pass; never edit an expectation to match
new output; never mark a failing test skipped or expected-to-fail to get green. If a failure is real and out
of scope, write it into the backlog with its evidence.

Example: [`examples/repro-batch.js`](../examples/repro-batch.js) runs steps 1 and 2 for a batch of items, with a
skeptic on every REAL verdict.

## 3. Bounded two-round review

Use it for every change that touches money, stock, permissions, security or data.

1. **Pin the commit.** Create one detached worktree per reviewer:
   `git worktree add --detach <tmp-dir> <sha>`. The writer keeps working on the branch.
2. **Round one, in parallel.** At least two reviewers:
   - a cheap same-family reviewer (for example Haiku-class), and
   - a second-vendor reviewer in read-only mode on the same pinned commit, for money and permission diffs.
   Both receive the diff, the repo rules, and the output shape `file:line - claim - evidence - blocking?`.
3. **Classify.** The lead reproduces each claim and marks it confirmed, refuted (wrong, or by design) or rework.
4. **Fix the blockers together.** Blocking means: it breaks a repo rule, makes money, stock or permission wrong on a
   path the diff changed, stops an old book from opening, or turns a test red. Fix all of them in one commit, with
   their failing tests first.
5. **Round two, the fix commit only.** The same reviewers see only the fix commit. What they find is blocking under the
   same definition. Nothing from round one is reopened.
6. **Stop.** After round two, everything else goes to a backlog line with the reviewer's evidence. There is no third round
   unless the user asks for one.

If the same finding comes back a third time, or a step is stuck for an hour: write what was tried, take the
narrower fix or ask the user. Do not keep circling.

## 4. Parallel slices in worktrees, with integration

Use it when the job splits into independent parts that touch different files.

1. **Slice by file.** Each slice owns its files. Two slices never write the same file.
2. **Pre-assign ids.** Give each slice its own block of test ids before dispatch ("ids FX-U39 to FX-U40 are yours").
   Otherwise the slices collide on merge.
3. **One worktree and branch per slice.** Each writer works in its own worktree.
4. **Integrate in one place.** The lead merges the slices in order. When a merge joins two appended blocks, check
   that shared closing braces survived. Read each merge diff.
5. **Test the joins.** Run the tests that touch the joined files, then the full suite once.

## 5. Research by market practice

Use it for policy questions that a product must answer ("what happens when a cheque bounces after commission was paid?").

1. **Cluster the questions.** Group related questions so one researcher can cover a cluster.
2. **Research.** Each researcher reads vendor documentation first, and blogs last. Every claim carries a source URL.
   A page read only through a search summary is flagged as such.
3. **Read the repo.** Each researcher also reads how the product behaves today, with `file:line`.
4. **Decide.** Recommend what most of the named products do. If they disagree, recommend the most conservative correct option.
5. **Synthesize** into one table: choice, evidence, whether it changes code, and the slices that implement it.
6. **Lead decides.** Anything that needs a legal or tax ruling, or a business preference, goes to the user with the options.

Example: [`examples/market-research.js`](../examples/market-research.js).
