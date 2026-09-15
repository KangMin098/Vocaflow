// packages/library-pipeline/src/normalize/punctuation.ts
// 1차: smart quote / em-dash 통일 + 합자(ligature) 분해

/**
 * 합자 분해 — 고전 원문에 남은 활자 합자를 구성 문자로 편다.
 *
 * 왜 필요한가 (v06.35 실측):
 *   winkNLP 영어 모델의 토크나이저 문자 클래스는 Latin-1 Supplement (U+00C0–U+00FF) 까지만
 *   커버한다. Latin Extended-A 인 `œ`(U+0153) 는 **단어 문자로 인식되지 않아** 토큰을 쪼갠다:
 *       œconomical → "œ"(unk) + "conomical"(word)
 *   그 결과 `conomical` · `cumenical` · `otian`(Bœotian) · `nician`(Phœnician) 같은
 *   본문에 존재하지 않는 유령 어휘가 학습 단어로 저장됐다 (76권 감사에서 6건).
 *   `æ`(U+00E6) 는 범위 안이라 토큰은 살아남지만 extract-lemmas 의
 *   `/^[a-z'-]+$/` 필터에서 통째로 버려져 `mediæval` 이 학습 기회를 잃었다.
 *
 * 왜 여기(정규화 단계)인가:
 *   토크나이저 입력만 접으면 content_chunks 본문과 charStart/charEnd offset 이 어긋난다
 *   (`œ`→`oe` 는 1→2자). 정규화 단계에서 접으면 본문·근거문장·offset 이 모두 같은
 *   문자열을 근거로 삼아 일관된다. 이 파이프라인은 이미 em-dash 를 `--` 로 바꾸는
 *   "학습용 정규화 텍스트" 정책이므로 방침이 어긋나지 않는다.
 *
 * 왜 이것만으로 충분한가:
 *   접고 나면 사전 해소 체인이 알아서 근대 철자로 잇는다 — 실측:
 *       oeconomical → economical (spelling 티어) · mediaeval → mediaeval (direct)
 *   즉 여기서 근대 철자까지 밀어붙일 필요가 없다. 원문 철자를 보존한 채 넘긴다.
 *
 * 대문자 처리: `Œ`→`Oe` (Æ→Ae). 전부 대문자 문맥(ŒCONOMY)에서는 `OeCONOMY` 가 되지만
 *   추출은 소문자로 정규화하므로 학습 단어에는 영향이 없고, 본문 가독성 손실도 없다.
 */
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/œ/g, 'oe'],
  [/Œ/g, 'Oe'],
  [/æ/g, 'ae'],
  [/Æ/g, 'Ae'],
  // 인쇄 합자 (Alphabetic Presentation Forms) — 스캔 원문에 드물게 남는다
  [/ﬁ/g, 'fi'],
  [/ﬂ/g, 'fl'],
  [/ﬀ/g, 'ff'],
  [/ﬃ/g, 'ffi'],
  [/ﬄ/g, 'ffl'],
  [/ﬅ/g, 'ft'],
  [/ﬆ/g, 'st'],
]

export function normalizeLigatures(s: string): string {
  let out = s
  for (const [re, to] of LIGATURES) out = out.replace(re, to)
  return out
}

export function normalizePunctuation(s: string): string {
  return normalizeLigatures(s)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, '--')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
}
