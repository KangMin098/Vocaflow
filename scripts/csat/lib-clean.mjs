// scripts/csat/lib-clean.mjs
//
// **옛 책 본문에서 활자 잡동사니를 걷어 낸다.**
//
// Gutenberg 실측(§44)에서 적합 판정을 받은 조각을 눈으로 보고 나서야 보인 것들이다.
// 수치만으로는 안 보였다 — 아래 셋은 모두 대역을 통과했다:
//
//   · 각주 번호가 문장 안에 남는다   "None, however, but the priests [52] are permitted"
//   · 절 번호가 문단 앞에 붙는다     "7. In the election of kings they have regard to birth"
//   · 표제지가 통째로 한 조각이 된다 "THE THEORY OF MORAL SENTIMENTS; OR, AN ESSAY …"
//
// 앞의 둘은 **고칠 수 있는 것**이므로 지운다. 마지막은 고칠 수 없으므로
// `looksLikeBookMatter()` 가 그 조각을 통째로 배제한다.
//
// ⚠️ **정제와 배제를 섞지 않는다.** 지울 수 있는 것을 배제하면 쓸 수 있는 지문을 버리고,
//   배제해야 할 것을 지우면 표제지가 어설픈 산문으로 둔갑해 통과한다. 두 함수로 나눈 이유다.

/**
 * 지문으로 쓸 본문에서 활자 표시를 걷어 낸다. **뜻은 건드리지 않는다.**
 *
 * ⚠️ **개행을 먹으면 안 된다.** 첫 판에서 절 번호를 `(^|\n)\s*\d{1,3}\.\s+` 로 지웠더니
 *   `\s*` 가 빈 줄을 함께 삼켰다. 호출부는 빈 줄로 문단을 나누므로 문단 경계가
 *   사라졌고, 타키투스 한 권에서 조각이 **73 → 5**, 적합이 **39 → 0** 이 됐다.
 *   본문 길이는 2%밖에 안 줄었는데 산출이 전멸했으므로, 길이만 봐서는 못 잡는 사고다.
 *   그래서 줄 안쪽 공백은 `[ \t]` 로만 다룬다.
 *
 * ⚠️ 각주 번호를 지울 때 **연도·인용 대괄호와 구별해야 한다.** `[52]` 는 각주지만
 *   `[1922]` 는 연도일 수 있다. 그래서 1~3자리만 지운다.
 */
export function cleanBookText(raw) {
  let t = String(raw)

  // 각주 표시 — 대괄호 안 1~3자리 숫자. 앞의 공백까지 함께 지워 이중 공백을 안 남긴다.
  t = t.replace(/[ \t]*\[\d{1,3}\]/g, '')
  // 각주 표시의 다른 형태 — 위첨자 자리에 쓰인 홑괄호 숫자.
  t = t.replace(/[ \t]*\(\d{1,3}\)(?=[\s.,;:])/g, '')

  // 강조 밑줄 — Gutenberg 평문판은 이탤릭을 `_말_` 로 적는다.
  t = t.replace(/_([^_\n]{1,80})_/g, '$1')

  // 문단 앞 절 번호 — "7. In the election…" / "12. On affairs…"
  // 줄 안쪽 공백만 다룬다(위 경고 참조). 문장 중간의 목록 번호는 건드리지 않는다.
  t = t.replace(/(^|\n)[ \t]*\d{1,3}\.[ \t]+(?=[A-Z])/g, '$1')

  // 장 머리가 문단 앞에 붙은 경우 — "CHAP. III. Of the manner…"
  t = t.replace(/(^|\n)[ \t]*(?:CHAP(?:TER)?\.?|BOOK|PART|SECT(?:ION)?\.?)[ \t]+[IVXLCDM\d]+\.?[ \t]*/gi, '$1')

  // 줄 끝 하이픈 분철 — 옛 조판이 남긴다. 붙여 준다.
  t = t.replace(/(\w)-\n(\w)/g, '$1$2')

  return t.replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n')
}

/**
 * 이 조각이 **본문이 아니라 책의 부속물**인가 — 표제지 · 목차 · 색인 · 판권.
 *
 * ⚠️ **현대 학술 산문을 잡으면 안 된다.** 첫 판은 기존 적합 원문 600편 중 **57%** 를
 *   걸렀다. 범인은 둘이었고 둘 다 "옛 책에만 있을 것" 이라는 짐작이 틀린 경우였다:
 *
 *     · `,\s*\d{1,4}` 를 색인 행으로 본 규칙 → **53.8% 오탐.**
 *       학술 글의 `290,000–650,000` 이나 인용 번호가 그대로 걸린다.
 *     · `/\bINDEX\b/i` → **24.2% 오탐.** `body mass index` · `index case` 를 잡는다.
 *       대소문자 무시가 원인이므로 **표제 대문자만** 본다.
 *
 *   남긴 규칙 셋(전대문자 · 마침표 희소 · 로마 숫자 반복)은 같은 표본에서
 *   각각 0% · 0% · 0.3% 였다. 전대문자 비율은 현대 산문의 99분위가 3.51% 이므로
 *   6% 문턱은 여유가 있다.
 */
export function looksLikeBookMatter(text) {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (!words.length) return true

  // ① 전대문자 낱말이 많다 — 표제지의 서명이다. ("THE THEORY OF MORAL SENTIMENTS")
  //    3자 이하는 약어일 수 있으므로 4자 이상만 센다. 현대 산문 99분위 3.51% 대비 여유.
  const shouty = words.filter((w) => /^[A-Z]{4,}$/.test(w.replace(/[^A-Za-z]/g, ''))).length
  if (shouty / words.length > 0.06) return true

  // ② 마침표가 거의 없다 — 목차·색인·표는 문장이 아니라 항목이다.
  const sentEnd = (text.match(/[.!?]/g) ?? []).length
  if (sentEnd / words.length < 0.012) return true

  // ③ 부속물에만 나오는 문구. **대문자 표제만** 본다 — 소문자 index 는 본문 낱말이다.
  if (/\bTABLE OF CONTENTS\b|\bLIST OF ILLUSTRATIONS\b/.test(text)) return true
  if (/\bTRANSCRIBER'?S NOTE\b/i.test(text)) return true
  if (/\bEntered according to Act of Congress\b/i.test(text)) return true

  // ④ 로마 숫자 장 표시가 여러 번 — 목차다.
  if ((text.match(/\b(?:CHAP(?:TER)?|BOOK|PART)\.?\s+[IVXLCDM]+\b/g) ?? []).length >= 3) return true

  return false
}
