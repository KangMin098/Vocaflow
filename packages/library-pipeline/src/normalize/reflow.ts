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
export function reflowSoftHyphens(s: string): string {
  return s
    .replace(/\r\n?/g, '\n') //                 CRLF·CR → LF (이게 없으면 아래가 전부 no-op)
    .replace(/­/g, '') //                  soft hyphen 자체는 표시용이라 제거
    .replace(/(\w)[-‐‑][ \t]*\n[ \t]*(\w)/g, '$1$2') // 줄 끝 hyphen + 다음 줄 결합
    .replace(/(\w)\n(\w)/g, '$1 $2') //         단어 줄바꿈을 공백으로
    .replace(/\n{3,}/g, '\n\n') //              빈 줄 3개 이상은 2개로
    .replace(/[ \t]+/g, ' ') //                 다중 공백 정리
    .trim()
}
