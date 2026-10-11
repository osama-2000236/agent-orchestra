# Dispatch across the runtime that actually exists

Check local help and capabilities first; these examples were verified against Claude Code 2.1.296 on 2026-10-11. Availability and defaults can change. Native host tools follow their own schema, authorization and model list; never copy Claude-specific flags into them.

## Claude Code

With an Agent tool, define a bounded agent with `model`, `effort` and a real `tools` list. Do not use a conversation fork when an independent first opinion or different model is required. Confirm the running model in task metadata. User/organization overrides can affect the result.

For a supported external worker, use print mode and JSON output. Store prompt/agent JSON as UTF-8 files; pipe the prompt or pass a file as documented, not shell-built JSON containing user text. On the installed CLI, `--agents` accepts a JSON file in print mode and `--agent` selects its named agent:

```powershell
Get-Content -Raw -LiteralPath packet.md | claude --print --agents agents.json --agent design-review --model claude-haiku-5-5 --effort medium --setting-sources local --max-budget-usd 1 --output-format json --tools 'Read,Grep,Glob' --allowedTools 'Read,Grep,Glob' > report.json
```

```json
{"design-review":{"description":"Review the supplied UI artifacts","prompt":"Read only. Return specific evidence, limitations and no changes.","model":"haiku","effort":"medium","tools":["Read","Grep","Glob"]}}
```

The lead can instead enable Agent and ask the main CLI to orchestrate two named workers using `--agents`; allow only tools they need. Log orchestration overhead and every worker result. It is a different experiment from running one Haiku worker directly. No tool can inspect a screenshot unless image/browser access is actually provided.

`--max-budget-usd` is a print-mode session cap, not an exact invoice or a universal hard cap for other runtimes. Inspect JSON `is_error`, subtype, modelUsage and any permission denials, not only process exit. A quota failure was observed with `subtype:success` and `is_error:true`; `pair.mjs inspect --file report.json` rejects that combination without treating it as a reasoning failure. Attest actual model identity; raw outputs remain private if they contain repository information. Exact applied effort may not be exposed in JSON when an organization clamps it; record that uncertainty.

Authoritative references: [subagents](https://code.claude.com/docs/en/sub-agents), [CLI flags](https://code.claude.com/docs/en/cli-reference), [effort configuration](https://code.claude.com/docs/en/model-config). Subagent per-invocation effort requires v2.1.292+, and file-based `--agents` in print mode requires v2.1.281+.

## Measured traps (2026-10-11)

- **Aliases follow the installed CLI.** A Claude Code 2.1.251 on PATH sent `--model haiku` to claude-haiku-4-5 and
  refused claude-opus-5-5 ("version 2.1.280 or newer is required") while the host session ran 2.1.296. Use full ids,
  read `modelUsage` in the JSON report (`orchestra.mjs bench` records the model that really answered), and run
  `claude update` when a model is refused.
- **Your hooks ride along.** Without `--setting-sources local` a worker loads your user hooks and settings: the same
  one-word answer cost $0.030 instead of $0.023 on Haiku 5.5.
- **Side requests.** The CLI can bill a small request to an older Haiku beside the requested model; attribute cost by
  `modelUsage`, not by the flag you passed.

## Codex as a worker (separate quota pool)

```bash
codex exec -m gpt-6.1-sol -c model_reasoning_effort="low" -c windows.sandbox='"unelevated"' --json --ephemeral --skip-git-repo-check -s read-only -C <pinned-worktree> - < packet.md
```

On Windows add `-c windows.sandbox='"unelevated"'`. Measured 2026-10-11: with the `elevated` sandbox from
`~/.codex/config.toml`, three GPT-6.1-Sol reviews had every shell call fail ("helper_unknown_error: setup refresh had
errors"); one still answered "Review blocked" after 130k input tokens, the other two kept reasoning blind. Run
`orchestra.mjs inspect --file <events>.jsonl` on every Codex run: `errorKind: sandbox` means no file was read, so the
answer is not a review. Probe first with one tiny packet ("run git rev-parse --short HEAD") before a fan-out.

`--json` prints events: the answer is the last `item.type == "agent_message"`, tokens are on `turn.completed`.
`codex review` reviews a diff directly. Codex's model list and effort levels live in `~/.codex/models_cache.json`
(`orchestra.mjs models update` reads it). A ChatGPT login has its own usage limit, separate from Claude's: "You've hit
your usage limit ... try again at 6:28 PM" is a pool outage, so move the role to another pool instead of retrying.

## Local models

Ollama (`localhost:11434/api/tags`) and LM Studio (`localhost:1234/v1/models`) are listed only when their server
answers; a crashed `ollama list` (seen: an access violation in its image runtime) is skipped, not fatal. Use them for
formatting, extraction and other work whose answer you can check in seconds.

## Other native agents and CLIs

Prefer the native host's structured spawn/review APIs when available. Discover their real model/effort options and context rules. A full-history fork may inherit the parent's model and prohibit overrides. Record its returned model when exposed; if the host does not expose attestation, say so.

For Codex or another vendor CLI, read installed `--help`, choose its supported read-only sandbox for a review, and use a pinned detached worktree. Do not select dangerous permission-bypass flags to recover from a broken sandbox. A previously observed Windows `elevated` sandbox failure was solved with supported `unelevated` configuration; treat that as a local diagnostic option, not a universal setting.

Probe a required unavailable runtime with one small read-only capability check. Report auth/model/quota failure once, make at most one materially corrected retry, then preserve the packet and proceed with independent tasks or a disclosed permitted fallback. Do not spend a paid model call merely to run a shell version command when local help proves capability.

## Concurrency and artifacts

Use the host's actual free slots, not a fixed “four to six workers” recipe. Reuse an idle worker for a focused follow-up when its context is small and relevant; a new focused packet can be cheaper than repeatedly replaying a long history. Measure before turning that into a default. Writers need disjoint paths or owned worktrees; readers need pinned commits. Exclusive app tests, packaging and deployment are not parallel review jobs.

Every report includes candidate hash, requested/actual model, requested/applied effort or uncertainty, tools attempted/denied, duration, token categories, cost basis, finding/check outcomes and exact next step. If one worker fails, preserve its failure and continue the others; do not fabricate a clean joint verdict.
