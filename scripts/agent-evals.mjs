import { isMainModule } from './lib/entrypoint.mjs'
import { digest, keys, options, readDocument, requireThat, text, unique, writeArtifact } from './lib/evidence.mjs'

const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value)
const revision = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)

export function validateSuite(suite) {
  keys(suite, ['schema_version', 'id', 'version', 'attempts_per_case', 'cases'], 'Eval suite')
  requireThat(suite.schema_version === 1 && validId(suite.id) && /^\d+\.\d+\.\d+$/.test(suite.version), 'Invalid eval suite identity')
  requireThat(Number.isInteger(suite.attempts_per_case) && suite.attempts_per_case >= 1 && suite.attempts_per_case <= 10, 'Expected 1-10 attempts per case')
  requireThat(Array.isArray(suite.cases) && suite.cases.length > 0 && suite.cases.length <= 100, 'Expected 1-100 eval cases')
  unique(suite.cases.map(item => item.id), 'Case ids')
  for (const item of suite.cases) {
    keys(item, ['id', 'prompt', 'safety_critical', 'criteria'], 'Eval case')
    requireThat(validId(item.id) && text(item.prompt) && typeof item.safety_critical === 'boolean', 'Invalid eval case')
    requireThat(Array.isArray(item.criteria) && item.criteria.length > 0 && item.criteria.length <= 30, 'Expected 1-30 criteria')
    unique(item.criteria.map(criterion => criterion.id), 'Criterion ids')
    for (const criterion of item.criteria) {
      keys(criterion, ['id', 'description'], 'Criterion')
      requireThat(validId(criterion.id) && text(criterion.description), 'Invalid criterion')
    }
  }
  return suite
}

export function newRun(suite, suiteSha) {
  validateSuite(suite)
  return { schema_version: 1, suite_id: suite.id, suite_version: suite.version, suite_sha256: suiteSha,
    subject_sha: null, partner: { host: 'UNCONFIGURED', model: 'UNCONFIGURED', version: 'UNCONFIGURED' }, trials: [] }
}

function trialResult(item, trial) {
  if (!trial) return { attempt: null, status: 'UNRUN' }
  const outcomes = new Map(trial.checks.map(check => [check.criterion_id, check]))
  if (trial.status === 'failed' || trial.checks.some(check => check.outcome === 'fail')) return { attempt: trial.attempt, status: 'FAIL', duration_ms: trial.duration_ms ?? null }
  const complete = trial.status === 'completed' && text(trial.reviewer) && item.criteria.every(criterion => {
    const check = outcomes.get(criterion.id)
    return check?.outcome === 'pass' && check.evidence.length > 0
  })
  return { attempt: trial.attempt, status: complete ? 'PASS' : 'INCOMPLETE', duration_ms: trial.duration_ms ?? null }
}

export function score(suite, run, suiteSha = digest(JSON.stringify(suite))) {
  validateSuite(suite)
  keys(run, ['schema_version', 'suite_id', 'suite_version', 'suite_sha256', 'subject_sha', 'partner', 'trials'], 'Eval run')
  requireThat(run.schema_version === 1 && run.suite_id === suite.id && run.suite_version === suite.version && run.suite_sha256 === suiteSha, 'Suite id/version/digest mismatch; do not mix suites')
  requireThat(Array.isArray(run.trials) && run.trials.length <= suite.cases.length * suite.attempts_per_case, 'Invalid trial count')
  keys(run.partner, ['host', 'model', 'version'], 'Partner')
  requireThat(Object.values(run.partner).length === 3 && Object.values(run.partner).every(text), 'Partner metadata required')
  requireThat(run.subject_sha === null && run.trials.length === 0 || revision(run.subject_sha), 'One tested subject SHA is required; do not mix revisions')
  if (run.trials.length) requireThat(Object.values(run.partner).every(value => !/UNCONFIGURED|^TODO$/i.test(value)), 'Record the actual host, model and host version before scoring trials')
  unique(run.trials.map(trial => `${trial.case_id}:${trial.attempt}`), 'Trial identities')
  for (const trial of run.trials) {
    keys(trial, ['case_id', 'attempt', 'status', 'reviewer', 'checks', 'duration_ms'], 'Trial')
    const item = suite.cases.find(candidate => candidate.id === trial.case_id)
    requireThat(item, 'Unknown case id')
    requireThat(Number.isInteger(trial.attempt) && trial.attempt >= 1 && trial.attempt <= suite.attempts_per_case, 'Invalid attempt number')
    requireThat(['completed', 'failed', 'incomplete'].includes(trial.status), 'Trial status must describe observation, not assert success')
    requireThat(trial.reviewer === undefined || typeof trial.reviewer === 'string', 'Invalid reviewer')
    requireThat(trial.duration_ms === undefined || Number.isFinite(trial.duration_ms) && trial.duration_ms >= 0, 'Invalid duration')
    requireThat(Array.isArray(trial.checks) && trial.checks.length <= item.criteria.length, 'Invalid criterion count')
    unique(trial.checks.map(check => check.criterion_id), 'Trial criterion ids')
    for (const check of trial.checks) {
      keys(check, ['criterion_id', 'outcome', 'evidence'], 'Criterion result')
      requireThat(item.criteria.some(criterion => criterion.id === check.criterion_id), 'Unknown criterion id')
      requireThat(['pass', 'fail', 'unverified'].includes(check.outcome), 'Invalid criterion outcome')
      requireThat(Array.isArray(check.evidence) && check.evidence.length <= 20 && check.evidence.every(ref => text(ref) && ref.length <= 2048), 'Evidence must contain bounded reference strings')
    }
  }
  const k = suite.attempts_per_case
  const cases = suite.cases.map(item => {
    const attempts = Array.from({ length: k }, (_, index) => ({ ...trialResult(item, run.trials.find(trial => trial.case_id === item.id && trial.attempt === index + 1)), attempt: index + 1 }))
    const observed = attempts.every(attempt => ['PASS', 'FAIL'].includes(attempt.status))
    const anyPass = attempts.some(attempt => attempt.status === 'PASS'), anyFail = attempts.some(attempt => attempt.status === 'FAIL')
    return { id: item.id, safety_critical: item.safety_critical, attempts, fully_observed: observed,
      pass_at_1: ['PASS', 'FAIL'].includes(attempts[0].status) ? attempts[0].status === 'PASS' : null,
      pass_within_k: anyPass ? true : observed ? false : null,
      all_k_pass: anyFail ? false : observed ? true : null }
  })
  const counts = { PASS: 0, FAIL: 0, INCOMPLETE: 0, UNRUN: 0 }
  for (const item of cases) for (const attempt of item.attempts) counts[attempt.status]++
  const metric = field => {
    const observed = cases.filter(item => item[field] !== null).length
    const successes = cases.filter(item => item[field] === true).length
    return { successes, observed_cases: observed, planned_cases: cases.length, rate: observed === cases.length ? successes / cases.length : null }
  }
  return { schema_version: 1, suite_id: suite.id, suite_version: suite.version, suite_sha256: suiteSha, subject_sha: run.subject_sha, partner: run.partner,
    status: counts.FAIL ? 'FAIL' : counts.INCOMPLETE || counts.UNRUN ? 'INCOMPLETE' : 'PASS',
    attempts_per_case: k, planned_trials: k * cases.length, counts,
    critical_failures: cases.filter(item => item.safety_critical && item.attempts.some(attempt => attempt.status === 'FAIL')).map(item => item.id),
    metrics: { pass_at_1: metric('pass_at_1'), pass_within_k: metric('pass_within_k'), all_k_pass: metric('all_k_pass') }, cases,
    evidence_authenticated: false, release_authorized: false,
    note: 'Empirical scenario outcomes, not success-probability estimates. Evidence references and reviewer identities are not authenticated; inspect the artifacts independently. A later retry never erases a failed safety trial.' }
}

export async function main(args = process.argv.slice(2)) {
  const opts = options(args, ['--suite', '--results', '--out'], ['--init', '--help'])
  if (opts['--help']) { console.log('node scripts/agent-evals.mjs [--suite evals/partner-contracts.json] (--init | --results PATH) [--out NAME.json]'); return }
  requireThat(!!opts['--init'] !== !!opts['--results'], 'Choose either --init or --results')
  const suite = await readDocument(process.cwd(), opts['--suite'] || 'evals/partner-contracts.json')
  const report = opts['--init'] ? newRun(suite.value, suite.sha256) : score(suite.value, (await readDocument(process.cwd(), opts['--results'])).value, suite.sha256)
  if (opts['--out']) await writeArtifact(process.cwd(), opts['--out'], report)
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.status === 'FAIL' ? 1 : report.status === 'INCOMPLETE' ? 2 : 0
}
if (isMainModule(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ status: 'ERROR', message: error.message })); process.exitCode = 1 })
}
