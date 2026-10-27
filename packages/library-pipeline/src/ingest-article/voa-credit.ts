// packages/library-pipeline/src/ingest-article/voa-credit.ts
//
// VOA Learning English 본문 끝의 **작성 크레딧 줄**에서 통신사(제3자) 기반 각색을 읽는다.
//
// 공식 정책(https://www.voanews.com/p/5338.html): VOA 가 단독 제작한 글·음성·영상만 PD 이고, 허가받은 제3자 자료
//   (AP · Reuters · AFP 등)는 그렇지 않다. 그래서 「VOA 컬렉션이니 PD」 기본값을 원문마다 그대로 붙이면
//   통신사 기사를 각색한 글까지 PD 로 표시된다.
//
// 크레딧 = 본문 끝 1,400자 안의 작성 크레딧 문장(아래 CREDIT_SENTENCE). 실측 형태(원문 그대로):
//     "The Associated Press reported this story. Mario Ritter adapted it for VOA Learning English. George Grow was the editor."
//     "Katherine Roth reported this story for the Associated Press. Jonathan Evans adapted her report for VOA Learning English."
//     "The Reuters news service reported this story. Pete Musto adapted it for VOA Learning English."
//     "Bryan Lynn wrote this story for VOA Learning English, based on reports from The Associated Press, Reuters and Agence France-Presse."
//     "John Russell adapted this story based on an AFP report."
//   통신사 이름은 **닫힌 목록**으로만 읽는다. 처음 판(출처 목록을 자유 추출)은 전량 실측(2026-10-27 · VOA 10,663행)에서
//   「reported this story from Washington」의 지명(Washington 134 · Seoul 17 …)을 출처로 셌고, 「The AP reported this story.
//   X adapted it」 형태 약 2,480행을 놓쳤다 — 그래서 크레딧 줄 + 닫힌 통신사 목록으로 바꿨다.
//   닫힌 목록 밖의 매체(BBC · The Telegraph 등)는 이 판정이 잡지 않는다(PD 기본값이 남는다 — 한계로 둔다).
//   본문 속 「Reuters reported …」 · 인터뷰 · 사진 크레딧(「Photo: AFP」)은 크레딧 문장이 아니므로 보지 않는다.
//
// 순수 함수 — 원문을 바꾸지 않는다. 판정은 권리 **표지**일 뿐이고 원문 보존 여부와 무관하다(DD-75).

const TAIL = 1400

/** 닫힌 통신사 목록 — 표기 → 정규 이름 */
const AGENCIES: ReadonlyArray<[RegExp, string]> = [
  [/\bAssociated Press\b|\bAP\b(?!\s+(?:Photo|Images)\b)/, 'Associated Press'],
  [/\bReuters\b/, 'Reuters'],
  [/\bAgence France[- ]Presse\b|\bAFP\b(?!\s+(?:Photo|Images)\b)/, 'Agence France-Presse'],
]

/**
 * 작성 크레딧 **문장** — 작성·보도·각색 동사가 「이 글(this story · the report · their story …)」 또는 「it」을 대상으로 한다.
 * 통신사는 **같은 문장**에 있을 때만 그 글의 출처로 센다. 같은 줄에 함께 있다는 것만으로는 세지 않는다(Codex 반례 2026-10-27):
 *   「Reuters reported that local teachers adapted their teaching method …」 — 기사 내용 보도(대상이 이 글이 아님) → 세지 않음
 *   「Photo: Associated Press. John Russell adapted a VOA Learning English story.」 — AP 는 사진 크레딧 문장 → 세지 않음
 * 문장 단위라 「The Associated Press reported this story.」 와 「X adapted it …」 이 서로 다른 줄이어도 앞 문장으로 잡힌다.
 */
//   전량 실측으로 더한 형태: 「adapted this Associated Press report」(한정사와 명사 사이 낱말 · 최대 3) ·
//   「reported on this for AP News」 · 「Reuters and the Associated Press contributed material」 ·
//   「Additional material came from … the Associated Press」 · 오타 「adpated」.
const CREDIT_SENTENCE = new RegExp(
  [
    String.raw`\b(?:reported|wrote|adapted|adpated|prepared)\b(?:\s+on)?\s+(?:this|the|their|her|his|these|its)(?:\s+[\w’'-]+){0,3}?\s+(?:story|stories|report|reports|article)\b`,
    String.raw`\b(?:adapted|adpated)\s+(?:it|them)\b`,
    String.raw`\breported\s+on\s+this\b`,
    // 「reported this for the Associated Press」 · 「adapted this for VOA Learning English from …」 — this 뒤가 for|from 일 때만
    //   (「Reuters reported this week that …」 같은 본문 문장은 걸리지 않는다)
    String.raw`\b(?:reported|wrote|adapted|adpated)\s+(?:on\s+)?this\s+(?:for|from)\b`,
    String.raw`\b(?:contributed|provided)\s+(?:additional\s+)?(?:material|reporting|information)\b`,
    // 「Additional material/information came from …」 · 「Her story includes information from …」 · 「His story was based on reports …」
    String.raw`\badditional\s+(?:material|reporting|information)\s+(?:came\s+)?from\b`,
    String.raw`\b(?:material|reporting|information)\s+came\s+from\b`,
    String.raw`\b(?:story|report)\s+(?:includes|included|was\s+based\s+on|is\s+based\s+on)\b`,
  ].join('|'),
  'i',
)

/** 문장 나누기 — 마침표 · 줄바꿈. 「Jr.」 · 「Mr.」 · 「U.S.」 뒤에서는 나누지 않는다(「Mario Ritter Jr. adapted …」가 동사와 대상으로 갈렸다). */
const sentencesOf = (text: string) => text.split(/(?<!\b(?:Jr|Sr|Mr|Mrs|Ms|Dr|St|U\.S|U\.N))(?<=[.!?])\s+|\n+/)

/** 작성 크레딧 문장의 통신사(정규 이름). 그런 문장이 없거나 통신사가 없으면 null. */
export function voaThirdPartySources(content: string | null | undefined): string[] | null {
  const tail = (content ?? '').slice(-TAIL)
  const found: string[] = []
  for (const s of sentencesOf(tail)) {
    if (!CREDIT_SENTENCE.test(s)) continue
    for (const [re, name] of AGENCIES) if (re.test(s) && !found.includes(name)) found.push(name)
  }
  return found.length ? found : null
}

/**
 * 통신사 기반 각색이면 원문 단위 권리 표기(PD 가 아님 · 분류기는 'unknown' 으로 읽는다), 아니면 null(컬렉션 기본값 유지).
 * 새 법적 등급을 만들지 않는다 — 「무엇을 읽었는지」만 적고 해소는 아래 단계(발행 적격 · 검수)가 맡는다.
 */
export function voaCreditLicense(content: string | null | undefined): string | null {
  const sources = voaThirdPartySources(content)
  return sources ? `Third-party-based VOA adaptation (credit: ${sources.join(', ')}) — reuse not verified` : null
}
