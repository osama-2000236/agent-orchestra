# Architecture

Agent Orchestra is a set of small Node scripts with no dependencies, plus the `SKILL.md` instructions that the leader
model reads. The scripts decide and measure; the leader decides what to run and verifies what comes back.

## Modules

All scripts are in `skill/scripts/`.

| Module | Role | Main exports |
| --- | --- | --- |
| `orchestra.mjs` | Entry point. Handles `usage`, `models`, `bench` and `tune` itself; every other command goes to `pair.mjs`. | `main`, `tune`, `TUNE`, `DATA` |
| `pair.mjs` | Offline routing, the ledger and lessons. `plan` ranks candidates for `pick`; `brief` summarises routes and lessons; `log`, `lesson`, `stats` and `inspect` validate and store rows. Never starts a model. | `plan`, `brief`, `validateRow`, `validateLesson`, `lessonStatus`, `tally`, `estimateCost`, `inspectReport`, `PRESETS`, `EFFORTS` |
| `usage.mjs` | Measures Claude Code transcripts (`~/.claude/projects/`): tokens by agent and model, cache reads per leader turn, compactions and heavy tool results. Reads only. | `sessionReport`, `scan`, `price`, `diagnose`, `latestSessions`, `projectDir` |
| `models.mjs` | Discovery of runtimes and models, the public price catalogue, the registry with history, and the bench. | `discover`, `catalogue`, `catalogueId`, `tierOf`, `buildRegistry`, `diffRegistry`, `saveRegistry`, `rollback`, `TASKS`, `bench` |

`orchestra.mjs` also writes `data/models.json` and `data/bench.jsonl`; `pair.mjs` reads them. The data files are described
in [configuration.md](configuration.md).

## Data flow

```text
claude / codex / ollama / LM Studio / provider APIs ──discover──> data/models.json (registry)
OpenRouter catalogue ──────────── prices ─────────────────────────^      │ history/ keeps each old version
data/overrides.json ───────── merged per key ───────────────────────────┘
                                                                         │
bench (model calls) ──────────────> data/bench.jsonl                     │
verified worker tasks ──log──────> data/ledger.jsonl                     │
lessons ──────lesson──────────────> data/lessons.jsonl                   │
                                                                         ▼
                              pick / brief (pair.mjs): cheapest verified route per role
                                                                         │
                                          leader fires workers, verifies the claims
                                                                         │
transcripts ──────usage───────> report for the leader (no effect on routing)
```

## The self-improvement loop

1. **Start.** `brief` combines the ledger's verified rows, the bench rows and the registry into a route per role, and
   lists the active lessons. A role with no verified rows starts as a trial.
2. **Route.** `pick` ranks the candidates for a role by cost and quality under the chosen preset. A failed bench row
   rules a model out. An untested model is only eligible with `--allow-trial`, and only for cheaply checked work.
3. **Fire and verify.** The leader checks every claim. Only lead-verified tasks are logged.
4. **Learn.** `log` appends one row per verified worker task. `lesson` appends one outcome for the rule that most changed
   total work. A lesson is **active** once it has two supports. It is **retired** once contradictions reach its support
   count; retired lessons are hidden from `brief`.
5. **Measure.** `usage` after each job shows leader share and context per turn. Compare it with the last job.

A lesson changes behaviour only in the brief the next job reads. Promoting a lesson into `SKILL.md` needs a reviewed pull
request, so the installed instructions never change by themselves.

## Design choices

- **Offline by default.** `pick`, `brief`, `log`, `lesson`, `stats`, `inspect` and `usage` make no network calls.
  `models update` fetches the public catalogue unless `--offline` is given. `bench` is the only command that calls models.
- **Nothing rewrites the installed skill.** Routing reads data files; `SKILL.md` and the scripts change only through a
  reviewed change to the repository.
- **Quota pools are separate.** Claude subscription, ChatGPT/Codex and local models each have their own limit. A route
  that hits one pool's limit moves the role to an equivalent tier in another pool; it does not wait or climb tiers.
- **Full model ids.** Aliases such as `haiku` follow whichever CLI is installed. Routes, bench rows and the registry use
  the exact id, and bench records the model that actually answered.
- **The leader keeps irreversible decisions.** Money, stock, permissions, security, data migration and release verdicts
  are never routed to a worker alone.
- **Reversible registry.** Every `models update` keeps the previous registry in `data/history/`, so `models rollback`
  can restore it.
- **Heuristic planner.** Its bands and sample sizes are settings, not measured optima. Its limits are stated in
  [cost-model.md](cost-model.md).
