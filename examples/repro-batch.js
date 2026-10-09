// Reproduce a batch of backlog items with scratch scripts, then skeptic-check every REAL verdict.
//
// Shape: one worker per item (reproduce, decide) -> one skeptic per REAL verdict.
// This separates real defects from noise: a NOT needs concrete evidence too, and a REAL needs numbers.
// Runner globals and their names: see audit-fanout.js. The body is an async function body.
//
// args: {repo: 'C:/work/app', scratch: 'C:/work/scratch', items: [{id: 'BL-04', text: 'refund rounding drifts'}]}

export const meta = {
  name: 'repro-batch',
  description: 'Reproduce backlog items in scratch scripts (no app, no UI), skeptic-check each REAL verdict',
  phases: [
    { title: 'Reproduce', detail: 'one Haiku worker per item, scratch scripts only', model: 'haiku' },
    { title: 'Check', detail: 'one Haiku skeptic per REAL verdict', model: 'haiku' },
  ],
}

const {repo, scratch, items} = args
const RULES = `Repo: ${repo}. Do NOT edit any repo file, commit, or run the app or the full test suite.
You MAY write throwaway scripts under ${scratch}/<item id>/ and run them with node, importing the repo's
pure modules by absolute file:// URL. Never open secret or key files.
Use explicit clocks in the scripts, never the real clock, so the result is the same on every run.
A defect is REAL only with concrete numbers: a wrong money or stock figure, an invalid saved state
from a legitimate input, or a wrong refusal of a legitimate action. Otherwise NOT, and say why.`

const VERDICT = {type: 'object', properties: {
  id: {type: 'string'},
  verdict: {type: 'string', enum: ['REAL', 'NOT', 'NEEDS-OWNER']},
  evidence: {type: 'string'}, root: {type: 'string'},
  test: {type: 'string', description: 'self-contained test body that FAILS today and asserts the correct behaviour; empty if NOT'},
  testFile: {type: 'string'}, fix: {type: 'string'},
}, required: ['id', 'verdict', 'evidence', 'root', 'test', 'testFile', 'fix']}

phase('Reproduce')
const out = await pipeline(items,
  it => agent(`${RULES}

Item ${it.id}: ${it.text}
Decide REAL, NOT or NEEDS-OWNER with a scratch reproduction and its numbers.
If REAL, give a test that fails today and asserts the correct behaviour, and the test file it belongs in.`,
    {label: it.id, phase: 'Reproduce', schema: VERDICT, model: 'haiku'}),

  async (r, it) => {
    if (!r || r.verdict !== 'REAL') return r
    const skeptic = await agent(`${RULES}

Skeptic. Try to REFUTE this REAL verdict for ${it.id}. Rebuild the reproduction yourself in
${scratch}/${it.id}-check/. refuted=true only with concrete counter-evidence: a guard, a misread, or a later fix.
Verdict: ${JSON.stringify(r)}`,
      {label: `check ${it.id}`, phase: 'Check', model: 'haiku', schema: {type: 'object', properties: {
        refuted: {type: 'boolean'}, evidence: {type: 'string'},
      }, required: ['refuted', 'evidence']}})
    return {...r, skeptic}
  })

// The lead still reads each surviving test and runs it red before anything is fixed.
return out.filter(Boolean)
