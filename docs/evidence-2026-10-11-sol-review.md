# Evidence: a GPT-6.1 Sol section review of a released app (2026-10-11)

One job, measured. The leader (Claude Opus 5.5) reviewed SmartStore Pro 3.65.2 (an Electron accounting app, main
`31e5140`) section by section with this skill: GPT-6.1 Sol through `codex exec` (ChatGPT pool, medium effort,
read-only, pinned detached worktree) on sales money, payroll and permissions; Claude Haiku 5.5 at high effort on
permissions, stock and the screens. Every claim was checked by the leader against the code; confirmed money defects
were reproduced by a failing test before the fix and shipped as 3.65.3.

## What each worker found

| Worker | Section | Seconds | Input tokens (cached) | Output | Confirmed | Backlog / owner | Refuted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.1-sol medium | sales money | 165 | 1.38M (1.29M) | 4.2k | 2 blocking | 0 | 0 |
| gpt-6.1-sol medium | payroll | 167 | 1.15M (1.06M) | 4.7k | 4 blocking | 0 | 0 |
| gpt-6.1-sol medium | permissions | 225 | 2.18M (2.04M) | 5.1k | 0 | 1 (owner policy) | 0 |
| claude-haiku-5-5 high | permissions | ~480 | 169k | - | 0 | 3 (one re-graded from BLOCKING) | 0 |
| claude-haiku-5-5 high | stock | - | - | - | 0 | 2 | 0 |
| claude-haiku-5-5 high | screens | - | - | - | 0 | 5 | 0 |

The six confirmed defects, each with a test that failed first: a customer's cheque endorsed onto a foreign-currency
supplier bill at carrying value; a sale deleted after a partial return took back loyalty points twice; hourly overtime
paid in the base and again at 150%; a paid leave day marked absent also deducted; overtime earned on absent rows; the
commission and advance cutoffs dropping the last hour of a 25-hour DST day. Earlier same-family reviews of the same
code had passed all six.

## What changed in the skill

- **Codex on Windows needs `-c windows.sandbox='"unelevated"'`.** With the `elevated` sandbox from the user's config,
  all three first Sol runs had every shell call fail ("helper_unknown_error"): one answered "Review blocked" after
  130k input tokens, two kept reasoning blind. `orchestra.mjs inspect --file run.jsonl` now reports
  `errorKind: sandbox` for such a run, and dispatch.md says to probe with one tiny packet first.
- **`--help` never spends.** `orchestra.mjs bench --help` ran a paid bench of every unbenched model; any command with
  `--help` or `-h` now prints usage only.
- **A fourth bench task, `trace-money`,** built from the loyalty defect. The first three tasks separate only Haiku at low
  effort from the rest (`benchmarks.md`). On this one, one sample each: Haiku 5.5 low answered BLOCKING for the wrong reason ("no guard
  against negative or NaN points") while Haiku high, Sonnet low, GPT-6-Luna low and GPT-6.1-Sol low named the
  double take-back. The first check matched "again" inside "against" and passed Haiku low; the check now needs whole
  words, and that row is re-scored as a fail.
- **A worker's self-report is not attestation.** Sol signed every report "GPT-6"; the model comes from the runtime's
  events.

## Cost basis

Codex reports tokens, not dollars. A Sol section review read 1.2-2.2M input tokens, 92-94% cached, and wrote 4-5k;
it drew the ChatGPT quota, not Claude's. At the public catalogue rate ($2 in / $10 out per million, cached input at a
tenth) one review is roughly $0.40-0.75 list-price equivalent. Haiku high on the same permissions packet read 169k
tokens and found no defect Sol missed; Sol found every confirmed money defect of this job.
