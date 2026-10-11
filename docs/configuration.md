# Configuration

Everything here is optional. With no configuration, Agent Orchestra reads its own `data/` folder, uses the registry you
built with `models update`, and falls back to the snapshot in `skill/data/config.example.json`.

## Data files

The default data folder is `data/` beside the scripts: `skill/data/` in the repository, or
`~/.claude/skills/agent-orchestra/data/` after install.

| File | Written by | Read by | What it holds |
| --- | --- | --- | --- |
| `data/models.json` | `models update`, `bench`, `models rollback` | `pick`, `brief`, `usage`, `models list` | the registry: runtime, pool, id, efforts, prices, tier, bench summary |
| `data/history/models-<ms>.json` | `models update` (the previous registry) | `models rollback` | earlier registries; rollback restores the newest and deletes it from `history/` |
| `data/overrides.json` | you | `models update` | per-model overrides merged over the registry, key by key, e.g. `{"codex:gpt-6-luna": {"available": false}}` |
| `data/ledger.jsonl` | `log` | `pick`, `brief`, `stats` | one row per worker task you verified: model, role, effort, outcome, cost basis |
| `data/lessons.jsonl` | `lesson` | `brief` | one row per lesson outcome: `support` or `contradict` |
| `data/bench.jsonl` | `bench` | `pick` | one row per bench task: model, effort, pass or fail, time, cost |

`ledger.jsonl` and `lessons.jsonl` are git-ignored. `models.json`, `history/`, `overrides.json` and `bench.jsonl` are
not: keep them out of commits by hand.

## Environment variables

| Variable | Effect |
| --- | --- |
| `AGENT_ORCHESTRA_DATA` | Data folder for `orchestra.mjs`. **Limit:** `pair.mjs` (`brief`, `pick`, `log`, `lesson`) still uses the skill's own `data/` folder, so `orchestra.mjs` and `pair.mjs` can disagree about the registry and bench rows. Leave this unset until that is fixed. |
| `SUBAGENT_ORCHESTRA_LEDGER` | Ledger path. Wins over `MODEL_ORCHESTRA_LEDGER`. The `--ledger` option wins over both. |
| `MODEL_ORCHESTRA_LEDGER` | Older ledger path variable, kept for upgrades from model-orchestra. |
| `SUBAGENT_ORCHESTRA_LESSONS` | Lessons path. The `--lessons` option wins over it. |
| `ANTHROPIC_API_KEY` | Names the Claude Code pool `anthropic-api` instead of `claude-subscription`, and lets `models update` list Anthropic models. |
| `OPENAI_API_KEY`, `XAI_API_KEY` | Let `models update` list those providers' models. The key is sent only to that provider's model-list endpoint. |

## `pick` options

`node skill/scripts/orchestra.mjs pick <role> [model ...] [options]`. With no models named, every model in the
registry or `--config` file is a candidate.

| Option | Values | Meaning |
| --- | --- | --- |
| `--preset` | `frugal`, `balanced`, `thorough` | `frugal`: effort low, `worker-request` cost, trial routes allowed. `balanced`: effort medium, `complete-task` cost. `thorough`: effort high, `quality` ranking. |
| `--effort` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` | Effort to plan for. Beats the preset. A model that does not support it is not picked. |
| `--cost-mode` | `complete-task`, `worker-request`, `quality` | `complete-task` counts worker, verification and rework cost. `worker-request` prices one request. `quality` ranks by quality only. Beats the preset. |
| `--max-task-usd` | number | A route whose cost is unknown or above this per-task budget is not picked. |
| `--risk` | `high` | The decision stays with the lead; independent reviewers count as evidence only. |
| `--allow-trial` | flag | Adds permission to route to models without verified rows. It does not pick them by itself. |
| `--config` | file | A JSON file with `models`, `pricing` and `policy`, used instead of the registry. |
| `--input-tokens`, `--output-tokens`, `--cache-read-tokens`, `--cache-write-tokens` | numbers | Describe your workload. Unspecified, the estimate uses 10,000 input and 2,000 output tokens. |
| `--ledger`, `--lessons` | paths | Override the files named above. |
| `--json` | flag | Machine-readable output. |

`pick` is an offline estimate. It never starts a model.

## `tune`

`node skill/scripts/orchestra.mjs tune [--apply] [--settings <file>]`

- Default settings file: `~/.claude/settings.json`.
- It sets `env.CLAUDE_CODE_SUBAGENT_MODEL` to `claude-haiku-5-5`, so a subagent spawned without a model runs on Haiku rather than
  the leader's model, and `autoCompactWindow` to `200000`.
- It never overwrites a value you have already set.
- Without `--apply` it only prints what it would change.
- With `--apply` it first copies the existing file to `settings.json.orchestra-<ms>.bak` in the same folder. To undo,
  copy that backup over `settings.json`. If the file did not exist, delete the new one.

## Pricing precedence

The registry takes each model's price from the first source that applies:

1. **A provider price page.** If a model's `pricing.source` is a page other than OpenRouter, `models update` keeps it.
   Set it there, with the page's URL and the date you checked it.
2. **The OpenRouter catalogue**, for Claude (`claude-*`), OpenAI (`gpt-*`, `o<digit>*`) and xAI (`grok*`) ids. It is recorded
   with its date and is treated as stale after 30 days.
3. **Local models** (Ollama, LM Studio) are priced 0.

A price older than 30 days makes the cost unknown. Unknown is never treated as cheap.

## `bench` and `models update`

- `bench --new` runs on each `claude-code` or `codex` model that has no bench row yet and is not in the `strong` tier.
- `bench --targets claude-code:claude-haiku-5-5:low,codex:gpt-6.1-sol:low` runs named targets (runtime:model:effort).
- `bench --tasks find-bug,extract,review-diff` runs a subset of the three tasks.
- Each target runs through its runtime in print or exec mode, read-only, with a 240-second limit per task. A quota error
  is recorded as a note, not as a failed answer.
- `models update --offline` skips the OpenRouter catalogue. `models update --bench` runs `bench --new` afterwards.
- `models discover` prints what it finds without writing anything.

## `usage`

`node skill/scripts/orchestra.mjs usage [--last n] [--session <file.jsonl>] [--project <dir>] [--json]`

Reads Claude Code transcripts from `~/.claude/projects/`. Without options it reports the current folder's latest
session. It prices tokens at list-price equivalents; the figures are not an invoice.
