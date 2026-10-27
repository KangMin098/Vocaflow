// packages/library-pipeline/src/ingest-article/voa-credit.ts
//
// VOA Learning English 본문 끝의 **작성 크레딧 줄**에서 통신사(제3자) 기반 각색을 읽는다.
//
// 공식 정책(https://www.voanews.com/p/5338.html): VOA 가 단독 제작한 글·음성·영상만 PD 이고, 허가받은 제3자 자료
//   (AP · Reuters · AFP 등)는 그렇지 않다. 그래서 「VOA 컬렉션이니 PD」 기본값을 원문마다 그대로 붙이면
//   통신사 기사를 각색한 글까지 PD 로 표시된다.
//
// 크레딧 줄 = 본문 끝 1,400자 안에서 작성 동사(adapted · wrote · reported)가 있고, 「adapted」 또는 「Learning English」가
//   같은 줄에 있는 줄. 실측 형태(원문 그대로):
//     "The Associated Press reported this story. Mario Ritter adapted it for VOA Learning English. George Grow was the editor."
//     "Katherine Roth reported this story for the Associated Press. Jonathan Evans adapted her report for VOA Learning English."
//     "The Reuters news service reported this story. Pete Musto adapted it for VOA Learning English."
//     "Bryan Lynn wrote this story for VOA Learning English, based on reports from The Associated Press, Reuters and Agence France-Presse."
//     "John Russell adapted this story based on an AFP report."
//   통신사 이름은 **닫힌 목록**으로만 읽는다. 처음 판(출처 목록을 자유 추출)은 전량 실측(2026-10-27 · VOA 10,663행)에서
//   「reported this story from Washington」의 지명(Washington 134 · Seoul 17 …)을 출처로 셌고, 「The AP reported this story.
//   X adapted it」 형태 약 2,480행을 놓쳤다 — 그래서 크레딧 줄 + 닫힌 통신사 목록으로 바꿨다.
//   닫힌 목록 밖의 매체(BBC · The Telegraph 등)는 이 판정이 잡지 않는다(PD 기본값이 남는다 — 한계로 둔다).
//   본문 속 「Reuters reported …」 · 인터뷰 · 사진 크레딧(「Photo: AFP」)은 크레딧 줄이 아니므로 보지 않는다.
//
// 순수 함수 — 원문을 바꾸지 않는다. 판정은 권리 **표지**일 뿐이고 원문 보존 여부와 무관하다(DD-75).

const TAIL = 1400

/** 닫힌 통신사 목록 — 표기 → 정규 이름 */
const AGENCIES: ReadonlyArray<[RegExp, string]> = [
  [/\bAssociated Press\b|\bAP\b(?!\s+(?:Photo|Images)\b)/, 'Associated Press'],
  [/\bReuters\b/, 'Reuters'],
  [/\bAgence France[- ]Presse\b|\bAFP\b(?!\s+(?:Photo|Images)\b)/, 'Agence France-Presse'],
]

const CREDIT_VERB = /\b(?:adapted|wrote|reported)\b/i
const CREDIT_MARK = /\badapted\b|\bLearning English\b/i

/** 크레딧 줄의 통신사(정규 이름). 크레딧 줄이 없거나 통신사가 없으면 null. */
export function voaThirdPartySources(content: string | null | undefined): string[] | null {
  const tail = (content ?? '').slice(-TAIL)
  const found: string[] = []
  for (const line of tail.split('\n')) {
    if (!CREDIT_VERB.test(line) || !CREDIT_MARK.test(line)) continue
    for (const [re, name] of AGENCIES) if (re.test(line) && !found.includes(name)) found.push(name)
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
