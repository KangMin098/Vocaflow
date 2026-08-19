// packages/library-pipeline/src/normalize/reflow.ts
// PDF/스캔본 형태 문제 해결: 줄 끝 hyphen + 다음 줄 결합, 단순 줄바꿈을 공백으로

/**
 * ⚠️ 개행 정규화가 **맨 앞에** 있어야 한다.
 *
 * 이 함수는 오래도록 `\n` 만 봤는데, Project Gutenberg 평문은 **CRLF** 다.
 * `(\w)-\n(\w)` 는 `-` 와 `\n` 사이의 `\r` 때문에 매치되지 않으므로 **두 치환이 통째로 no-op** 이었다 —
 * 즉 구텐베르크 도서 전권에서 줄끝 하이픈이 재결합되지 않았고 하드랩도 풀리지 않았다.
 * 파이프라인 어디에도(`extractBody` · `normalizePunctuation` · `stripIllustrations`) `\r` 을
 * 걷어내는 곳이 없어 이 함수가 유일한 방어선이다.
 *
 * 파편이 지금 대량으로 보이지 않는 건 고쳐져서가 아니라, `isSyllableHyphenFragment`
 * (analyze/extract-lemmas.ts)가 하이픈에 붙은 토큰을 **양쪽 다 버리기** 때문이다.
 * 결함이 "파편 생성" 에서 "조용한 어휘 유실" 로 바뀌었을 뿐이다.
 *
 * 하이픈 변종도 함께 처리한다 — `normalizePunctuation` 은 em/en dash 만 접고
 * U+2010(hyphen) · U+2011(non-breaking hyphen) · U+00AD(soft hyphen) 은 건드리지 않는다.
 */
export interface ReflowOptions {
  /**
   * 줄 끝 하이픈을 다음 줄과 이어 붙일지. **기본 true — 책(PDF·구텐베르크) 기준이다.**
   *
   * ── 왜 끌 수 있어야 하나 (실측 2026-08-20) ──────────────────────────
   * ACP 기사는 HTML 이라 줄바꿈 하이픈이 생길 이유가 없다. 그런데 **표가 텍스트로
   * 납작해지면** 이 규칙이 없는 낱말을 만든다. VOA 어근 수업의 원문은 이렇다:
   *
   *     Root
   *     Meaning
   *     bio-
   *     life
   *     auto-
   *     self
   *     photo-
   *     light
   *
   * `bio-\nlife` 를 이어 붙여 **`biolife`·`autoself`·`photolight`** 가 만들어지고,
   * 그대로 학습자 어휘 목록에 들어간다.
   *
   * 322편 전수 조사: 줄 끝 하이픈 **11건이 전부 이 기사 하나**에서 나왔고,
   * **진짜 줄바꿈 하이픈은 0건**이었다. 즉 기사 경로에서 이 규칙은 이득이 0이고 해만 있다.
   *
   * 그래서 영리한 판별 규칙을 만드는 대신 **경로별로 나눈다** — 책은 켜고 기사는 끈다.
   * 휴리스틱은 양쪽에서 다 틀릴 수 있지만, 이 구분은 실측된 사실에 기댄다.
   *
   * ⚠️ 나중에 **PDF 에서 뽑는 기사 소스**를 붙이면 이 판단을 다시 재야 한다.
   *   현재 ACP 소스 12곳은 전부 HTML/API 다.
   */
  joinHyphenLineBreaks?: boolean
}

export function reflowSoftHyphens(s: string, options: ReflowOptions = {}): string {
  const join = options.joinHyphenLineBreaks ?? true
  const step1 = s
    .replace(/\r\n?/g, '\n') //                 CRLF·CR → LF (이게 없으면 아래가 전부 no-op)
    .replace(/­/g, '') //                  soft hyphen 자체는 표시용이라 제거
  const step2 = join
    ? step1.replace(/(\w)[-‐‑][ \t]*\n[ \t]*(\w)/g, '$1$2') // 줄 끝 hyphen + 다음 줄 결합
    : step1
  return step2
    .replace(/(\w)\n(\w)/g, '$1 $2') //         단어 줄바꿈을 공백으로
    .replace(/\n{3,}/g, '\n\n') //              빈 줄 3개 이상은 2개로
    .replace(/[ \t]+/g, ' ') //                 다중 공백 정리
    .trim()
}
