// apps/web/src/lib/csat/learner-text.ts
//
// 학습자에게 보이는 분석 문장에서 **분석 작업 메모**를 걷어 낸다(2026-10-09 학습 가치 감사).
// 드레인 분석가가 데이터 처리 사정(파싱 잔여 · OCR 잔여 · 저장 지문 2단 병합 · 코퍼스 지문 · raw_block)을
// 설명 속에 적어 둔 문장이 학습자 화면에 그대로 나왔다 — 실측 3,408 분석 중 63건.
// 원본 분석은 고치지 않는다(검수 · 재분석 근거로 남긴다). 화면 경계에서만 거른다.
//
// 거르는 단위: ① 메모가 든 괄호 덩어리 ② 메모가 든 문장(「참고: …」 포함). 나머지 설명은 그대로 둔다.
// 오탐 주의: 「QR 코드를 스캔」 · 「데이터에 기반한」 · 「병합(merge)」 같은 지문 내용은 패턴에 없다.

// 2026-10-11 평가원 802 정독 검수에서 걸러지지 않은 표현을 더했다: 「이 청크에서」 · 인쇄 잔여 · 파일 경로(columns2/…txt) ·
// 원문 창 · 두 단 섞임 · 추출본/추출 부스러기 · 「3차 보강 전 서술」 · 코퍼스(선지 자리 · 회차 원문 등 모든 꼴). 분석 드레인 validate V12 와 같은 범위.
const INTERNAL =
  /파싱 ?(잔여|값)|OCR 잔여|저장(된)? 지문|2단 병합|코퍼스|원문 데이터|raw_block|쪽번호 잡음|이 청크|인쇄 잔여|columns\d*\/|\.txt\b|원문 창|두 단(이)? 섞|추출본|추출 부스러기|\d차 보강|보강 전 서술/

/**
 * 분석 본문의 근거 단위 표기 `[u5]` · `[u3-u5]` 를 학습자 말로 바꾼다(2026-10-11).
 * 분석자는 근거 단위 목록 번호를 `[uN]` 으로 쓰는데(검수 · validate 가 읽는 표기), 화면이 그대로 내보내 학습자가
 * 「[u5]」 를 봤다(최신 분석 3,408 중 2,444). 단위는 96% 가 문장, 안내문은 줄이라 유형으로 이름을 고른다.
 */
export function unitMarkers(s: string, typeId?: string | null): string {
  const noun = typeId === 'R-NOTICE' ? '줄' : '문장'
  // 분석자는 「[u5]와」 처럼 「유오」 로 읽고 조사를 붙였다 — 받침 있는 「문장 · 줄」 에 맞게 고친다(줄 뒤 「로」 는 그대로)
  const fix: Record<string, string> = { 와: '과', 는: '은', 가: '이', 를: '을', ...(noun === '문장' ? { 로: '으로' } : {}) }
  return s.replace(/\[u(\d+)(?:\s*[-–~,·]\s*u?(\d+))?\](와|는|가|를|로)?/g, (_m, a: string, b: string | undefined, p: string | undefined) => {
    const head = b ? `${a}~${b}번 ${noun}` : `${a}번 ${noun}`
    return head + (p ? (fix[p] ?? p) : '')
  })
}

/** 학습자용 분석 문장 — 작업 메모를 걷고 근거 단위 표기를 바꾼다. 남는 것이 없으면 null */
export function learnerText(s: string | null | undefined, typeId?: string | null): string | null {
  const stripped = stripInternalNotes(s)
  return stripped ? unitMarkers(stripped, typeId) : null
}

/** 분석 작업 메모를 걷어 낸 학습자용 문장. 남는 것이 없으면 null */
export function stripInternalNotes(s: string | null | undefined): string | null {
  if (!s) return null
  if (!INTERNAL.test(s)) return s
  // ① 메모가 든 괄호 덩어리
  let out = s.replace(/\s*\([^()]*\)/g, (m) => (INTERNAL.test(m) ? '' : m))
  // ② 메모가 든 문장 — 마침표 뒤 공백에서 나눈다
  out = out
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !INTERNAL.test(sentence))
    .join(' ')
    .trim()
  return out ? out : null
}

/** 메모 패턴이 남았나 — 가드 · 측정용 */
export function hasInternalNote(s: string | null | undefined): boolean {
  return !!s && INTERNAL.test(s)
}

/** 설명 속 영어 인용 조각('…' · ‘…’) — 비교용으로 소문자 · 공백 정규화, 말줄임으로 끊긴 인용은 조각마다 */
function quotesOf(s: string): string[] {
  const out: string[] = []
  for (const m of s.matchAll(/['‘]([^'’]*[A-Za-z][^'’]*)['’]/g)) {
    for (const part of m[1].split(/\.\.\.|…/)) {
      const t = part.toLowerCase().replace(/\s+/g, ' ').replace(/^the\s+/, '').trim()
      if (/[a-z]{3,}/.test(t) && t.length >= 8) out.push(t)
    }
  }
  return out
}

/**
 * 「답이 왜 이것인가」 의 근거 해설(reasoning)이 정답 설명(why_correct)과 같은 근거를 되풀이하나(2026-10-09 감사 표본 5/7 중복).
 * 보수적: reasoning 의 영어 인용이 **모두** why_correct 에 이미 있을 때만 되풀이로 본다 — 새 인용(다른 근거 문장)이 하나라도 있으면 보인다.
 * 인용이 없는 reasoning 은 판단하지 않는다(되풀이 아님).
 */
export function reasoningRepeats(whyCorrect: string | null | undefined, reasoning: string | null | undefined): boolean {
  if (!whyCorrect || !reasoning) return false
  const rq = quotesOf(reasoning)
  if (rq.length === 0) return false
  const w = whyCorrect.toLowerCase().replace(/\s+/g, ' ')
  return rq.every((q) => w.includes(q))
}
