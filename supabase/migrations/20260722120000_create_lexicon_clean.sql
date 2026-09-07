-- 청정 lexicon (kaikki CC BY-SA 대체) — 설계: docs/proposals/lexicon-coverage-clean-architecture.md
-- gloss_en=WordNet/Webster(퍼미시브/PD) · meaning_ko=LLM 사전작업/Tier1 재사용 · ipa=CMUdict(PD)
-- 런타임 DB 조회 전용(LLM 오프라인). coverage_lexicon(kaikki) 대체본 — 검증 후 기존 폐기 예정.
create table if not exists lexicon_clean (
  word           text primary key,
  pos            text,
  gloss_en       text,          -- WordNet/Webster 정제 정의
  meaning_ko     text,          -- LLM 사전생성 / Tier1 검증 재사용
  ipa            text,          -- CMUdict
  gloss_source   text,          -- wordnet | webster | llm-original
  ko_source      text,          -- verified-wordnet | verified-webster | retranslate-clean | llm-original
  frequency_rank integer,
  is_valid_word  boolean not null default true,
  updated_at     timestamptz not null default now()
);
comment on table lexicon_clean is 'kaikki(CC BY-SA) 대체 청정 독해 lexicon. gloss=WordNet/Webster·ko=LLM/Tier1재사용·ipa=CMUdict. 런타임 DB조회 전용(LLM 오프라인).';
create index if not exists idx_lexicon_clean_word_pat on lexicon_clean (word text_pattern_ops);
