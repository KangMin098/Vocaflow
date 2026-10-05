// scripts/textbook/academic-reading-smoke/build-drafts.mjs
import fs from 'node:fs'
import path from 'node:path'

const base = path.resolve(process.argv[2] ?? '.agent-logs/academic-reading-e2e-smoke')
const pilot = JSON.parse(fs.readFileSync(path.resolve('scripts/textbook/frym-precision/adaptation-pilot-1.json'), 'utf8'))
const sourceQuotes = [
  'our various senses have different functions',
  'touch is fundamental for feeling our own bodies and the borders between our bodies and the world, while vision is fundamental for navigating within the world',
  'ranking any of the senses as “most important” becomes less relevant',
]
const profile = (age, passage) => {
  const easier = age === 'middle_1'
  const evidence = passage
    ? (easier ? 'The two senses give you different kinds of information.' : 'An example showing that vision helps with one task does not establish that it is the best sense for every task.')
    : 'To walk, we need to know the position of our body parts and we need to know whether we have a firm footing on the ground.'
  const axis = level => ({ level, evidence })
  return {
    lexical_level: axis(passage ? 3 : 6), syntax_level: axis(passage ? (easier ? 3 : 4) : 6),
    abstraction_level: axis(passage ? (easier ? 3 : 5) : 7), information_density: axis(passage ? 3 : 6),
    discourse_level: axis(passage ? (easier ? 3 : 5) : 7), inference_level: axis(passage ? (easier ? 3 : 5) : 7),
    background_knowledge: axis(passage ? 3 : 5),
    age_appropriateness: { appropriate: true, evidence: passage ? 'The reading discusses everyday senses with no mature content.' : 'The original discussion of senses is suitable for adolescent readers.' },
    exam_level: { exam: 'none', evidence: 'The source and adaptation are explanatory readings, not exam passages.' },
    overall_level: axis(passage ? (easier ? 3 : 4) : 7),
  }
}
const plans = {
  middle_1: [
    ['R2', 'How do vision and touch help with the packet?', 'Vision finds the packet; touch helps feel how firmly it is held.', 'Your eyes help you find the packet and see where it is. When you reach for it, touch helps you feel whether you are holding it firmly.'],
    ['R3', 'How are the two senses related in the action?', 'They give different but useful information in the same action.', 'The two senses give you different kinds of information. Both are useful in the same simple action.'],
    ['R4', 'What is the main idea of the passage?', 'Different senses serve different tasks, so a single absolute ranking misses the point.', 'The main idea is to look at what each sense does.'],
  ],
  high_1: [
    ['R4', 'What is the central claim about the most important sense?', 'Its importance depends on the task because senses have different functions.', 'The explanation therefore moves from ranking senses to comparing their functions.'],
    ['R6', 'How does the passage develop its argument?', 'It asks what important means, compares functions, then challenges a universal ranking.', 'The difference matters when we judge a general claim.'],
    ['R7', 'What does a single ranking may leave out useful information mean?', 'A single winner hides the different ways senses help us.', 'It shows why a single ranking may leave out useful information.'],
    ['R8', 'Why does one useful example fail to prove a universal ranking?', 'Because the value of a sense depends on the task being performed.', 'An example showing that vision helps with one task does not establish that it is the best sense for every task.'],
  ],
}
for (const [age, dir] of [['middle_1', 'middle1'], ['high_1', 'high1']]) {
  const file = path.join(base, dir, 'chunk-00.json')
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  const selected = rows.filter(x => x.reading.preservation_rules?.entry?.pair_id === 'F02')
  if (selected.length !== 1) throw new Error(`F02 export missing in ${dir}`)
  const input = selected[0]
  const adaptation = pilot.records.find(x => x.id === `F02-${dir}`)
  if (!adaptation || adaptation.target_key !== input.reading.target_key) throw new Error('pilot target differs from current export')
  for (const quote of sourceQuotes) if (!input.source_text.includes(quote)) throw new Error(`source quote absent: ${quote}`)
  const relation = input.reading.research_origin.relations.find(x => x.original_work_id === input.reading.preservation_rules.entry.original_work_id)
  if (!relation) throw new Error('research origin relation missing')
  const analysis = {
    source_profile: profile(age, false), passage_profile: profile(age, true),
    source_claims: [{ claim: 'Vision and touch have different functions; an absolute ranking is less useful.', quote: sourceQuotes[0] }],
    discourse: [{ relation: 'Different functions support the qualification of an absolute sensory ranking.', quote: sourceQuotes[2] }],
    preserved_claims: [{ source_quote: sourceQuotes[1], passage_quote: adaptation.checks[0].passage_quote }],
    added_background: [],
    item_plan: plans[age].map(([skill, prompt, expected_response, evidence]) => ({
      skill, kind: 'question', item_reasoning_level: skill === 'R8' ? 5 : skill === 'R6' ? 4 : 3,
      item_difficulty: skill === 'R8' ? 5 : 3,
      difficulty_evidence: `The learner must use the quoted passage to answer ${skill} without relying on an unsupported outside claim.`,
      prompt, expected_response, evidence: [evidence], resource_evidence: [], time_limit_seconds: null,
    })),
    preservation_checks: adaptation.checks,
    parallel_pair: { original_work_id: relation.original_work_id, research_url: relation.research_url,
      student_url: input.source_url, evidence: relation.evidence },
  }
  const rights = {
    canonical_source: 'frym', canonical_url: input.source_url, original_author: 'Fabian Hutmacher',
    published_at: '2021-07-28', license: 'CC-BY-4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/',
    commercial_use: true, derivative_use: true, ai_processing: 'allowed', third_party_text: false,
    third_party_image: false, attribution_required: true, share_alike: false,
    original_work_id: '10.3389/fpsyg.2019.02246', discovered_via: input.source_url,
    checked_at: '2026-10-05T00:00:00Z',
    evidence: 'The FYM article footer names Hutmacher and CC BY; only the body prose is adapted. Creative Commons BY 4.0 permits adaptation and commercial use with attribution.',
  }
  const draft = { ...input, title: `${input.source_title} — ${age === 'middle_1' ? 'Middle 1' : 'High 1'} adaptation`,
    text: adaptation.text, reading: { ...input.reading, source_rights: rights, reading_analysis: analysis } }
  fs.writeFileSync(path.join(base, dir, 'chunk-00.out.json'), `${JSON.stringify(rows.map(row => row.adapted_from_id === input.adapted_from_id ? draft : row), null, 2)}\n`)
  fs.writeFileSync(path.join(base, dir, 'source-current-summary.json'), `${JSON.stringify({source_id:input.adapted_from_id,source_revision:input.reading.source_revision,source_hash:input.reading.source_hash,target_key:input.reading.target_key,pilot_text_hash:adaptation.text_hash},null,2)}\n`)
  console.log(`${age}: F02 draft ${adaptation.text_hash}`)
}
