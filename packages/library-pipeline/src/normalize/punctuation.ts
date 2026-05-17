// packages/library-pipeline/src/normalize/punctuation.ts
// 1차: smart quote / em-dash 통일

export function normalizePunctuation(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, '--')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
}
