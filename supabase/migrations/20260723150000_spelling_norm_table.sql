-- 철자 정규화 맵 (MorphAdorner NCSA·퍼미시브) — variant(방언/역사철자)→standard.
-- dialect_map(큐레이션 74)의 포괄 승격판. lookup_word_meaning spelling tier가 소비(표준형 사전해소 게이트).
-- 적재: scripts/dict/spelling-norm-load.mjs (MorphAdorner EME 297k + NCF 4k = 301k). 출처 github.com/travisbrown/morphadorner.
create table if not exists spelling_norm (
  variant text primary key,
  standard text not null,
  source text
);
