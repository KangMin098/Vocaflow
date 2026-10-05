// scripts/textbook/frym-synthetic/f02-synthetic.mjs
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = new URL('./', import.meta.url)
const validation = new URL('../frym-validation/', dir)
const read = url => JSON.parse(readFileSync(url, 'utf8'))
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const sha = value => createHash('sha256').update(value).digest('hex')
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
const grades = ['middle_1', 'high_1']
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const languageFeatures = passage => {
  const words = passage.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []
  const sentences = passage.split(/[.!?]+/).map(part => part.trim()).filter(Boolean)
  const lengths = sentences.map(sentence => (sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).length)
  return {
    word_count: words.length,
    sentence_count: sentences.length,
    mean_words_per_sentence: sentences.length ? mean(lengths) : null,
    long_sentence_count_over_20_words: lengths.filter(length => length > 20).length,
    type_token_ratio: words.length ? new Set(words.map(word => word.toLowerCase())).size / words.length : null
  }
}

export function buildF02Synthetic() {
  const protocol = read(new URL('f02-protocol.v1.json', dir))
  const freeze = read(new URL('f02-calibration-freeze.json', validation))
  const passages = read(new URL('f02-passages.freeze.json', validation))
  const items = read(new URL('f02-items.proposed.json', validation))
  const key = read(new URL('f02-scoring-key.proposed.json', validation))
  const humanManifest = read(new URL('f02-preregistration.proposed.json', validation))
  if (protocol.status !== 'unbenchmarked' || protocol.benchmark_version !== null || freeze.pair_id !== 'F02' || passages.pair_id !== 'F02' || humanManifest.status !== 'candidate_unsealed') throw Error('F02 synthetic inputs invalid')
  const passageHash = Object.fromEntries(grades.map(grade => [grade, sha(passages.passages[grade])]))
  if (canonical(passageHash) !== canonical(humanManifest.passage_hash)) throw Error('F02 passage hash changed')
  if (sha(canonical({ middle_1: items.middle_1, high_1: items.high_1 })) !== humanManifest.item_set_hash || sha(canonical({ scale: key.scoring_scale, general_rule: key.general_rule, middle_1: key.middle_1, high_1: key.high_1 })) !== humanManifest.scoring_key_hash) throw Error('F02 item or scoring hash changed')
  if (new Set(protocol.ability_levels).size !== 7 || protocol.ability_levels.some(ability => !protocol.ability_constraints[ability]) || grades.some(grade => !protocol.epistemic_states[grade] || freeze.variants.find(variant => variant.grade === grade)?.passage_sha256 !== passageHash[grade])) throw Error('Synthetic profiles or freeze incomplete')
  const seal = {
    version: 1,
    pair_id: 'F02',
    scope: 'synthetic_diagnostic_only',
    source_freeze_sha256: sha(readFileSync(new URL('f02-calibration-freeze.json', validation))),
    passage_hash: passageHash,
    item_set_hash: humanManifest.item_set_hash,
    scoring_key_hash: humanManifest.scoring_key_hash,
    protocol_hash: sha(canonical(protocol)),
    benchmark_version: null
  }
  seal.seal_sha256 = sha(canonical(seal))
  const packets = []
  for (const grade of grades) for (const ability of protocol.ability_levels) for (const passageVariant of grades) {
    const body = {
      pair_id: 'F02', seal_sha256: seal.seal_sha256,
      profile: { grade, ability, ...protocol.epistemic_states[grade], ability_constraints: protocol.ability_constraints[ability] },
      passage: passages.passages[passageVariant],
      questions: items[passageVariant].map(({ id, prompt }) => ({ id, prompt }))
    }
    if (body.questions.length !== 12 || body.questions.some(q => !q.prompt)) throw Error('F02 blind packet incomplete')
    packets.push({ packet_id: sha(canonical(body)), profile_id: `${grade}:${ability}`, passage_variant: passageVariant, body })
  }
  return { seal, packets, scoringKey: key }
}

const association = (xs, ys) => {
  if (xs.length < 3) return null
  const x = mean(xs), y = mean(ys)
  const numerator = xs.reduce((sum, value, i) => sum + (value - x) * (ys[i] - y), 0)
  const denominator = Math.sqrt(xs.reduce((sum, value) => sum + (value - x) ** 2, 0) * ys.reduce((sum, value) => sum + (value - y) ** 2, 0))
  return denominator ? numerator / denominator : null
}

export function analyzeF02Synthetic(rows, built = buildF02Synthetic()) {
  if (!Array.isArray(rows)) throw Error('Synthetic responses must be an array')
  const packets = new Map(built.packets.map(packet => [packet.packet_id, packet]))
  const seen = new Set(), scored = []
  for (const row of rows) {
    const packet = packets.get(row.packet_id)
    if (!packet || !hex(row.packet_id) || typeof row.model !== 'string' || row.model.length < 2 || typeof row.model_family !== 'string' || row.model_family.length < 2 || typeof row.scorer_model !== 'string' || row.scorer_model.length < 2 || typeof row.scorer_family !== 'string' || row.scorer_family.length < 2 || row.model_family === row.scorer_family || typeof row.replica_id !== 'string' || !row.replica_id || row.scoring_key_hash !== built.seal.scoring_key_hash) throw Error('Synthetic response provenance invalid')
    const identity = `${row.model_family}:${row.model}:${packet.profile_id}:${packet.passage_variant}:${row.replica_id}`
    if (seen.has(identity)) throw Error('Duplicate synthetic response')
    seen.add(identity)
    const ids = packet.body.questions.map(q => q.id)
    if (!Array.isArray(row.answers) || !Array.isArray(row.scores) || row.answers.length !== ids.length || row.scores.length !== ids.length || ids.some((id, index) => row.answers[index]?.id !== id || typeof row.answers[index]?.answer !== 'string' || !row.answers[index].answer.trim() || row.scores[index]?.id !== id || ![0, 0.5, 1].includes(row.scores[index]?.score))) throw Error('Synthetic answers or independent scores incomplete')
    scored.push({ ...row, profile_id: packet.profile_id, passage_variant: packet.passage_variant, item_ids: ids, total: row.scores.reduce((sum, item) => sum + item.score, 0) })
  }
  const byVariant = Object.fromEntries(grades.map(variant => {
    const subset = scored.filter(row => row.passage_variant === variant)
    const families = [...new Set(subset.map(row => row.model_family))].sort()
    const familyMeanAccuracy = Object.fromEntries(families.map(family => [family, mean(subset.filter(row => row.model_family === family).map(row => row.total / row.scores.length))]))
    const items = built.packets.find(packet => packet.passage_variant === variant).body.questions.map((item, index) => {
      const values = subset.map(row => row.scores[index].score)
      return { id: item.id, synthetic_facility: values.length ? mean(values) : null, corrected_item_total_association: association(values, subset.map(row => row.total - row.scores[index].score)), n_model_outputs: values.length }
    })
    return [variant, { language_features: languageFeatures(built.packets.find(packet => packet.passage_variant === variant).body.passage), n_model_outputs: subset.length, model_families: families, family_mean_accuracy: familyMeanAccuracy, between_family_range: families.length >= 2 ? Math.max(...Object.values(familyMeanAccuracy)) - Math.min(...Object.values(familyMeanAccuracy)) : null, items }]
  }))
  const matched = new Map()
  for (const row of scored) {
    const key = `${row.model_family}:${row.model}:${row.profile_id}:${row.replica_id}`
    if (!matched.has(key)) matched.set(key, {})
    matched.get(key)[row.passage_variant] = row.total / row.scores.length
  }
  const pairs = [...matched.values()].filter(pair => grades.every(grade => Number.isFinite(pair[grade])))
  return {
    pair_id: 'F02', seal_sha256: built.seal.seal_sha256, status: 'synthetic_diagnostic_unbenchmarked',
    n_model_outputs: scored.length, n_independent_model_families: new Set(scored.map(row => row.model_family)).size,
    by_variant: byVariant, matched_profile_pairs: pairs.length,
    observed_high_minus_middle_accuracy: pairs.length ? mean(pairs.map(pair => pair.high_1 - pair.middle_1)) : null,
    cross_model_consensus: { status: grades.every(variant => byVariant[variant].model_families.length >= 2) ? 'DESCRIPTIVE_ONLY' : 'INSUFFICIENT_MODEL_FAMILIES', threshold: null },
    irt: { status: 'not_estimated', reason: 'no externally calibrated ability anchor or validated response model' },
    target_fit: 'NOT_CALIBRATED', level_separation: 'NOT_CALIBRATED', educationally_validated: false, gold_s: false, db_seed: false
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, path] = process.argv.slice(2)
  if (verb === 'export' && path) {
    const built = buildF02Synthetic()
    mkdirSync(path)
    writeFileSync(resolve(path, 'seal.json'), `${JSON.stringify(built.seal, null, 2)}\n`)
    for (const packet of built.packets) writeFileSync(resolve(path, `${packet.packet_id}.json`), `${JSON.stringify({ packet_id: packet.packet_id, ...packet.body }, null, 2)}\n`)
    console.log(`Exported ${built.packets.length} blind synthetic packets; no student responses or validation result`)
  } else if (verb === 'analyze' && path) console.log(JSON.stringify(analyzeF02Synthetic(JSON.parse(readFileSync(path, 'utf8'))), null, 2))
  else throw Error('Usage: node f02-synthetic.mjs export <output-dir> | analyze <responses.json>')
}
