# Why usage limits ran out: measured, 2026-10-11

Measured with `orchestra.mjs usage` (0.4.0 counting: one request = its final streamed usage) over every Claude Code session on one Windows machine that changed in the 14 days
to 11 October 2026 and cost more than $1 at list price: 66 sessions, 149 subagents. Dollars are API list-price
equivalents from token counts (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 per million, cache reads
and writes priced separately). A subscription consumes quota in proportion to the same tokens; it is not an invoice.

| Measure | Value |
| --- | --- |
| Sessions / list-price total | 66 / $1,989 |
| Leader share of the total | **90%** |
| Leader turns / average cached context re-read per turn | 17,507 / **373k tokens** |
| Leader cache reads (Opus 5.5) | 5.75 billion tokens, $1,743 |
| Subagents on Opus (inherited or chosen) | 2,532 requests, $177 |
| Subagents on Haiku 5.5 | 2,599 requests, $6.6 |
| Subagents on Sonnet 5.5 | 150 requests, $6.3 |
| Auto-compactions | 12 |

One job inside that window (the release that produced 0.3.0): 118 minutes, 123 leader turns, 9 subagents,
$13.70 total, leader 76%, 214k cached tokens per leader turn, one compaction, one 29k-character tool result.

## Root causes and fixes

| Cause | Evidence | Fix in 0.4.0 |
| --- | --- | --- |
| The leader did the reading | 90% leader share; workers were a side channel | SKILL.md section 2: delegate reading, searching, first-pass review; the leader decides and verifies |
| Every leader turn re-reads the whole context, and contexts grew to hundreds of thousands of tokens on 1M-token models | 373k per turn on average | batch tool calls, keep big output in files, hand off and compact before ~200k; `tune` sets `autoCompactWindow=200000` |
| Spawns without a model ran on the leader's model | Opus subagents cost 27x Haiku per request for the same request count | name a model on every spawn; `tune` sets `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-5-5` as the fallback |
| Cheap models at the wrong effort | Haiku 5.5 at low effort answered "CLEAN" for a removed permission check; at high it caught it (`docs/benchmarks.md`) | route table pairs every role with an effort; escalate effort before tier |
| One quota pool for everything | a Claude limit stopped reviewers; a ChatGPT/Codex limit stopped the second vendor | `models update` lists pools; route around an exhausted pool instead of waiting |
| Workers loaded the user's hooks | the same one-word worker answer cost $0.030 with hooks, $0.023 without | `--setting-sources local` for `claude -p` workers |
| Stale model aliases | an older CLI sent `haiku` to the previous generation and refused Opus 5.5 | full model ids; `bench` records the model that really answered |

## Reproduce on your machine

```bash
node skill/scripts/orchestra.mjs usage --last 5           # this folder's last five sessions
node skill/scripts/orchestra.mjs usage --session <file.jsonl> --json
```

Transcripts are read locally from `~/.claude/projects/`; nothing is uploaded. Your numbers will differ: the point is
the leader share and context per turn, which tell you where your own quota goes.
