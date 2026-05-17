// packages/library-pipeline/src/normalize/reflow.ts
// PDF/스캔본 형태 문제 해결: 줄 끝 hyphen + 다음 줄 결합, 단순 줄바꿈을 공백으로

export function reflowSoftHyphens(s: string): string {
  return s
    .replace(/(\w)-\n(\w)/g, '$1$2') //         hyphen + newline 결합
    .replace(/(\w)\n(\w)/g, '$1 $2') //         단어 줄바꿈을 공백으로
    .replace(/\n{3,}/g, '\n\n') //              빈 줄 3개 이상은 2개로
    .replace(/[ \t]+/g, ' ') //                 다중 공백 정리
    .trim()
}
