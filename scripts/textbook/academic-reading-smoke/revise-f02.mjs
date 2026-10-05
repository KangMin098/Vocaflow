// scripts/textbook/academic-reading-smoke/revise-f02.mjs
import fs from 'node:fs'
import path from 'node:path'

const base = path.resolve(process.argv[2] ?? '.agent-logs/academic-reading-f02-r2')
const prior = path.resolve(process.argv[3] ?? '.agent-logs/academic-reading-e2e-smoke/replay')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const axis = (level, evidence) => ({ level, evidence })
const count = text => ({
  words: text.match(/\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g)?.length ?? 0,
  sentences: text.match(/[.!?](?=\s|$)/g)?.length ?? 0,
  paragraphs: text.split(/\n\s*\n/).length,
})

for (const dir of ['middle1', 'high1']) {
  const file = path.join(base, dir, 'chunk-00.json')
  const rows = read(file)
  const input = rows.find(x => x.reading?.preservation_rules?.entry?.pair_id === 'F02')
  const oldInput = read(path.join(prior, dir, 'chunk-00.json')).find(x => x.reading?.preservation_rules?.entry?.pair_id === 'F02')
  const old = read(path.join(prior, dir, 'chunk-00.out.json')).find(x => x.adapted_from_id === input?.adapted_from_id)
  if (!input || !old || input.reading.source_hash !== oldInput.reading.source_hash ||
      input.reading.target_key !== oldInput.reading.target_key ||
      input.reading.source_revision !== oldInput.reading.source_revision)
    throw new Error(`F02 ${dir}: current export differs from prior smoke; inspect source/target before revision`)
  const middle = dir === 'middle1'
  const draft = structuredClone(old)
  const a = draft.reading.reading_analysis
  if (middle) {
    draft.text = draft.text.replace('These roles are different. Saying', 'These roles are different. Vision remains important. Saying')
    draft.text = draft.text.replace(
      'We may notice what we see more often than what we feel. However, noticing a sense often is not the same as showing that it is more important for every task. A sense can help us even when we are not paying close attention to it.',
      'Touch can help us even when we do not notice it. We feel where our feet are when we walk. Vision helps us look for where to go. We use both senses in a simple walk, just as we use both to find and hold a packet.'
    )
  } else {
    draft.text = draft.text.replace(
      'A claim that vision is our most important sense may sound simple. Yet the word important needs a clear meaning. Important for finding a place? Important for feeling the position of our bodies? Changing the question can change the answer.',
      'An online question asked which sense people feared losing most. Most chose vision. Does that make vision the most important sense? The word important needs a clear meaning. Important for finding a place? Important for feeling the position of our bodies?'
    )
    draft.text = draft.text.replace(
      'The difference matters when we judge a general claim. An example showing that vision helps with one task does not establish that it is the best sense for every task. Likewise, an example showing the value of touch does not make touch the universal winner.',
      'A person who lost the sense of touch had trouble moving because he could not feel where his arms and legs were. That story shows how much we need touch. Does it make touch more important than vision? Vision is important too.'
    ).replace(
      'The explanation therefore moves from ranking senses to comparing their functions. This change does not make vision unimportant. It shows why a single ranking may leave out useful information. To evaluate the original claim, a reader should ask which task or need the speaker has in mind. Without that condition, the word important can cover several different ideas.',
      'The online answers show what people fear losing. The touch story shows another kind of need. Neither one alone can tell us which sense is most important. Vision and touch have different jobs: one helps us find our way, while the other helps us feel our bodies. Both matter, but for different reasons. A single winner would hide that difference.'
    )
  }
  const stats = count(draft.text)
  const sourceStats = count(input.source_text)
  if (stats.words < input.reading.target.words.min || stats.words > input.reading.target.words.max)
    throw new Error(`${dir}: passage outside target word range`)

  // These are proposed analytic ratings with observable evidence, not student-calibrated levels.
  a.source_profile = {
    lexical_level: axis(6, 'The FYM source uses receptors, brain regions, and specialized for processing; these technical terms add lexical burden.'),
    syntax_level: axis(6, 'The source embeds a contrast in “while vision is fundamental for navigating within the world” inside a longer sentence.'),
    abstraction_level: axis(7, 'The source moves from a supermarket example to “ranking any of the senses as ‘most important’ becomes less relevant”.'),
    information_density: axis(6, `The complete source has ${sourceStats.words} words and includes survey, touch, brain, culture, and historical-screen arguments; the adaptation retains one functional contrast.`),
    discourse_level: axis(7, 'The source explicitly develops several arguments under separate headings: importance, brain, cultures, and conclusion.'),
    inference_level: axis(7, 'Readers must distinguish survey preference from functional importance and assess why a single ranking becomes less relevant.'),
    background_knowledge: axis(5, 'The source introduces brain regions, sensory receptors, and a clinical touch-loss case beyond the everyday shopping example.'),
    age_appropriateness: { appropriate: true, evidence: 'The source discusses senses and sensory loss without mature material; the clinical case may require explanation.' },
    exam_level: { exam: 'none', evidence: 'This is an explanatory FYM article, with no examination framing.' },
    overall_level: axis(7, 'This is a qualitative pre-pilot estimate from technical vocabulary, multiple argument strands, and cross-paragraph inference; it is not measured difficulty.'),
  }
  a.passage_profile = middle ? {
    lexical_level: axis(3, 'Most content words name daily actions and objects: eyes, packet, find, reach, hold, body, and world. The abstract phrase “most important” is repeated with an immediate task example. This is a qualitative V3 hypothesis, not a dictionary or student score.'),
    syntax_level: axis(3, `The ${stats.words}-word draft has ${stats.sentences} short sentences across ${stats.paragraphs} paragraphs; “When you reach for it” and “Instead of asking” are the main dependent openings, with no nested explanation.`),
    abstraction_level: axis(3, 'The packet action makes the abstract contrast concrete before “These roles are different” and the final task-based conclusion.'),
    information_density: axis(3, 'Paragraph 1 uses one packet action for two functions; paragraph 2 generalizes them; paragraph 3 illustrates unnoticed reliance on touch; paragraph 4 restates the task-based conclusion.'),
    discourse_level: axis(3, 'The sequence is packet example → function contrast → walking example → explicit main idea, with the two examples linked by “just as”.'),
    inference_level: axis(3, 'R2 asks for two stated details, R3 compares the packet and walking examples, and R4 combines the stated function contrast with the warning against one winner.'),
    background_knowledge: axis(2, 'The packet-on-a-shelf situation and bodily touch are described in the passage; no survey, anatomy, or scientific terminology is needed.'),
    age_appropriateness: { appropriate: true, evidence: 'The school-age reader can follow an ordinary shopping action; no mature or specialist content appears.' },
    exam_level: { exam: 'none', evidence: 'This is explanatory reading without exam conventions.' },
    overall_level: axis(3, 'Provisional V3 text target: short sentences, one familiar scenario, explicit connectors, and predominantly literal-to-one-step questions. Student difficulty and exact lexical band remain unmeasured.'),
  } : {
    lexical_level: axis(3, 'Daily words carry the examples (vision, touch, packet, shelf, fingers); the abstract idea of importance is explained through an online fear question and “different jobs”. This is a qualitative V3 hypothesis, not a dictionary or student score.'),
    syntax_level: axis(3, `The ${stats.words}-word draft has ${stats.sentences} mostly short sentences across ${stats.paragraphs} paragraphs. Short questions (“Does it make touch more important than vision?”) segment the reasoning; no technical subordinate chain is required.`),
    abstraction_level: axis(4, 'The reader compares online answers about feared loss with a touch-loss story, then separates each example from a universal winner claim.'),
    information_density: axis(3, 'Each paragraph has a distinct role: online fear answers, shop-function contrast, touch-loss story, and comparison of what each can establish.'),
    discourse_level: axis(4, 'R6 tracks the four-paragraph arc from online answers, to functions, to a contrasting touch story, to the limits of both examples.'),
    inference_level: axis(4, 'R8 asks readers to diagnose the same overreach in two opposite claims, one based on feared vision loss and one on a touch-loss story.'),
    background_knowledge: axis(2, 'The shop and bodily-position examples supply needed context; no anatomy, survey method, or specialist sensory knowledge is assumed.'),
    age_appropriateness: { appropriate: true, evidence: 'The content is everyday sensory experience; the added challenge is argument evaluation rather than mature subject matter.' },
    exam_level: { exam: 'none', evidence: 'This is explanatory reading without exam conventions.' },
    overall_level: axis(3, 'Provisional V3 passage-language target with high_1 reasoning in R6–R8. Higher discourse/inference demands do not independently raise the whole-text vocabulary target; student performance remains unmeasured.'),
  }
  a.source_claims = [
    { claim: 'Vision and touch have different functions.', quote: 'our various senses have different functions' },
    { claim: 'Understanding those functions makes an absolute importance ranking less relevant.', quote: 'ranking any of the senses as “most important” becomes less relevant' },
  ]
  if (!middle) a.source_claims.push({ claim: 'Most survey respondents feared losing vision.', quote: 'out of which 67 claimed that they are most scared of losing their sense of vision' })
  a.discourse = [
    { relation: 'The source first acknowledges the importance of vision, then gives touch a distinct function and rejects a single winner.', quote: 'Should we conclude from this that touch, and not vision, is our most important sense? I do not think so—vision is important!' },
  ]
  a.preserved_claims = [
    { source_quote: 'touch is fundamental for feeling our own bodies and the borders between our bodies and the world, while vision is fundamental for navigating within the world', passage_quote: middle ? 'Touch also gives information about your body and its position. Vision gives information about the world around you and helps you find your way through it.' : 'Vision helps us notice things around us and find our way toward them. Touch gives information about how our bodies meet the world.' },
    { source_quote: 'ranking any of the senses as “most important” becomes less relevant', passage_quote: middle ? 'Saying that one sense is always the most important would hide this difference.' : 'A single winner would hide that difference.' },
  ]
  a.preservation_checks = [{
    rule_id: 'F02-functions', verdict: 'preserved',
    passage_quote: middle ? 'Vision remains important. Saying that one sense is always the most important would hide this difference.' : 'Both matter, but for different reasons. A single winner would hide that difference.',
    reason: middle
      ? 'The packet and body-position examples assign distinct jobs to vision and touch; the cited sentences retain vision’s value and explain why one absolute ranking hides that difference.'
      : 'The touch-loss story is followed by an explicit refusal to make touch the winner; the final comparison retains both senses and their different functions.',
  }]
  // The noticing distinction and touch example are source-bound paraphrases, not external background.
  a.added_background = []
  if (middle) a.discourse.push({ relation: 'The source says touch is relied on without noticing it; the middle passage uses walking as the same concrete example of unnoticed touch.', quote: 'how much we rely on it in our daily lives, most of the time without noticing it' })
  else {
    a.discourse.push({ relation: 'The source’s touch-loss case grounds the high passage’s second example before the author rejects touch as a winner.', quote: 'The case of Ian Waterman illustrates how lost we would be without the sense of touch' })
    a.discourse.push({ relation: 'The opening online answers summarize what respondents feared losing; the source later compares other reasons for sensory importance.', quote: 'out of which 67 claimed that they are most scared of losing their sense of vision' })
    a.discourse.push({ relation: 'The passage’s comparison of feared loss and function is an interpretation of the source’s account of vision-focused impressions, not a directly reported survey conclusion.', quote: 'our impression that vision is our most important sense is probably reinforced by the fact that we live in societies that are dominated by visual input' })
  }
  if (middle) {
    a.item_plan = [
      { skill: 'R2', kind: 'question', item_reasoning_level: 2, item_difficulty: 2, difficulty_evidence: 'Literal retrieval: two adjacent sentences name what vision and touch do with the packet; no cross-paragraph inference is needed.', prompt: 'Which sense helps find the packet, and which helps check the grip?', expected_response: 'Vision helps find the packet; touch helps check that it is held firmly.', evidence: ['Your eyes help you find the packet and see where it is.', 'When you reach for it, touch helps you feel whether you are holding it firmly.'], resource_evidence: [], time_limit_seconds: null },
      { skill: 'R3', kind: 'question', item_reasoning_level: 3, item_difficulty: 3, difficulty_evidence: 'Cross-example relation: the reader compares packet and walking actions, then identifies the common vision-for-locating and touch-for-body-or-grip pattern.', prompt: 'What similar roles do vision and touch play when we walk and when we find and hold a packet?', expected_response: 'In both actions, vision helps us find a place or object, while touch helps us feel our body or grip.', evidence: ['Your eyes help you find the packet and see where it is. When you reach for it, touch helps you feel whether you are holding it firmly.', 'We feel where our feet are when we walk. Vision helps us look for where to go.'], resource_evidence: [], time_limit_seconds: null },
      { skill: 'R4', kind: 'question', item_reasoning_level: 3, item_difficulty: 3, difficulty_evidence: 'Main-idea synthesis: the reader joins the stated different functions with the explicit warning that a single ranking hides their value.', prompt: 'What main idea does the passage teach about ranking senses?', expected_response: 'Different senses serve different needs, so one absolute ranking is less useful.', evidence: ['Touch also gives information about your body and its position. Vision gives information about the world around you and helps you find your way through it.', 'Saying that one sense is always the most important would hide this difference.', 'Instead of asking only which sense should win a contest, ask what information you need for a particular action.'], resource_evidence: [], time_limit_seconds: null },
    ]
  } else {
    a.item_plan = [
      { skill: 'R4', kind: 'question', item_reasoning_level: 3, item_difficulty: 3, difficulty_evidence: 'Central claim: combine the function contrast with the final statement that both senses matter for different reasons.', prompt: 'What is the passage’s central claim about the most important sense?', expected_response: 'Vision and touch are both important for different reasons, so one winner is less useful.', evidence: ['Vision helps us notice things around us and find our way toward them. Touch gives information about how our bodies meet the world.', 'Both matter, but for different reasons. A single winner would hide that difference.'], resource_evidence: [], time_limit_seconds: null },
      { skill: 'R6', kind: 'question', item_reasoning_level: 4, item_difficulty: 4, difficulty_evidence: 'Discourse sequence: readers must connect online fear answers, paragraph-2 function contrast, the paragraph-3 touch-loss story, and the final comparison of their limits.', prompt: 'How does the passage develop its argument?', expected_response: 'It introduces online answers favoring vision, compares the senses’ jobs, presents a touch-loss story, then concludes that neither example alone settles one most important sense.', evidence: ['An online question asked which sense people feared losing most. Most chose vision.', 'Vision helps us notice things around us and find our way toward them. Touch gives information about how our bodies meet the world.', 'A person who lost the sense of touch had trouble moving because he could not feel where his arms and legs were.', 'Neither one alone can tell us which sense is most important.'], resource_evidence: [], time_limit_seconds: null },
      { skill: 'R7', kind: 'question', item_reasoning_level: 3, item_difficulty: 3, difficulty_evidence: 'Local phrase paraphrase: readers interpret bodily contact using the nearby shop action and touch-loss story, separate from the central ranking claim.', prompt: 'What does “how our bodies meet the world” mean in this passage?', expected_response: 'Touch tells us about bodily position and contact, such as whether we hold a packet firmly.', evidence: ['Touch gives information about how our bodies meet the world.', 'Touch helps us feel whether our fingers are holding it firmly.', 'A person who lost the sense of touch had trouble moving because he could not feel where his arms and legs were.'], resource_evidence: [], time_limit_seconds: null },
      { skill: 'R8', kind: 'question', item_reasoning_level: 4, item_difficulty: 4, difficulty_evidence: 'Cross-example claim evaluation: the reader compares feared vision loss with a touch-loss case and explains why neither single kind of evidence proves one universally most important sense.', prompt: 'One reader says the online answers prove vision is most important; another says the touch story proves touch is most important. What mistake do both readers make?', expected_response: 'Each uses one kind of evidence to pick a single winner, although the senses help us in different ways and neither example alone settles the ranking.', evidence: ['An online question asked which sense people feared losing most. Most chose vision.', 'That story shows how much we need touch. Does it make touch more important than vision? Vision is important too.', 'Neither one alone can tell us which sense is most important.', 'Both matter, but for different reasons.'], resource_evidence: [], time_limit_seconds: null },
    ]
  }
  draft.reading.source_attribution = old.reading.source_attribution
  fs.writeFileSync(path.join(base, dir, 'chunk-00.out.json'), `${JSON.stringify(rows.map(row => row.adapted_from_id === input.adapted_from_id ? draft : row), null, 2)}\n`)
  console.log(`${dir}: ${stats.words} words, ${stats.sentences} sentences, ${stats.paragraphs} paragraphs`)
}
