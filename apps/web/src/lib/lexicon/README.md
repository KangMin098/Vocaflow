# lib/lexicon

Lexicon v2.1 — 공용 단어 마스터 (NCIC + KICE 빈도) 도메인 타입 + 조회 헬퍼.

위치: `apps/web/src/lib/lexicon/`

## 파일

```
lib/lexicon/
├── types.ts       — 도메인 타입 + DB row + 변환 헬퍼 + UI 배지
├── queries.ts     — Supabase 조회 (DI: SupabaseClient)
├── index.ts       — barrel export
└── README.md      — (this)
```

## SSoT 정합

DB DDL: [docs/proposals/lexicon-v2.1/schema-v2.1.sql](../../../../../docs/proposals/lexicon-v2.1/schema-v2.1.sql)

4 테이블: `frequency_data_sources` · `word_lexicon` · `lexicon_source_tags` · `word_frequency_stats`.
트리거 자동 계산 필드: `frequency_tier`, `appears_every_year`.

## 도메인 vs DB row

```
WordLexiconRow        → WordLexicon
LexiconSourceTagRow   → LexiconSourceTag   (metadata 평탄화)
WordFrequencyStatsRow → FrequencyStat       (years_appeared 추출)
FrequencyDataSourceRow → FrequencyDataSource

→ LexiconEntry = WordLexicon + sourceTags[] + frequencyStats[]
```

변환은 `rowTo*` 헬퍼로 통일. `lib/srs/state.ts:rowToCard()` 와 같은 패턴.

## 사용 예시

### 단건 조회

```tsx
import { getLexiconEntry, formatFrequencyLine } from '@/lib/lexicon';
import { createServerClient } from '@/lib/supabase/server';

const supabase = await createServerClient();
const entry = await getLexiconEntry(supabase, 'ability', 'n');
// entry.sourceTags, entry.frequencyStats 포함
```

### Tier 필터 (★★★★★ 단어장)

```ts
const top = await filterByTier(supabase, {
  source: 'kice_csat_recent',
  tier: 5,
  everyYearOnly: true,
  limit: 100,
});
```

### 출처별 list (Library /library/vocab)

```ts
const ncic = await listBySource(supabase, {
  source: 'ncic_basic',
  grade: 'high_extended',
  limit: 200,
});
```

### Bulk lookup (Workspace 단어 추출 후 사전 매칭)

```ts
const lookup = await bulkLookup(supabase, ['ability', 'acquire', 'abandon']);
// Map<string, WordLexicon[]> — 다중 pos 처리
```

### 통계 (Hub 헤더)

```ts
const stats = await getLexiconStats(supabase);
// { totalLemmas, byTier: { 5: ..., 4: ... }, bySource: { ncic_basic: ... } }
```

## UI 헬퍼

```ts
TIER_BADGES[5]                                  // { stars: '★★★★★', label: '필수', weight: 'critical' }
FREQUENCY_SOURCE_LABELS['kice_csat_recent']     // '수능 10년'
LEXICON_SOURCE_LABELS['ncic_basic']             // 'NCIC 기본'
NCIC_GRADE_LABELS['high_extended']              // '고교 확장'

formatFrequencyLine(stat)                       // '수능 10년 ★★★★★ 필수 · 47회'
formatYearsAppearedLine(stat)                   // '2014~2024년 매년 출제'

pickPrimaryTier(entry.frequencyStats)           // 학습 출처 우선
```

## 설계 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| DB row vs 도메인 분리 | 둘 다 정의 | `lib/srs` 동일 패턴 / Phase 2 `database.ts` 통합 전 임시 |
| `SupabaseClient` DI | 함수 인자 | server/client 양쪽 호환 |
| `LexiconEntry` nested select | 1 round-trip | RTT 최소화 |
| 변환 헬퍼 위치 | `types.ts` 내부 | SrsCard 와 동일 (state.ts 가 아닌 types.ts 가 함께 보유) |
| Tier 배지 i18n | 한국어 하드코딩 | Vocaflow 한국 학습자 타깃 / i18n 도입 시 별도 layer |
| `primary_sentence_id` | optional `?:` | sentences 마이그레이션 (15번) 적용 전후 모두 동작 |

## 제한 / 향후 개선

- **Phase 2 `database.ts` 통합**: `supabase gen types typescript` 적용 후 row 타입 자동 생성본 사용. 현재는 수동 row 타입.
- **`bulkLookup` 의 pos 미지정**: pos 모르면 모든 pos 반환. lemmatize 시 pos 같이 추출하면 정확도 ↑.
- **`pickPrimaryTier` 단순 선택**: 사용자별 학습 목표(수능/공무원/TOEIC)에 따라 우선순위 customize.
- **`getLexiconStats` 캐시**: 3 round-trip. Next.js `revalidate: 3600` 또는 별도 view/RPC 권장.
- **한국어 의미 검색**: 현재 `lemma` (영어) ilike 만. `meaning_ko` 검색은 별도 함수로 추가 가능.

## 검증 한계

- ✅ TypeScript 컴파일 (strict, `tsc --noEmit`)
- ❌ Supabase nested select 실제 응답 shape (특히 `!inner` 조인) — 환경 검증 필요
- ❌ RLS 정책과 server/client 권한 상호작용
- ❌ `composeEntry` 의 nested 배열 매핑 — Supabase JS SDK v2.x 호환성 확인 필요
