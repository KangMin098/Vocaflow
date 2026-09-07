// apps/web/src/lib/csat/__tests__/topic-classifier.test.ts
//
// **소재 분류기를 못 박는다 — 이 자가 틀리면 「어느 칸이 비었는가」가 통째로 틀린다.**
//
// 왜 이 파일이 있는가: 2026-09-07 에 `scripts/csat/lib-topic.mjs` 가 **손판독 144편 기준
// 오분류율 23.6%** 로 측정됐다. 오류가 무작위가 아니라 한 방향으로 쏠려 있었다 — 인문학
// 원문이 과학으로(예술·문화 재현율 50% · 역사·인류 43%). 원인은 전부 코드였다:
// 정규식에 **오른쪽 경계가 없어** `gene` 가 general 을, `art` 가 article·artery 를,
// `star` 가 start 를 먹었고, 한 낱말의 반복이 무한히 득점했고, 동점이 조용히 선언 순서
// 1위(과학·자연)로 갔다. 고친 뒤 **8.3%**.
//
// 이 수치가 왜 코드 밖의 문제인가: `topic-gap.mjs` 의 「부족 0」과 `csat_source_targets`
// 의 수확 우선순위가 전부 이 라벨에서 나온다. 분류기가 되돌아가면 **없는 재고를 「있다」고
// 세고, 비어 있는 칸을 「찼다」고 답한다** — 오류 없이, 조용히. 그래서 회귀로 잠근다.
//
// 워크스페이스 밖 파일이라 앱 번들에는 안 들어간다(테스트에서만 읽는다).

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  TOPICS,
  TOPIC_KEYS,
  TOPIC_V,
  classify,
} from '../../../../../../scripts/csat/lib-topic.mjs'

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..')

// ── ① 고쳐 놓은 함정 — 하나씩 이름을 갖는다 ──────────────────────────
// 「고친 뒤 다시 무너졌다」를 잡으려면 **무엇이 무너졌는지**가 이름에 있어야 한다.

describe('소재 분류기 — 오른쪽 경계 (2026-09-07 회귀)', () => {
  it('`gene` 이 general·generic·generous 를 먹지 않는다', () => {
    const t =
      'The general opinion was generous and generic, and the generation that followed ' +
      'generally agreed with the general in his generosity toward the generations after.'
    expect(classify(t).score['과학·자연']).toBe(0)
  })

  it('`art` 가 article·artery·arthritis·artificial 을 먹지 않는다', () => {
    const t =
      'This article reports arterial stiffness in the artery of patients with arthritis. ' +
      'The articles cited describe arteries and articular cartilage.'
    expect(classify(t).score['예술·문화']).toBe(0)
  })

  it('`star` 가 start 를, `era` 가 eran 을, `plant` 가 planted 만으로 이기지 않는다', () => {
    expect(classify('We started the start and then started again to start over.').score['과학·자연']).toBe(0)
  })

  it('굴절형은 그대로 잡는다 — 경계를 넣느라 재현율을 버리지 않았다', () => {
    expect(classify('stars and galaxies').score['과학·자연']).toBeGreaterThan(0)
    expect(classify('the genes involved').score['과학·자연']).toBeGreaterThan(0)
    expect(classify('the arts and the artists').score['예술·문화']).toBeGreaterThan(0)
  })
})

describe('소재 분류기 — 반복이 폭을 이기지 않는다', () => {
  it('한 낱말 20번 < 서로 다른 낱말 5개', () => {
    const repeated = Array(20).fill('culture').join(' ') // 1 + log2(20) = 5.32점
    const broad = 'the empire and the emperor and the king fought a war in that century of the dynasty' // 6점
    const s = classify(`${repeated} ${broad}`)
    expect(s.topic).toBe('역사·인류')
  })

  it('낱말 하나의 기여는 1 + log2(빈도) 로 눌린다', () => {
    const one = classify('museum').score['예술·문화']
    const four = classify('museum museum museum museum').score['예술·문화']
    expect(one).toBe(1)
    expect(four).toBe(3) // 4가 아니다
  })
})

describe('소재 분류기 — 판정이 아닌 것을 판정이라 하지 않는다', () => {
  it('동점은 분류불가다 — 옛 코드는 선언 순서 1위(과학·자연)로 몰래 깼다', () => {
    const t = 'the ocean and the water met the museum and the opera'
    const c = classify(t)
    expect(c.score['과학·자연']).toBe(c.score['예술·문화'])
    expect(c.topic).toBe('분류불가')
  })

  it('낱말 하나만 걸린 글은 분류불가다', () => {
    expect(classify('He walked home and thought about the ocean.').topic).toBe('분류불가')
  })

  it('분류불가는 소재가 아니다 — 목표 배합에 넣으면 안 되므로 키 목록 맨 끝에 있다', () => {
    expect(TOPIC_KEYS[TOPIC_KEYS.length - 1]).toBe('분류불가')
    expect(Object.keys(TOPICS)).not.toContain('분류불가')
  })
})

describe('소재 분류기 — 같은 철자, 다른 뜻 (MASKS)', () => {
  it('cell culture 는 문화가 아니다', () => {
    expect(classify('We grew the cells in cell culture and cell cultures.').score['예술·문화']).toBe(0)
  })

  it('oxidative stress 는 심리 스트레스가 아니다', () => {
    expect(classify('Oxidative stress and heat stress damaged the leaf.').score['심리·인지']).toBe(0)
  })

  it('tropical depression 은 우울이 아니다', () => {
    expect(classify('A tropical depression formed offshore.').score['심리·인지']).toBe(0)
  })
})

describe('소재 분류기 — 제목', () => {
  it('제목을 넘기면 본문만으로 못 하던 판정을 한다 (도서 발췌가 이 경우다)', () => {
    const body = 'He neither adopted others plans nor formed any of his own, but only drifted about.'
    expect(classify(body).topic).toBe('분류불가')
    expect(classify(body, { title: 'Tacitus: The Histories' }).topic).toBe('역사·인류')
  })

  it('제목이 없어도 죽지 않는다 — 기출 지문에는 제목이 없다', () => {
    expect(() => classify('some text')).not.toThrow()
    expect(classify('x', { title: undefined }).topic).toBe('분류불가')
  })
})

// ── ② 고정 사례 — 손판독한 실제 원문 27편 ────────────────────────────
// 표본 `scripts/csat/data/topic-sample.json` 에서 뽑아 앞 520자만 남겼다. 전부 사람이
// 제목과 본문을 읽고 판정한 것이고, **애매한 것은 넣지 않았다**(넣으면 이 시험이
// 분류기가 아니라 판독자의 자의를 잠근다).

const CASES: { source: string; topic: string; title: string; text: string }[] = [
  {
    source: "gutenberg",
    topic: "역사·인류",
    title: "Tacitus: The Histories, Volumes I and II",
    text: "The besieged suffered more panic than their assailants. The 73 Vitellian soldiers lacked neither resource nor steadiness in moments of crisis. But on the other side the troops were terrified, the general inert, and apparently so paralysed that he was practically deaf and dumb. He neither adopted others' plans nor formed any of his own, but only drifted about from place to place, attracted by the shouts of the enemy, contradicting all his own orders. The result was what always happens in a hopeless disaster: everybo",
  },
  {
    source: "gutenberg",
    topic: "예술·문화",
    title: "Great Musical Composers: German, French, and Italian",
    text: "\"Robert le Diable\" was produced at the Académie Royale in 1831, and inaugurated the brilliant reign of Dr. Véron as manager. The bold innovations, the powerful situations, the daring methods of the composer, astonished and delighted Paris, and the work was performed more than a hundred consecutive times. The history of \"Robert le Diable\" is in some respects curious. It was originally written for the Ventadour Theatre, devoted to comic opera; but the company were found unable to sing the difficult music. Meyerbeer w",
  },
  {
    source: "gutenberg",
    topic: "예술·문화",
    title: "The Ceramic Art",
    text: "The Persians, like the Greeks, mingled the natural with the conventional. Their vases and tiles (Fig. 13) are ornamented with floral designs, in which, while some of the flowers can be distinguished, others are altered beyond recognition. Among the Mussulman Persians the enamels reached the highest point of gorgeous brilliancy: glowing red as a ground-color, dishes with bottoms covered with rich arabesques--everything set in tints of the most pronounced and striking kind. Their decorations are many-hued as the rain",
  },
  {
    source: "gutenberg",
    topic: "철학·윤리",
    title: "The Logic of Hegel",
    text: "Chemism is a category of objectivity which, as a rule, is not particularly emphasised, and is generally put under the head of mechanism. The common name of mechanical relationship is applied to both, in contra-distinction to the teleological. There is a reason for this in the common feature which belongs to mechanism and chemism. In them the notion exists, but only implicit and latent, and they are thus both marked off from teleology where the notion has real independent existence. This is true: and yet chemism and",
  },
  {
    source: "gutenberg",
    topic: "역사·인류",
    title: "The Ancient Stone Implements, Weapons and Ornaments, of Great Britain",
    text: "Fig. 418 represents a very curious form of implement made from a part of a sub-cylindrical nodule of flint, and chipped to a rounded point at one end, and truncated at the other, where the original fractured surface of the flint is left intact. The angles at the pointed end are but little worn. Implements of various other forms and sizes have been found in the gravels near Bedford, but in character they so closely correspond with those found in other parts of England, and in France, that it seems needless to partic",
  },
  {
    source: "gutenberg",
    topic: "예술·문화",
    title: "What Is Art?",
    text: "In these schools art is taught! But art is the transmission to others of a special feeling experienced by the artist. How can this be taught in schools? No school can evoke feeling in a man, and still less can it teach him how to manifest it in the one particular manner natural to him alone. But the essence of art lies in these things. The one thing these schools can teach is how to transmit feelings experienced by other artists in the way those other artists transmitted them. And this is just what the professional",
  },
  {
    source: "elife",
    topic: "과학·자연",
    title: "BRAF inhibitors suppress apoptosis through off-target inhibition of JNK signaling",
    text: "Over 50% of melanomas, a highly lethal form of skin cancer, carry mutations in a gene called BRAF. The BRAF gene encodes an enzyme that helps to regulate the proliferation of cells, but mutations in this gene lead to the excessive proliferation that is seen in cancer. Clinical trials have shown that a drug called vemurafenib can be used to treat patients who carry the mutated BRAF genes and go on to develop melanoma, but around one fifth of these patients developed another type of skin cancer called cSCC (cutaneous",
  },
  {
    source: "plos",
    topic: "과학·자연",
    title: "Functional interplay between (p)ppGpp and RNAP in Acinetobacter baumannii",
    text: "The (p)ppGpp-dependent stress response is required for pathogenic bacteria to survive both outside and inside the host but the mechanisms behind this survival are mostly unknown. In this study, we characterize the (p)ppGpp metabolism in the opportunistic pathogen multi-drug-resistant Acinetobacter baumannii. We show that two stressful conditions potentially encountered during infection – iron starvation and polymyxin exposure – induce (p)ppGpp production. The absence of (p)ppGpp led to multiple consequences on the ",
  },
  {
    source: "plos",
    topic: "과학·자연",
    title: "Differential effects of heat shock protein 90 and serine 1179 phosphorylation on endothelial nitric oxide synthase activity and on its cofactors",
    text: "Introduction Endothelial nitric oxide synthase (eNOS) exists in various organs and tissue endothelium. ENOS converts L-arginine into L-citrulline and produces a high active molecule, nitric oxide (NO) which is a potent cell signaling and vasodilator molecule that plays important and diverse roles in biological processes, including control of vascular tone, vascular remodeling and angiogenesis [ 1 ]. NO generation from eNOS is under sophisticated and tight control. ENOS activity is not only regulated by its cofactor",
  },
  {
    source: "plos",
    topic: "심리·인지",
    title: "The mental health impacts of the COVID-19 pandemic among individuals with depressive, anxiety, and stressor-related disorders: A scoping review",
    text: "Introduction In March 2020, the World Health Organization (WHO) declared COVID-19 to be a global pandemic. Public health measures were introduced worldwide in an effort to control spread of the virus. These measures varied from one nation to another and included closure of international borders, shelter-in-place orders, and closure of non-essential businesses, schools and community gathering places. The profound impact of the pandemic and associated public health measures led to a rise in mental health outcomes inc",
  },
  {
    source: "plos",
    topic: "심리·인지",
    title: "Stress beyond coping? A Rasch analysis of the Perceived Stress Scale (PSS-14) in an Aboriginal population",
    text: "Introduction A history of colonization and genocide contributed to Aboriginal and Torres Strait Islanders becoming one of the most disadvantaged groups in Australia [ 1 ]. The multiple social inequalities, and therefore the constant insecurities for many about low income, poor living conditions, unemployment, and discrimination, generate chronic stress and impact on both physical and mental health [ 2 ]. The risk of being exposed to stressful life events is two to five times greater for Aboriginal Australians [ 3 ]",
  },
  {
    source: "plos",
    topic: "사회·경제",
    title: "Immigrant life expectancy and disability-free life expectancy by detailed country of birth in England and Wales: A total population, repeated cross-sectional approach",
    text: "Research regularly reports lower mortality among migrants, leading to conclusions of a “Healthy Immigrant Effect”. However, evidence on migrant health is less consistent, suggesting a disconnect between mortality and health outcomes. This highlights the need to examine both health and mortality simultaneously rather than relying on single-outcome measures. We estimate life expectancy (LE) and disability-free life expectancy (DFLE) at age 50 for 37 countries of birth in England and Wales. Life tables were constructe",
  },
  {
    source: "owid",
    topic: "사회·경제",
    title: "Which countries have already passed peak population, and when will the rest do so?",
    text: "HomePopulation Growth Which countries have already passed peak population, and when will the rest do so? Falling fertility rates have created a unique scenario in human history: many countries are experiencing structural population decline. By Hannah Ritchie (writing), Edouard Mathieu (data), and Lucas Rodés-Guirao (data) August 17, 2026 Browse past versions Cite this articleReuse our work freely Many countries around the world are in a unique position in human history: rather than having a constant or growing popu",
  },
  {
    source: "the_conversation",
    topic: "사회·경제",
    title: "Why is Mark Carney’s ‘Canada Strong’ brand waning? Because brand politics is perilous",
    text: "In March 2025, a month before Canada’s federal election, Conservative Leader Pierre Poilievre accused Mark Carney of plagiarizing his policy ideas. Sure enough, Carney soon became a Liberal prime minister Conservatives could like, implementing Conservative policies while reportedly undoing Justin Trudeau’s legacy. The Carney government has borrowed another page from the Conservative playbook: the brand politics strategy of Stephen Harper’s government from 2006 to 2015. Domestic brand politics strategies link politi",
  },
  {
    source: "plos",
    topic: "기술·매체",
    title: "TITAN: Combining a bidirectional forwarding graph and GCN to detect saturation attack targeted at SDN — 발췌",
    text: "Some researchers use machine learning-based approaches to detect network attack. Due to its high detection accuracy, a few studies have applied Graph Neural Networks (GNN) to DDoS attack detection in SDNs. The literature also maps SDN smart grid as graphs, but it firstly detects whether the network is anomalous and then identifies the phasor measurement unit that suffer DDoS attacks. Meanwhile, some researchers have applied Graph Attention Networks (GAT) to anomaly detection in sensor networks to identify anomalous",
  },
  {
    source: "owid",
    topic: "기술·매체",
    title: "How much energy do data centers and artificial intelligence use?",
    text: "HomeEnergy How much energy do data centers and artificial intelligence use? Data centers consume around 1.5% of global electricity, but demand is very geographically concentrated. By Hannah Ritchie July 20, 2026 Browse past versions Cite this articleReuse our work freely Few — if any — technologies have been adopted as quickly as artificial intelligence (AI). Since that computation runs on electricity, discussions around AI often return to what this means for energy demand. These concerns tend to take three forms. ",
  },
  {
    source: "voa",
    topic: "교육·언어",
    title: "70 Years after Brown Decision, School Segregation Getting Worse",
    text: "May 17 marked the 70th anniversary of one of the most notable cases in U.S. Supreme Court history – Brown versus Board of Education. The 1954 decision declared segregated schools unconstitutional. It also struck down the principle of “separate but equal,” which was used as the basis for U.S. government policies related to racial segregation. President Dwight Eisenhower famously sent federal troops to southern states to enforce the decision. Today, American schools cannot legally restrict students based on race. But",
  },
  {
    source: "the_conversation",
    topic: "교육·언어",
    title: "Want to learn a South African language? Your options are limited – here’s why",
    text: "It’s 50 years since the Soweto uprising in South Africa. On 16 June 1976, tens of thousands of young black South Africans protested against being taught in the Afrikaans language (alongside English) at school. At the time, under apartheid laws, language, ethnicity and race were all treated as characteristics that defined identity and belonging. Geographic settlement (the artificial system of homelands) added another layer of ethnolinguistic affiliation. In the case of language, the government designated Afrikaans, ",
  },
  {
    source: "original",
    topic: "철학·윤리",
    title: "Whether numbers exist",
    text: "Mathematical statements appear to be true, and their truth appears to be about something, so philosophers have asked what numbers are if they are anything at all. The question is not idle, because our best physical theories are stated mathematically, and if the entities they quantify over do not exist then the status of those theories becomes obscure. Two broad answers have organized the debate for a century. One holds that mathematical objects exist independently of us, in the way that physical objects do but with",
  },
  {
    source: "original",
    topic: "철학·윤리",
    title: "Whether moral disagreement can be resolved",
    text: "People who share the same facts often reach opposite moral conclusions, and philosophy asks whether such disagreement can in principle be settled. This question matters because our confidence in moral judgment depends partly on the answer, since a dispute that no amount of reasoning could close looks unlike a dispute about how the world is. One position holds that most moral disagreement rests on error about matters that are not moral at all. Parties differ about consequences, about who is affected, or about what a",
  },
  {
    source: "plos",
    topic: "철학·윤리",
    title: "Epistemic outsiders: Unpacking and utilising the epistemic dimension of disruptive agency in sustainability transformati — 발췌",
    text: "Also, if p represents a core value the degree of being an epistemic outsider is higher than if it refers to a behavioural rule, for instance. Thirdly, focusing on the concept of epistemic outsiders allows to draw parallels between agents occupying very different positions regarding the reference system. In particular, those who play an active role within the system, engaging in its institutions and practices and reproducing them, and those who are not part of this process but relate to it from the system’s environm",
  },
  {
    source: "wikipedia",
    topic: "역사·인류",
    title: "Battle of Thessalonica (995)",
    text: "The Battle of Thessalonica (Bulgarian: Битката при Солун) was part of the long Bulgarian–Byzantine war and it occurred in 995 or earlier, near the city of Thessalonica, Greece. With Byzantine Emperor Basil II away on campaign in Anatolia, General Samuil of Bulgaria launched raids into the territories around Thessalonica. Lacking siege engines to assault the city, Samuil resorted to traditional Bulgarian ambush tactics. His forces succeeded in ambushing and destroying the city's Byzantine garrison, killing its comma",
  },
  {
    source: "wikipedia",
    topic: "역사·인류",
    title: "Ovonramwen",
    text: "Ovonramwen (born Idugbowa; 1857 – 14 January 1914; rendered Overami in British records) was the thirty-fifth Oba ('king') of the Kingdom of Benin and its final ruler before the kingdom lost its political independence at the end of the nineteenth century. He succeeded his father, Adolo, in either 1888 or 1889 and adopted the regnal name Ovonramwen n'Ogbaisi ('The Rising Sun Which Spreads Over All'). His early reign involved rivalry between established palace chiefs and supporters of his accession, executions and cou",
  },
  {
    source: "original",
    topic: "역사·인류",
    title: "A medieval empire held together by ships",
    text: "The Majapahit empire, centred on eastern Java during the fourteenth and fifteenth centuries, claimed authority over an enormous area of islands and coasts. Reconstructing what that authority actually amounted to has occupied historians for a long time, since a maritime empire leaves a different record from a territorial one. The principal source is a court poem composed in the fourteenth century, which lists the territories acknowledging the ruler and describes a royal progress through the countryside. Its catalogu",
  },
  {
    source: "simple_wikipedia",
    topic: "예술·문화",
    title: "Gothic cathedrals",
    text: "Gothic cathedrals are important examples of Gothic Architecture. Gothic architecture was a way of planning and designing buildings that began in Western Europe in the Late Middle Ages. Gothic architecture started out of Romanesque architecture, in France in the 1100's. The places where the architecture was made increased across Europe. But in the 1500's Renaissance architecture became more used in the Renaissance Period. The Renaissance Period took place from the 1200s to the 1600s. Before that, most cathedrals wer",
  },
  {
    source: "the_conversation",
    topic: "예술·문화",
    title: "Stop! That! Train! is the best kind of silly film",
    text: "Stop! That! Train! is a very silly film – in the best possible way. It’s a disaster-action movie parody in the vein of The Naked Gun (1988), Hot Shots! (1991) and Airplane! (1980). In fact, Stop! That! Train!’s relationship to the latter is a little bit like a drag queen lip synching to their favourite diva’s famous belter: there’s space for interpretation, but the lyrics and the voice are pretty much set in stone. Consequently, quite a few gags, not to mention the main narrative thrust of the plucky underdogs savi",
  },
  {
    source: "original",
    topic: "예술·문화",
    title: "The written stroke as an art of its own",
    text: "In several traditions the written character is treated as a major art rather than as a vehicle for language. This judgment can puzzle observers whose culture regards handwriting as merely functional, yet the aesthetic reasoning behind it is coherent and worth understanding. The stroke records a movement. Because the brush responds to pressure, speed, and angle, the finished mark preserves the gesture that produced it, and a trained viewer can read that gesture as clearly as a listener hears phrasing in music. Conse",
  },
]

describe('소재 분류기 — 손판독 고정 사례 27편', () => {
  it.each(CASES.map((c) => [c.topic, c.title.slice(0, 46), c] as const))(
    '%s ← %s',
    (topic, _t, c) => {
      expect(classify(c.text, { title: c.title }).topic).toBe(topic)
    },
  )

  it('여덟 칸이 모두 걸려 있다 — 한 칸만 잘 맞는 자로는 격차를 못 잰다', () => {
    const covered = new Set(CASES.map((c) => c.topic))
    for (const k of Object.keys(TOPICS)) expect(covered.has(k)).toBe(true)
  })
})

// ── ③ 표본 전량 — 오분류율 자체를 잠근다 ─────────────────────────────
// 고정 사례만으로는 "그 27편만 통과하는 표" 로도 초록불이 난다. 손판독 144편 전량에
// 걸어 **비율**을 못 박는다. (파일이 없으면 건너뛴다 — 다시 뽑으려면
// `node scripts/csat/topic-accuracy.mjs --sample`.)

const SAMPLE = path.join(REPO, 'scripts/csat/data/topic-sample.json')
const LABELS = path.join(REPO, 'scripts/csat/data/topic-sample.labels.json')
const haveSample = fs.existsSync(SAMPLE) && fs.existsSync(LABELS)

describe.skipIf(!haveSample)('소재 분류기 — 손판독 표본 144편 전량', () => {
  type Row = { id: string; source: string; title: string; text: string }
  const rows: Row[] = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'))
  const truth: Record<string, string | string[]> = JSON.parse(fs.readFileSync(LABELS, 'utf8'))
  const judged = rows.filter((r) => truth[r.id])
  const acc = (id: string) => {
    const v = truth[id]
    return Array.isArray(v) ? v : [v]
  }
  const got = new Map(judged.map((r) => [r.id, classify(r.text, { title: r.title }).topic as string]))

  it('표본이 실제로 소스를 가로지른다 — 한 소스만 재면 쏠림을 못 본다', () => {
    expect(judged.length).toBeGreaterThanOrEqual(120)
    expect(new Set(judged.map((r) => r.source)).size).toBeGreaterThanOrEqual(10)
  })

  it('오분류율 ≤ 12% (2026-09-07 수정 후 실측 8.3% · 수정 전 23.6%)', () => {
    const wrong = judged.filter((r) => !acc(r.id).includes(got.get(r.id)!)).length
    expect((100 * wrong) / judged.length).toBeLessThanOrEqual(12)
  })

  it('인문 칸이 과학으로 새지 않는다 — 이것이 원래의 고장이었다', () => {
    const leaked = judged.filter(
      (r) => ['예술·문화', '역사·인류', '철학·윤리'].includes(acc(r.id)[0]) && got.get(r.id) === '과학·자연',
    )
    // 수정 전 13편. 인문 원문이 과학 칸으로 세면 그 칸이 「찼다」고 보이고 수확이 멈춘다.
    expect(leaked.length).toBeLessThanOrEqual(2)
  })

  it('예술·문화 정밀도 ≥ 85% — PMC 정찰이 본 고장이 이 칸이었다 (수정 전 80%)', () => {
    const pred = judged.filter((r) => got.get(r.id) === '예술·문화')
    const tp = pred.filter((r) => acc(r.id).includes('예술·문화')).length
    expect(pred.length).toBeGreaterThan(0)
    expect((100 * tp) / pred.length).toBeGreaterThanOrEqual(85)
  })

  it('분류불가가 표본의 10% 를 넘지 않는다 — 하한이 너무 높으면 재고가 사라진다', () => {
    const un = judged.filter((r) => got.get(r.id) === '분류불가').length
    expect((100 * un) / judged.length).toBeLessThanOrEqual(10)
  })
})

// ── ④ 표를 고치면 판 번호도 올라가야 한다 ────────────────────────────
// DB 의 `csat_fit.topicV` 가 이 번호다. 표를 고치고 번호를 안 올리면 `topic-gap.mjs` 가
// **옛 자로 잰 라벨**을 전수라 부르며 세고, 리포트는 고치기 전 분류로 계속 답한다.
// 그 침묵을 여기서 깬다 — 표가 바뀌면 이 시험이 먼저 빨개진다.

describe('소재 분류기 — 분류판 번호', () => {
  it('TOPICS 를 고쳤으면 TOPIC_V 와 아래 해시를 함께 올린다', () => {
    const hash = createHash('sha256').update(JSON.stringify(TOPICS)).digest('hex').slice(0, 16)
    expect({ hash, TOPIC_V }).toEqual({ hash: '002f220545390782', TOPIC_V: 2 })
  })
})
