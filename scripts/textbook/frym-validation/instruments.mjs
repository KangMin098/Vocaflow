// scripts/textbook/frym-validation/instruments.mjs
// Draft probes require human approval before student data collection; no grade norms implied.
export function draftMeasurementItems(record) {
  const sentences=record.text.match(/[^.!?]+[.!?]+/g).map(s=>s.trim())
  const concepts={
    F02:['sense','information','important'],
    F06:['habitat','biodiversity','review'],
    F14:['symptoms','association','ICU'],
    F18:['ovarioles','positive association','species'],
  }[record.pair_id]
  const lexicalRubrics={
    F02:['A way of receiving information, such as seeing or feeling.','What the senses tell us about the body or surrounding world.','Having value or being useful.'],
    F06:['A place where living things stay or live.','The variety of living things.','Research that brings existing evidence together.'],
    F14:['Reported signs or experiences of depression or anxiety.','A pattern of features being linked.','An intensive care unit for very seriously ill people.'],
    F18:['Egg-producing structures in the female reproductive system.','The features tend to vary in the same direction.','Kinds of fruit flies being compared.'],
  }[record.pair_id]
  // Whole-passage quotes support the draft rubric; experts can refine the item anchors before registration.
  const items=concepts.map((concept,i)=>({id:`L${i+1}`,axis:'lexical',prompt:`In this passage, what does "${concept}" mean? Explain it in Korean or simple English.`,source_quote:record.text,scoring_rubric:lexicalRubrics[i]+' Score the contextual word meaning: 1 correct, 0.5 partly correct, 0 incorrect. Use reasoning items to assess causal and scope limitations.'}))
  const syntaxIndices=[0,Math.floor(sentences.length/2),sentences.length-1]
  for (const [i,n] of syntaxIndices.entries()) items.push({id:`S${i+1}`,axis:'syntax',prompt:`Explain who or what the sentence refers to, and keep its negation, comparison or condition when rewriting it: "${sentences[n]}"`,source_quote:sentences[n],scoring_rubric:`Retain the subject, relation, quantifier and any negation/condition in this sentence: ${sentences[n]} Award 1 for preserved meaning, 0.5 for a partly correct paraphrase, 0 for a changed relation.`})
  const limits={
    F02:['different sensory functions','one sense always being best','which task is being considered'],
    F06:['possible habitat benefits in city gardens','every garden everywhere improving biodiversity','the review scope and the word can'],
    F14:['a stronger group association with reported severe symptoms','illness proving a diagnosis or causing a change in every individual','observational group comparisons and the European setting'],
    F18:['a positive association across eight studied species','ovarioles causing every individual fly to fight','species averages and the difference between association and cause'],
  }[record.pair_id]
  for (const [i,prompt] of [
    `Does the passage establish ${limits[1]}? Explain which evidence or limit controls your answer.`,
    `Which part of the explanation must stay when summarizing ${limits[0]}? Explain why removing it changes the claim.`,
    `Give a conclusion supported by this passage and a stronger conclusion that is not supported. Keep the two separate.`,
  ].entries()) items.push({id:`R${i+1}`,axis:'reasoning',prompt,source_quote:record.text,scoring_rubric:`The answer must preserve ${limits[0]}, avoid claiming ${limits[1]}, and identify ${limits[2]}. Award 1 for both the supported conclusion and relevant limit, 0.5 if only one is correct, 0 for unsupported certainty or changed scope.`})
  const comprehension={
    F02:[['What different information do vision and touch provide?','Vision gives information about surroundings; touch about the body or how an object is held.'],['Does the passage name one sense as always the most important?','No. It describes different roles without a universal winner.'],['What everyday object illustrates the use of the senses?','A packet or packet of sweets on a shop shelf.']],
    F06:[['What possible role besides growing food does a city garden have?','It can provide habitats for living things, such as birds and helpful insects.'],['What region did the original review focus on?','The Global North.'],['Does the passage say every garden everywhere has the same biodiversity benefit?','No. The review does not establish that result for every garden.']],
    F14:[['What groups or experiences were compared in the study?','Groups of survey respondents with different illness severity in a close person, and their reported symptoms.'],['Where did the five study groups come from?','Four European countries.'],['What kind of measures were used for the symptoms?','Survey answers or self-reported symptoms.']],
    F18:[['How many species were compared?','Eight fruit-fly species.'],['What fighting behavior was positively associated with ovariole number?','Headbutting behavior.'],['Does the passage report an association or a demonstrated direct cause?','An association; it says the comparison does not demonstrate a direct cause.']],
  }[record.pair_id]
  for(const [i,[prompt,answer]] of comprehension.entries()) items.push({id:`C${i+1}`,axis:'comprehension',prompt,source_quote:record.text,scoring_rubric:answer+' Score retrieval of the explicitly stated information: 1 correct, 0.5 partly correct, 0 incorrect.'})
  return items
}
