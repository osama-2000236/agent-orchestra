# What this skill takes from Claude Managed Agents

Read on 2026-10-11 from the beta docs (`managed-agents-2026-04-01`). Managed Agents runs agents in Anthropic's
cloud; this skill runs on your machine inside Claude Code, Codex or another host. No code or text was copied (the
docs carry no open licence); the ideas below are reimplemented locally, and no product here is called "Claude Code".

| Managed Agents | What it does there | Local equivalent here |
| --- | --- | --- |
| Agent (`model`, system prompt, tools, skills) and per-session `agent_with_overrides` (`model: {id, effort}`) | one definition, overridable per run | the packet in SKILL.md section 4: model, effort, tools and rules set per worker, never inherited by accident |
| `multiagent_20261001` with `subagents` (own session thread each) and `workflows` (a program running many agents in phases) | delegation with isolated contexts | Claude Code subagents or `claude -p` / `codex exec` workers, one isolated context each; the leader keeps only their short answers |
| `advisor` (`{"type":"enabled","model":...}`): a cheaper agent does the work and consults a stronger model mid-turn; the advisor may not be weaker than the agent | strong judgment at cheap-worker prices | the leader is the advisor: workers on Haiku or Luna draft, the leader verifies and decides |
| 25 child threads per session, 20 predefined agents per list | bounded fan-out | fire only the workers whose packets differ; merge tiny tasks (each cold start pays a cache write) |
| Session `budget` (`max_list_cost` in whole USD cents; stops with `budget_reached`, overshoot at most one request per thread) | hard spend cap at list price | `--max-task-usd` in `pick`, `--max-budget-usd` on `claude -p` workers, and `usage` to measure list-price spend after the job |
| Runtime fee: session running time at $0.08 per hour, web search $10 per 1,000 | cost of the managed runtime itself | none locally; subscription quota is the limit instead, so the leader's turns are the cost to cut |
| `agent.thread_context_compacted` event | compaction in the managed runtime | `autoCompactWindow` (set by `tune`) and handoff files written before the context fills |
| Skills attached per session (`skills: [{type, skill_id, version}]`, up to 500) | reusable instructions | this folder is an Agent Skill: `SKILL.md` plus scripts, installable in Claude Code and Codex |

Claude Code facts used (code.claude.com docs, same date):

- A subagent's model comes from the invocation's `model`, then its frontmatter `model`, then
  `CLAUDE_CODE_SUBAGENT_MODEL`, then the main conversation's model. `tune` sets that variable to `haiku` so a
  forgotten `model` costs Haiku, not the leader's price. Built-in Explore and Plan agents follow the same chain.
- Subagents "count toward the same usage limits as your main conversation"; the costs page recommends routing simple
  tasks to Haiku and keeping agent teams small.
- Effort levels are `low, medium, high, xhigh, max`; a subagent's `effort` overrides the session level.
- Subscription prompt caches live one hour, API-key caches five minutes, which is why a cold worker's first request
  costs several times its later ones (measured: $0.023 first, $0.004 after, Haiku 5.5).

When to use Managed Agents instead: long unattended jobs that need a cloud sandbox, a hard dollar cap, or more than a
laptop's parallelism, on an API key. The routing, ledger and lessons here apply unchanged; point `--config` at the
same prices and log the sessions' list cost as `cost.basis: "api-equivalent"`.
