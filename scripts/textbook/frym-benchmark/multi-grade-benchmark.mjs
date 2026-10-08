// scripts/textbook/frym-benchmark/multi-grade-benchmark.mjs
import { AXES, GRADES, hash } from './benchmark.mjs'
import { admitReference } from './reference-admission.mjs'

const CORE = ['lexical', 'syntax', 'information_density', 'discourse', 'inference']
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const fail = code => { throw Error(code) }
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
}
const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (sorted.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)
}
const same = (a, b) => hash(a) === hash(b)
const rangeKey = grades => grades.join('|')
const diverse = (rows, contract) => {
  const publishers = new Set(rows.map(row => row.publisher))
  if (publishers.size < contract.minimum_publishers) return false
  return [...publishers].every(publisher => {
    const own = rows.filter(row => row.publisher === publisher)
    return own.length / rows.length <= contract.maximum_publisher_share &&
      new Set(own.map(row => row.series)).size >= contract.minimum_series_per_publisher
  }) && rows.every(row => rows.filter(other => other.publisher === row.publisher && other.series === row.series).length / rows.length <= contract.maximum_series_share)
}

export function sealMultiGradeBenchmarkContract(input) {
  if (input?.schema !== 'multi-grade-benchmark-contract/1' || input.status !== 'sealed' ||
      !hex(input.group_hash) || !hex(input.codebook_hash) ||
      (input.reference_cohort !== undefined && !['commercial_textbook', 'open_reference'].includes(input.reference_cohort)) ||
      !['grade_range', 'multi_grade'].includes(input.grade_scope?.mode) ||
      !Array.isArray(input.grade_scope.grades) || input.grade_scope.grades.length < 2 ||
      input.grade_scope.grades.some(grade => !GRADES.includes(grade)) ||
      new Set(input.grade_scope.grades).size !== input.grade_scope.grades.length ||
      input.grade_scope.grades.some((grade, index) => index > 0 && GRADES.indexOf(grade) <= GRADES.indexOf(input.grade_scope.grades[index - 1])) ||
      (input.grade_scope.mode === 'grade_range' && input.grade_scope.grades.some((grade, index) => index > 0 && GRADES.indexOf(grade) !== GRADES.indexOf(input.grade_scope.grades[index - 1]) + 1)) ||
      !['shared_passage_grade_specific_items', 'grade_specific_adaptations', 'grade_specific_units'].includes(input.delivery_mode) ||
      !Number.isInteger(input.minimum_per_grade) || input.minimum_per_grade < 30 ||
      !Number.isInteger(input.minimum_range_reference) || input.minimum_range_reference < 12 ||
      !Number.isInteger(input.minimum_publishers) || input.minimum_publishers < 3 ||
      !Number.isInteger(input.minimum_series_per_publisher) || input.minimum_series_per_publisher < 2 ||
      input.maximum_publisher_share !== .4 || input.maximum_series_share !== .2 ||
      !Array.isArray(input.item_types) || !input.item_types.length ||
      new Set(input.item_types).size !== input.item_types.length ||
      input.item_types.some(type => typeof type !== 'string' || !type) ||
      !Number.isInteger(input.minimum_matching_item_types) ||
      input.minimum_matching_item_types < 2 || input.minimum_matching_item_types > input.item_types.length ||
      input.lower_quantile !== .1 || input.upper_quantile !== .9 ||
      input.minimum_matching_axes !== 3 || input.minimum_stable_axes !== 5 ||
      input.maximum_opposite_axes !== 1 || input.minimum_reference_ratio !== .5) fail('MULTI_GRADE_CONTRACT_INVALID')
  return { contract: input, contract_hash: hash(input) }
}

const validReference = (row, contract) => {
  const scope = row?.grade_scope
  return typeof row.sample_id === 'string' && row.sample_id && hex(row.passage_hash) &&
    hex(row.admission_receipt_hash) && row.codebook_hash === contract.codebook_hash &&
    row.rights_basis === (contract.reference_cohort === 'open_reference' ?
      'open_license_verified' : 'authorized_local_analysis') &&
    (contract.reference_cohort === 'open_reference' ? row.cohort === 'open_reference' :
      row.cohort === undefined || row.cohort === 'commercial_textbook') &&
    typeof row.publisher === 'string' && row.publisher &&
    typeof row.series === 'string' && row.series &&
    ['expository', 'argumentative', 'narrative'].includes(row.genre) &&
    Number.isInteger(row.word_count) && row.word_count > 0 &&
    ['single_grade', 'grade_range', 'multi_grade'].includes(scope?.mode) &&
    Array.isArray(scope.grades) && scope.grades.length > 0 &&
    scope.grades.every(grade => GRADES.includes(grade)) &&
    (scope.mode === 'single_grade' ? scope.grades.length === 1 : scope.grades.length >= 2) &&
    AXES.every(axis => Number.isFinite(row.metrics?.[axis])) &&
    contract.item_types.every(type => Number.isFinite(row.item_type_difficulty?.[type]))
}

const statusFromFit = (axisFit, itemFit) => {
  if (CORE.some(axis => axisFit[axis] === 'fail') || itemFit === 'fail' ||
      Object.values(axisFit).filter(status => status === 'pass').length < 7) return 'fail'
  return 'pass'
}

function fitAgainst(value, rows, contract) {
  const axes = Object.fromEntries(AXES.map(axis => {
    const low = quantile(rows.map(row => row.metrics[axis]), contract.lower_quantile)
    const high = quantile(rows.map(row => row.metrics[axis]), contract.upper_quantile)
    return [axis, value.metrics[axis] >= low && value.metrics[axis] <= high ? 'pass' : 'fail']
  }))
  const item_types = Object.fromEntries(contract.item_types.map(type => {
    const low = quantile(rows.map(row => row.item_type_difficulty[type]), contract.lower_quantile)
    const high = quantile(rows.map(row => row.item_type_difficulty[type]), contract.upper_quantile)
    return [type, value.item_type_difficulty[type] >= low && value.item_type_difficulty[type] <= high ? 'pass' : 'fail']
  }))
  return { status: statusFromFit(axes, Object.values(item_types).includes('fail') ? 'fail' : 'pass'), axes, item_types, n: rows.length }
}

function pairSeparation(variants, references, contract, low, high) {
  if (variants[low].genre !== variants[high].genre)
    return { status: 'inconclusive', reason: 'GENRE_MISMATCH' }
  const minLength = Math.max(variants[low].word_count * .75, variants[high].word_count * .75)
  const maxLength = Math.min(variants[low].word_count * 1.25, variants[high].word_count * 1.25)
  if (minLength > maxLength) return { status: 'inconclusive', reason: 'NO_COMMON_LENGTH_RANGE' }
  const comparable = row => row.genre === variants[low].genre && row.word_count >= minLength && row.word_count <= maxLength
  const lowRows = references.filter(row => row.grade_scope.mode === 'single_grade' && row.grade_scope.grades[0] === low && comparable(row))
  const highRows = references.filter(row => row.grade_scope.mode === 'single_grade' && row.grade_scope.grades[0] === high && comparable(row))
  if (lowRows.length < contract.minimum_per_grade || highRows.length < contract.minimum_per_grade ||
      !diverse(lowRows, contract) || !diverse(highRows, contract))
    return { status: 'insufficient_benchmark', reason: 'COMPARABLE_REFERENCE_SHORTAGE' }
  if (contract.delivery_mode === 'shared_passage_grade_specific_items') {
    const stable = [], matching = [], opposite = []
    for (const type of contract.item_types) {
      const referenceDelta = median(highRows.map(row => row.item_type_difficulty[type])) - median(lowRows.map(row => row.item_type_difficulty[type]))
      const actualDelta = variants[high].item_type_difficulty[type] - variants[low].item_type_difficulty[type]
      if (referenceDelta <= 0) continue
      const publishers = new Set([...lowRows, ...highRows].map(row => row.publisher))
      if ([...publishers].some(publisher => {
        const lo = lowRows.filter(row => row.publisher !== publisher)
        const hi = highRows.filter(row => row.publisher !== publisher)
        return !lo.length || !hi.length ||
          median(hi.map(row => row.item_type_difficulty[type])) <= median(lo.map(row => row.item_type_difficulty[type]))
      })) continue
      stable.push(type)
      if (actualDelta >= referenceDelta * contract.minimum_reference_ratio) matching.push(type)
      else if (actualDelta < 0) opposite.push(type)
    }
    if (stable.length < contract.minimum_matching_item_types)
      return { status: 'inconclusive', stable, matching, opposite, basis: 'item_difficulty' }
    return { status: matching.length >= contract.minimum_matching_item_types && !opposite.length ? 'pass' : 'fail',
      stable, matching, opposite, basis: 'item_difficulty' }
  }
  const stable = [], matching = [], opposite = []
  for (const axis of AXES) {
    const referenceDelta = median(highRows.map(row => row.metrics[axis])) - median(lowRows.map(row => row.metrics[axis]))
    const actualDelta = variants[high].metrics[axis] - variants[low].metrics[axis]
    if (referenceDelta <= 0) continue
    const publishers = new Set([...lowRows, ...highRows].map(row => row.publisher))
    if ([...publishers].some(publisher => {
      const lo = lowRows.filter(row => row.publisher !== publisher)
      const hi = highRows.filter(row => row.publisher !== publisher)
      return !lo.length || !hi.length || median(hi.map(row => row.metrics[axis])) <= median(lo.map(row => row.metrics[axis]))
    })) continue
    stable.push(axis)
    if (actualDelta >= referenceDelta * contract.minimum_reference_ratio) matching.push(axis)
    else if (actualDelta < 0) opposite.push(axis)
  }
  if (stable.length < contract.minimum_stable_axes ||
      !stable.some(axis => axis === 'discourse' || axis === 'inference'))
    return { status: 'inconclusive', stable, matching, opposite, basis: 'passage_difficulty' }
  return { status: matching.length >= contract.minimum_matching_axes &&
    matching.some(axis => axis === 'discourse' || axis === 'inference') &&
    opposite.length <= contract.maximum_opposite_axes ? 'pass' : 'fail',
  stable, matching, opposite, basis: 'passage_difficulty' }
}

function separation(variants, references, contract) {
  const grades = contract.grade_scope.grades
  const pairs = grades.slice(1).map((high, index) => ({
    low: grades[index], high,
    ...pairSeparation(variants, references, contract, grades[index], high),
  }))
  const status = pairs.some(pair => pair.status === 'fail') ? 'fail' :
    pairs.some(pair => pair.status === 'insufficient_benchmark') ? 'insufficient_benchmark' :
      pairs.some(pair => pair.status === 'inconclusive') ? 'inconclusive' : 'pass'
  return { status, basis: pairs[0]?.basis, pairs }
}

function evaluateMultiGradeCore({ contract: rawContract, group, evidence, variants, references }) {
  const { contract, contract_hash } = sealMultiGradeBenchmarkContract(rawContract)
  if (group?.schema !== 'textbook-product-order-group/1' || hash(group) !== contract.group_hash ||
      !same(group.grade_scope, contract.grade_scope) || group.delivery_mode !== contract.delivery_mode ||
      !Array.isArray(group.orders) || group.orders.length !== contract.grade_scope.grades.length ||
      !evidence || evidence.group_id !== group.group_id || evidence.group_revision !== group.group_revision ||
      evidence.group_hash !== contract.group_hash || !evidence.source_id ||
      !hex(evidence.source_hash) || !hex(evidence.rights_hash) ||
      !Array.isArray(evidence.variants) || evidence.variants.length !== contract.grade_scope.grades.length ||
      !variants || !Array.isArray(references)) fail('MULTI_GRADE_EVIDENCE_MIXED')
  for (const [index, grade] of contract.grade_scope.grades.entries()) {
    const entry = group.orders[index], bound = evidence.variants[index]
    if (entry?.grade !== grade || bound?.grade !== grade ||
        bound.product_order_id !== entry.order?.product_order_id ||
        bound.order_revision !== entry.order?.order_revision ||
        bound.order_hash !== hash(entry.order) || !hex(bound.passage_hash) ||
        !(bound.adaptation_hash === null || hex(bound.adaptation_hash)) ||
        !hex(bound.item_set_hash) || !(bound.activity_hash === null || hex(bound.activity_hash)) ||
        !hex(bound.benchmark_snapshot_hash) || !hex(bound.unit_set_hash) || !hex(bound.analysis_hash))
      fail('MULTI_GRADE_CHILD_ORDER_STALE_OR_MIXED')
  }
  const boundPassages = evidence.variants.map(row => row.passage_hash)
  const boundAdaptations = evidence.variants.map(row => row.adaptation_hash)
  if (contract.delivery_mode === 'shared_passage_grade_specific_items' &&
      (new Set(boundPassages).size !== 1 || new Set(boundAdaptations).size !== 1 ||
        new Set(evidence.variants.map(row => row.item_set_hash)).size !== evidence.variants.length))
    fail('MULTI_GRADE_SHARED_PASSAGE_MISMATCH')
  if (contract.delivery_mode === 'grade_specific_adaptations' &&
      (new Set(boundPassages).size !== boundPassages.length || boundAdaptations.some(value => value === null)))
    fail('MULTI_GRADE_ADAPTATION_MISMATCH')
  if (contract.delivery_mode === 'grade_specific_units' &&
      new Set(evidence.variants.map(row => row.unit_set_hash)).size !== evidence.variants.length)
    fail('MULTI_GRADE_UNIT_SET_REUSED')
  const distinctIds = new Set(), distinctPassages = new Set()
  for (const row of references) {
    if (!validReference(row, contract) || distinctIds.has(row.sample_id) || distinctPassages.has(row.passage_hash))
      fail('MULTI_GRADE_REFERENCE_INVALID_OR_DUPLICATE')
    distinctIds.add(row.sample_id); distinctPassages.add(row.passage_hash)
  }
  const fit = {}, item_compatibility = {}
  let insufficient = false
  for (const grade of contract.grade_scope.grades) {
    const variant = variants[grade], bound = evidence.variants.find(row => row.grade === grade)
    if (!variant || !bound || variant.grade !== grade || variant.order_hash !== bound.order_hash ||
        variant.source_id !== evidence.source_id || variant.source_hash !== evidence.source_hash ||
        variant.rights_hash !== evidence.rights_hash ||
        variant.adaptation_hash !== bound.adaptation_hash || variant.activity_hash !== bound.activity_hash ||
        variant.benchmark_version !== bound.benchmark_version ||
        variant.unit_set_hash !== bound.unit_set_hash || variant.codebook_hash !== contract.codebook_hash ||
        hash(variant) !== bound.analysis_hash || variant.passage_hash !== bound.passage_hash ||
        variant.item_set_hash !== bound.item_set_hash || variant.benchmark_snapshot_hash !== bound.benchmark_snapshot_hash ||
        !['expository', 'argumentative', 'narrative'].includes(variant.genre) ||
        !Number.isInteger(variant.word_count) || variant.word_count < 1 ||
        !AXES.every(axis => Number.isFinite(variant.metrics?.[axis])) ||
        !contract.item_types.every(type => Number.isFinite(variant.item_type_difficulty?.[type])))
      fail('MULTI_GRADE_VARIANT_STALE_OR_INCOMPLETE')
    const rows = references.filter(row => row.grade_scope.mode === 'single_grade' && row.grade_scope.grades[0] === grade &&
      row.genre === variant.genre && row.word_count >= variant.word_count * .75 && row.word_count <= variant.word_count * 1.25)
    if (rows.length < contract.minimum_per_grade || !diverse(rows, contract)) {
      insufficient = true
      fit[grade] = { status: 'insufficient_benchmark', n: rows.length }
      item_compatibility[grade] = 'unopened'
    } else {
      fit[grade] = fitAgainst(variant, rows, contract)
      item_compatibility[grade] = Object.values(fit[grade].item_types).every(status => status === 'pass') ? 'pass' : 'fail'
    }
  }
  const first = variants[contract.grade_scope.grades[0]]
  const minRangeLength = Math.max(...contract.grade_scope.grades.map(grade => variants[grade].word_count * .75))
  const maxRangeLength = Math.min(...contract.grade_scope.grades.map(grade => variants[grade].word_count * 1.25))
  const rangeRows = references.filter(row => row.grade_scope.mode === contract.grade_scope.mode &&
    rangeKey(row.grade_scope.grades) === rangeKey(contract.grade_scope.grades) &&
    row.genre === first.genre && row.word_count >= minRangeLength && row.word_count <= maxRangeLength)
  const rangeAvailable = rangeRows.length >= contract.minimum_range_reference && diverse(rangeRows, contract)
  if (!rangeAvailable) insufficient = true
  let shared_core_fit = { status: 'insufficient_benchmark', n: rangeRows.length }
  if (rangeAvailable) {
    const byGrade = Object.fromEntries(contract.grade_scope.grades.map(grade => [grade,
      Object.fromEntries(CORE.map(axis => {
        const low = quantile(rangeRows.map(row => row.metrics[axis]), contract.lower_quantile)
        const high = quantile(rangeRows.map(row => row.metrics[axis]), contract.upper_quantile)
        return [axis, variants[grade].metrics[axis] >= low && variants[grade].metrics[axis] <= high ? 'pass' : 'fail']
      }))]))
    shared_core_fit = { status: Object.values(byGrade).every(axisResults =>
      Object.values(axisResults).every(value => value === 'pass')) ? 'pass' : 'fail',
    by_grade: byGrade, n: rangeRows.length }
  }
  const span = insufficient ? { status: 'insufficient_benchmark' } : separation(variants, references, contract)
  const status = Object.values(fit).some(row => row.status === 'fail') || shared_core_fit.status === 'fail' || span.status === 'fail'
    ? 'fail' : insufficient || span.status === 'insufficient_benchmark' ? 'insufficient_benchmark' :
      span.status === 'inconclusive' ? 'inconclusive' : 'pass'
  const basis = {
    schema: 'multi-grade-benchmark-decision/1', status, evidence_level: 'contract_only', admissible: false,
    group_hash: contract.group_hash, contract_hash, evidence_hash: hash(evidence),
    reference_snapshot_hash: hash(references), variant_analysis_hash: hash(variants),
    lower_bound_fit: fit[contract.grade_scope.grades[0]],
    upper_bound_fit: fit[contract.grade_scope.grades.at(-1)],
    grade_sub_fit: fit, shared_core_fit, grade_span_separation: span,
    item_compatibility, benchmark_contract_pass: status === 'pass',
    // This function does not verify admission receipts or human certification.
    gold_s_candidate: false, gold_s: false, db_seed: false,
  }
  return { ...basis, decision_hash: hash(basis) }
}

export function evaluateMultiGradeBenchmark(input) {
  if (input?.contract?.reference_cohort === 'open_reference') fail('OPEN_REFERENCE_ADMISSION_REQUIRED')
  return evaluateMultiGradeCore(input)
}

export function evaluateAdmittedMultiGradeBenchmark({ admitted, ...input }) {
  if (!Array.isArray(admitted) || !admitted.length ||
      !['commercial_textbook', 'open_reference'].includes(input.contract?.reference_cohort))
    fail('ADMITTED_REFERENCE_SET_REQUIRED')
  const references = admitted.map(bundle => {
    const verified = admitReference(bundle.input)
    if (!same(bundle.receipt, verified.receipt) || !same(bundle.reference, verified.reference))
      fail('ADMITTED_REFERENCE_STALE_OR_MIXED')
    return verified.reference
  })
  return evaluateMultiGradeCore({ ...input, references })
}
