# Benchmarks

Three tiny tasks with one checkable answer each (`TASKS` in `skill/scripts/models.mjs`): locate the buggy line in a
split-the-total function (`find-bug`), extract a total and currency as JSON (`extract`), and judge a diff that removes
a refund permission check (`review-diff`, right answer: BLOCKING with a reason). They measure reliability, speed and
cost per model and effort, cheaply. They do not measure depth: passing them does not prove a model can review a
release, but failing one is enough to keep a model out of that role.

Run on 2026-10-11, Windows 11, Claude Code CLI 2.1.296 in print mode with `--setting-sources local`, no tools. Raw
rows, including each answer and the model that really answered: [benchmarks/2026-10-11.jsonl](benchmarks/2026-10-11.jsonl).

| Model @ effort | Passed | Mean seconds | List-price USD, all runs |
| --- | --- | --- | --- |
| claude-haiku-5-5 @ low | 2/4 | 5.2 | 0.0555 |
| claude-haiku-5-5 @ medium | 2/3 | 5.2 | 0.0148 |
| claude-haiku-5-5 @ high | **4/4** | 6.4 | **0.0088** |
| claude-sonnet-5-5 @ low | 3/3 | 5.7 | 0.0326 |
| claude-sonnet-5-5 @ medium | 3/3 | 7.6 | 0.0154 |
| claude-opus-5-5 @ low | 3/3 | 9.3 | 0.0318 |

What it changed in the skill:

- Haiku 5.5 at low and medium effort answered `CLEAN` for the removed permission check, twice at low; at high it
  answered `BLOCKING: removed the canRefund permission check` both times. Review roles route to Haiku **high**, not low.
- Haiku high passed everything at the lowest cost here; Opus at low effort (the "strongest model, low effort" baseline)
  passed everything at about 3.6x the cost and 1.5x the time.
- Costs include each run's cold cache write: the first request of a run cost $0.017-0.024, later ones $0.0003-0.006.
  That is why merging tiny tasks into one worker is cheaper than many workers.

Failures recorded, not scored: three Opus 5.5 rows failed on an older CLI ("Claude Code 2.1.251 does not support
this model; version 2.1.280 or newer is required") before the update; the Codex rows could not run because the ChatGPT
login had hit its usage limit ("try again at 6:28 PM"). A quota or version failure says nothing about a model's answers.

Reproduce:

```bash
node skill/scripts/orchestra.mjs models update
node skill/scripts/orchestra.mjs bench --targets claude-code:claude-haiku-5-5:low,claude-code:claude-haiku-5-5:high,codex:gpt-6-luna:low
```

Limits: three tasks, one machine, one day, at most four runs per cell. Treat differences of one pass as noise; treat a
model that misses an obvious permission removal as unfit for that role at that effort until it passes again.
