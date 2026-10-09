// Audit fan-out with skeptic verification, then a fix plan.
//
// Shape: one read-only auditor per area -> two skeptics per serious finding -> one planner.
// Runs in a workflow runner that provides these globals (the names used by the original scripts):
//   agent(prompt, {label, phase, schema, model})  one worker; resolves to JSON matching `schema`, or null
//   pipeline(items, stage, after)                 runs stage(item) per item, then after(result, item)
//   parallel(thunks)                              runs thunks concurrently, resolves to their results
//   phase(name) / log(message)                    progress markers
//   args                                          run inputs (below)
// The body is the body of an async function, so top-level await and return are allowed.
// Adapt the names if your runner differs. Nothing here is project-specific.
//
// args: {repo: 'C:/work/app', ref: 'main', areas: [{id: 'payments', paths: 'src/pay/**', focus: 'refund rounding'}]}

export const meta = {
  name: 'audit-fanout',
  description: 'Audit a repo by area with read-only workers, verify serious findings with two skeptics, then plan fixes',
  phases: [
    { title: 'Audit', detail: 'read-only Haiku auditors, one per area', model: 'haiku' },
    { title: 'Verify', detail: 'two Haiku skeptics per serious finding', model: 'haiku' },
    { title: 'Synthesize', detail: 'ordered fix plan (the lead reviews it before any job starts)', model: 'haiku' },
  ],
}

const {repo, ref, areas} = args
// Workers read the same frozen tree, so every finding can be checked against one commit.
const RULES = `Repo: ${repo} at ${ref}. READ-ONLY: never edit, commit, check out, stash, or run the test suite.
Evidence must be concrete: file:line on the current tree, a commit sha, or a quoted line.
If you cannot verify a claim, write "unverified". Do not report style opinions.`

const FINDINGS = {type: 'object', properties: {
  summary: {type: 'string'},
  findings: {type: 'array', items: {type: 'object', properties: {
    id: {type: 'string'},
    kind: {type: 'string', enum: ['defect', 'missing', 'unverified-claim', 'stale-doc', 'efficiency', 'cleanup']},
    severity: {type: 'string', enum: ['blocking', 'money', 'stock', 'permission', 'minor', 'doc']},
    claim: {type: 'string'}, evidence: {type: 'string'}, fix: {type: 'string'},
  }, required: ['id', 'kind', 'severity', 'claim', 'evidence', 'fix']}},
}, required: ['summary', 'findings']}

const VERDICT = {type: 'object', properties: {
  refuted: {type: 'boolean'}, evidence: {type: 'string'},
}, required: ['refuted', 'evidence']}

const SERIOUS = ['blocking', 'money', 'stock', 'permission']
const CHECKABLE = ['defect', 'missing', 'unverified-claim']

phase('Audit')
const audited = await pipeline(areas,
  a => agent(`${RULES}

Area ${a.id}: files ${a.paths}. Focus: ${a.focus}
Report real problems only, with ids like ${a.id.toUpperCase()}-1. An empty findings array is a valid answer.`,
    {label: a.id, phase: 'Audit', schema: FINDINGS, model: 'haiku'}),

  async (r, a) => {
    if (!r) return null
    const serious = r.findings.filter(f => SERIOUS.includes(f.severity) && CHECKABLE.includes(f.kind))

    // Two skeptics per serious finding. Each tries to refute it from the code, not from the auditor's words.
    const checked = await parallel(serious.map(f => async () => {
      const votes = (await parallel([1, 2].map(k => () =>
        agent(`${RULES}

Skeptic ${k}. Try to REFUTE this finding. Open the cited code yourself. Look for a guard elsewhere,
a later fix, or a misreading. refuted=true only with concrete counter-evidence; otherwise false.
Finding: ${JSON.stringify(f)}`,
          {label: `verify ${f.id}#${k}`, phase: 'Verify', schema: VERDICT, model: 'haiku'})))).filter(Boolean)
      // A finding with no skeptic answer is kept and marked unverified, never dropped silently.
      const survives = votes.length === 0 || votes.some(v => !v.refuted)
      return {...f, votes, unverified: votes.length === 0, survives}
    }))

    const kept = checked.filter(Boolean)
    return {
      ...r,
      findings: [...r.findings.filter(f => !serious.includes(f)), ...kept.filter(f => f.survives)],
      refuted: kept.filter(f => !f.survives).map(f => f.id),
    }
  })

const results = audited.filter(Boolean)
log(`${results.length}/${areas.length} auditors returned`)

phase('Synthesize')
const plan = await agent(`Plan fixes from these verified findings. Do not edit anything.
Findings: ${JSON.stringify(results)}

Group them into at most six jobs, in this order: (1) a docs or status cleanup, (2) money, stock and
permission defects, each its own job with the failing test to write first, (3) efficiency, (4) cleanup.
Drop anything unverified or cosmetic and say why. Mark each item that needs a human decision.`,
  {label: 'plan', phase: 'Synthesize', model: 'haiku', schema: {type: 'object', properties: {
    jobs: {type: 'array', items: {type: 'object', properties: {
      title: {type: 'string'}, ids: {type: 'array', items: {type: 'string'}},
      files: {type: 'array', items: {type: 'string'}}, test: {type: 'string'},
      risk: {type: 'string'}, owner: {type: 'boolean'},
    }, required: ['title', 'ids', 'files', 'test', 'risk', 'owner']}},
    dropped: {type: 'array', items: {type: 'string'}},
  }, required: ['jobs', 'dropped']}})

return {results, plan}
