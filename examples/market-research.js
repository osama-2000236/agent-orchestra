// Market-practice research: how leading products handle each open policy question, then one decision table.
//
// Shape: one web researcher per decision cluster -> one synthesis worker -> the lead decides.
// The research workers may use web search and fetch. They must cite a source URL for every claim,
// and say when they read a page only through a search summary.
// Runner globals and their names: see audit-fanout.js. The body is an async function body.
//
// args: {repo: 'C:/work/app', constraints: 'posted history is never rewritten; old data must keep opening',
//        clusters: [{id: 'payroll', questions: 'Can a zero-net pay run be marked paid? ...'}]}

export const meta = {
  name: 'market-research',
  description: 'Research how leading products handle each open policy question, then synthesize a decision table',
  phases: [
    { title: 'Research', detail: 'one Haiku researcher per cluster, web and repo', model: 'haiku' },
    { title: 'Decide', detail: 'one synthesis pass into a decision table', model: 'haiku' },
  ],
}

const {repo, constraints, clusters} = args
const RULES = `You research market practice for a product in the repo ${repo}. READ-ONLY: never edit, commit, or run the app.
Use web search and fetch. Prefer vendor documentation and help centres over blogs. For each program you
name, give the source URL. Then read how the repo behaves today (cite file:line), so the recommendation fits it.
Hard constraints: ${constraints}
Recommend what the MAJORITY of the named programs do. If they disagree, recommend the most conservative
option that is still correct, and say so.`

const RESEARCH = {type: 'object', properties: {
  cluster: {type: 'string'},
  decisions: {type: 'array', items: {type: 'object', properties: {
    id: {type: 'string'}, question: {type: 'string'},
    market: {type: 'string', description: 'what each named program does, with URLs'},
    recommendation: {type: 'string'},
    current: {type: 'string', description: 'what the repo does now, with file:line'},
    change: {type: 'string', description: 'concrete change, or "none: already matches"'},
    size: {type: 'string', enum: ['none', 'S', 'M', 'L']},
    money: {type: 'boolean'},
  }, required: ['id', 'question', 'market', 'recommendation', 'current', 'change', 'size', 'money']}},
}, required: ['cluster', 'decisions']}

phase('Research')
const found = (await pipeline(clusters,
  c => agent(`${RULES}\n\nCluster ${c.id}:\n${c.questions}\nReturn one decision per question.`,
    {label: c.id, phase: 'Research', schema: RESEARCH, model: 'haiku'}))).filter(Boolean)
log(`${found.length}/${clusters.length} clusters researched`)

phase('Decide')
const table = await agent(`Turn this research into one decision table. Research: ${JSON.stringify(found)}
For each decision: the final choice in one sentence, the programs that support it, and whether it changes code.
Respect the constraints: ${constraints}
Group the code changes into at most three slices, ordered by money impact. Each slice names its files and a
failing test to write first. List separately anything that market practice cannot decide (legal or tax rules
specific to one country); those go to the owner.`,
  {label: 'decision table', phase: 'Decide', model: 'haiku', schema: {type: 'object', properties: {
    decisions: {type: 'array', items: {type: 'object', properties: {
      id: {type: 'string'}, choice: {type: 'string'}, evidence: {type: 'string'}, code: {type: 'boolean'},
    }, required: ['id', 'choice', 'evidence', 'code']}},
    slices: {type: 'array', items: {type: 'object', properties: {
      title: {type: 'string'}, ids: {type: 'array', items: {type: 'string'}},
      files: {type: 'array', items: {type: 'string'}}, tests: {type: 'string'},
    }, required: ['title', 'ids', 'files', 'tests']}},
    ownerOnly: {type: 'array', items: {type: 'string'}},
  }, required: ['decisions', 'slices', 'ownerOnly']}})

return {research: found, table}
