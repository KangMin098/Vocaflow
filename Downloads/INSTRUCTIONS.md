# Vocaflow SRS 엔진 — VS Code Claude Code 작업 지시문 v2

> 이 문서를 VS Code Claude Code에 붙여 넣고, 함께 받은 **`vocaflow-handoff.zip`** 도 첨부하세요.
> v1의 3가지 잘못된 전제(packages 모노레포 / zip 미첨부 / CLAUDE.md §17 부재)를 모두 해결했습니다.

---

## 0. 당신의 역할

당신은 Vocaflow의 **CLAUDE.md v06.8**(이번 작업 후 교체될 합본본)을 단일 진실 소스로 따르는 수석 엔지니어입니다.

- 응답 언어: **한국어** / 코드 주석: **영문**
- 출력 형식: **결론 먼저, 근거는 그 다음**
- 절대 금지: TODO·placeholder·"나중에 구현" — 항상 완성형 코드만
- 색상 하드코딩 금지 (게임 전용 예외만, 반드시 주석 표시)
- 매 단계 끝나면 사용자 승인을 받은 후에만 다음 단계로 진행

---

## 1. 워크스페이스 실제 구조 (확정 사실)

```
C:\Users\kille\Vocaflow\
  ├── CLAUDE.md                            ← 현재 v06.7 — 단계 0에서 v06.8로 교체
  ├── apps/
  │   └── web/
  │       ├── src/lib/srs/sm2.ts           ← 기존 SM-2 구현 (그대로 유지, 손대지 X)
  │       └── supabase/migrations/         ← Supabase migration 디렉토리 (없으면 생성)
  └── packages/                            ← 존재하지 않음 (CLAUDE.md 정의만 있음)
```

**중요**: 본 작업은 단일 앱 구조(`apps/web/`)에서 수행합니다. `packages/ui-shared`는 만들지 않습니다.

기존 `apps/web/src/lib/srs/sm2.ts`는 호환성 유지 차원에서 **그대로 두고**, 새 FSRS 구현을 같은 디렉토리에 형제 파일로 추가합니다.

---

## 2. 첨부 zip의 내용

```
vocaflow-handoff.zip
  ├── CLAUDE.md                            ← v06.8 합본본 (2,915줄, §17 학습 모델 포함)
  └── apps/web/src/lib/srs/
      ├── types.ts                         ← 도메인 타입
      ├── state.ts                         ← R(t) → 4색 동적 매핑
      ├── fsrs.ts                          ← ts-fsrs wrapper (타입 에러 수정 완료)
      ├── index.ts                         ← barrel export
      ├── supabase-adapter.ts              ← DB row ↔ SrsCard
      └── __tests__/srs.test.ts            ← 31 tests, 격리 환경에서 PASS 검증됨
```

**검증 완료 사실**: 타입 에러는 zip 안 파일에 이미 수정 반영되어 있습니다. 격리 환경에서 `tsc --noEmit` 0 errors + `vitest run` 31 tests passed 확인.

---

## 3. CLAUDE.md §17 핵심 사양 (Claude Code가 코드 작성 시 참조)

### 3-1. 학습 모델 7축

1. **흐름**: L0 Discover → L1 Acquire → L2 Comprehend → L2.5 Bridge(Dictation) → L3 Encode → L4 Retrieve → L5 Reflect
2. **상태**:
   - 단어: FSRS 3변수(D/S/R) → 4색(stable/shaky/risk/new) **동적 매핑** (DB 저장 X)
   - 사용자: Cold(7일 이내 or <50단어) / Warm(50~500 or Streak 7~30일) / Hot(500+ or Streak 30+)
3. **추천**: 자율 70% — 제안은 정확히 3곳(Hub Today CTA / FloatingSparkle / 세션 종료 후)
4. **기억**: ts-fsrs ^5.2.3, 한국 학습자 초기값 `{ target: 0.85, D: 6.0, max_interval: 365, learning_steps: ['1d', '3d'] }`
5. **동기**: SDT(자율성·유능감·관계성) × 사용자 단계
6. **인지**: 단어 Stability 기반 큐 자동 분기 — `S<1d → BLOCKED`, `1≤S<7d → HYBRID`, `S≥7d → INTERLEAVED`
7. **데이터**: vocabularies 6컬럼 + texts 3컬럼 + learning_records.rating + user_stats(신규)

### 3-2. 4색 매핑 규칙 (R(t) = 0.9^(t/S) 동적 계산)

| 조건 | state | CSS Variable | 색상 |
|------|-------|--------------|------|
| D/S 미부여 (lastReviewAt 없음 또는 stability=0) | new | `var(--memory-new)` | #94A3B8 |
| R ≥ 0.95 | stable | `var(--memory-stable)` | #22C55E |
| 0.70 ≤ R < 0.95 | shaky | `var(--memory-shaky)` | #F59E0B |
| R < 0.70 | risk | `var(--memory-risk)` | #EF4444 |

### 3-3. 안티패턴 5개 (절대 금지)

1. 추천을 4곳 이상 노출 (SDT 자율성 위반)
2. FSRS 변수(D/S/R)를 사용자에게 직접 노출
3. Cold 사용자에게 Interleaved 강제
4. `state` 컬럼을 DB에 저장 후 직접 사용 (반드시 R(t) 동적 계산)
5. 추천 라벨에 정확도/실패 카운트 노출

> 더 깊이 알아야 한다면, 단계 0 완료 후 워크스페이스의 `CLAUDE.md` §17 (라인 149~561)을 직접 읽으세요.

---

## 4. 작업 — 단계별

> **단계 0 → 1 → 2 → 3 → 4 순서 엄수**. 각 단계 끝에 사용자 승인 받기.

---

### 단계 0 — zip 풀고 파일 배치

#### 0-A. 첨부 zip 위치 확인

사용자가 첨부한 `vocaflow-handoff.zip`이 어디에 있는지 확인하세요. 보통:
- VS Code 워크스페이스 루트 또는 `~/Downloads/`
- 모르겠으면 사용자에게 위치 확인 요청

#### 0-B. zip 내용을 워크스페이스에 풀기

워크스페이스 루트(`C:\Users\kille\Vocaflow\`)를 기준으로 zip 안의 디렉토리 구조를 그대로 펴기:

```bash
# Git Bash 기준
cd /c/Users/kille/Vocaflow
unzip -o /path/to/vocaflow-handoff.zip
```

#### 0-C. 결과 확인

다음 파일들이 모두 존재해야 함:

```
C:\Users\kille\Vocaflow\CLAUDE.md                         ← v06.8로 덮어쓰기됨
C:\Users\kille\Vocaflow\apps\web\src\lib\srs\types.ts
C:\Users\kille\Vocaflow\apps\web\src\lib\srs\state.ts
C:\Users\kille\Vocaflow\apps\web\src\lib\srs\fsrs.ts
C:\Users\kille\Vocaflow\apps\web\src\lib\srs\index.ts
C:\Users\kille\Vocaflow\apps\web\src\lib\srs\supabase-adapter.ts
C:\Users\kille\Vocaflow\apps\web\src\lib\srs\__tests__\srs.test.ts
```

기존 `apps\web\src\lib\srs\sm2.ts`는 그대로 보존되어야 함 (zip이 덮어쓰지 않음).

#### 0-D. CLAUDE.md 버전 확인

```bash
head -10 CLAUDE.md | grep "문서 버전"
```

기대 출력: `> **문서 버전: v06.8** ...`

`v06.7`로 나오면 zip 풀기가 실패한 것 — 사용자에게 보고.

#### 0-E. 의존성 설치

```bash
cd apps/web
pnpm add ts-fsrs@^5.2.3
pnpm add -D vitest@^1.6.0   # 이미 있으면 건너뜀
```

(npm/yarn 사용 중이면 동일 의존성을 추가)

#### 0-F. 검증

```bash
cd apps/web
npx tsc --noEmit
npx vitest run src/lib/srs
```

**기대 결과**:
- TSC: 0 errors (타입 에러는 zip 안 파일에 이미 수정 반영됨)
- Vitest: **31 tests passed**

테스트가 깨지면 — zip 풀기가 잘못됐거나 기존 다른 파일과 충돌. 사용자에게 보고하고 멈춤.

#### 0-G. 단계 0 보고

사용자에게 다음 형식으로 보고 후 승인 대기:

```markdown
### 단계 0 완료
- CLAUDE.md v06.8로 교체 ✓
- SRS 파일 6개 배치 ✓ (apps/web/src/lib/srs/)
- 의존성 ts-fsrs ^5.2.3 설치 ✓
- TSC 0 errors ✓
- Vitest 31 tests passed ✓

기존 sm2.ts는 그대로 유지됐습니다. 단계 1(Migration SQL) 진행할까요?
```

---

### 단계 1 — Supabase Migration SQL

기존 v06.7 정합 — 워크스페이스에 `apps/web/supabase/migrations/` 디렉토리가 이미 있을 것. 없으면 생성.

#### 1-A. 마이그레이션 파일 생성

기존 마이그레이션 파일명 컨벤션을 먼저 확인:

```bash
ls apps/web/supabase/migrations/
```

기존 파일이 `20240315120000_xxx.sql` 형태라면 동일 형식으로 신규 파일 생성. 컨벤션이 다르면 그것을 따를 것.

추천 파일명: `<타임스탬프>_srs_engine_v2.sql`

#### 1-B. SQL 내용

```sql
-- ============================================================================
-- Vocaflow SRS Engine v2.0 Migration
-- ref: CLAUDE.md §17.7 [7] 데이터 축
-- ============================================================================
-- 변경:
--   - vocabularies: FSRS 호환 컬럼 6개 (difficulty/stability/last_review_at/
--                   next_review_at/module_history/review_count)
--   - texts:        CEFR + 진행률 컬럼 3개
--   - learning_records: rating 컬럼 (FSRS 4단계)
--   - user_stats:   신규 테이블 (사용자 단계 캐시)
-- ============================================================================

-- ──────────────────────────────────────────────────────
-- 1. vocabularies — FSRS 호환 컬럼 6개
-- ──────────────────────────────────────────────────────
ALTER TABLE vocabularies
  ADD COLUMN IF NOT EXISTS difficulty FLOAT NOT NULL DEFAULT 6.0,
  ADD COLUMN IF NOT EXISTS stability FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS module_history TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN vocabularies.difficulty IS
  'FSRS Difficulty (1.0~10.0). Korean learner default 6.0.';
COMMENT ON COLUMN vocabularies.stability IS
  'FSRS Stability in days. Time for retrievability to decay 100%->90%.';
COMMENT ON COLUMN vocabularies.module_history IS
  'Modules this word has been seen in (e.g. flashcard, dictation, spellforge).';

-- 추천 엔진 P1 (R<0.6 단어 surface) 가속용 인덱스
CREATE INDEX IF NOT EXISTS vocabularies_user_next_review_idx
  ON vocabularies (user_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ──────────────────────────────────────────────────────
-- 2. texts — CEFR + 진행률 컬럼 3개
-- ──────────────────────────────────────────────────────
ALTER TABLE texts
  ADD COLUMN IF NOT EXISTS cefr_level TEXT
    CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  ADD COLUMN IF NOT EXISTS last_opened TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_percent FLOAT NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100);

-- ContinueCard ('이어 듣기') 가속용 인덱스
CREATE INDEX IF NOT EXISTS texts_user_last_opened_idx
  ON texts (user_id, last_opened DESC NULLS LAST);

-- ──────────────────────────────────────────────────────
-- 3. learning_records — FSRS rating 컬럼
-- ──────────────────────────────────────────────────────
ALTER TABLE learning_records
  ADD COLUMN IF NOT EXISTS rating SMALLINT
    CHECK (rating IS NULL OR rating BETWEEN 1 AND 4);

COMMENT ON COLUMN learning_records.rating IS
  'FSRS 4-grade scale: 1=Again, 2=Hard, 3=Good, 4=Easy. NULL for v06.7- records.';

-- module이 enum이라면 'dictation' 추가 (v06.7에서 추가됐을 수 있음)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'learning_module'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'dictation'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'learning_module')
  ) THEN
    ALTER TYPE learning_module ADD VALUE 'dictation';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- 4. user_stats — 신규 테이블
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mastery_level TEXT NOT NULL DEFAULT 'cold'
    CHECK (mastery_level IN ('cold', 'warm', 'hot')),
  total_words INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  fsrs_target_retention FLOAT NOT NULL DEFAULT 0.85
    CHECK (fsrs_target_retention > 0 AND fsrs_target_retention <= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_stats IS
  'Per-user mastery cache. Hub queries this once on entry to branch UX.';

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_stats_owner_all" ON user_stats;
CREATE POLICY "user_stats_owner_all"
  ON user_stats
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 신규 가입 시 user_stats 1건 자동 생성
CREATE OR REPLACE FUNCTION create_user_stats_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_user_stats_after_signup ON auth.users;
CREATE TRIGGER create_user_stats_after_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_stats_on_signup();
```

#### 1-C. 적용

```bash
cd apps/web
pnpm supabase migration up    # 또는 supabase db reset (개발 DB)
```

Supabase CLI가 없으면 Studio에서 SQL Editor에 직접 붙여 넣어 실행하도록 사용자에게 안내.

#### 1-D. 검증

```sql
-- vocabularies에 6개 컬럼 확인
SELECT column_name FROM information_schema.columns
WHERE table_name = 'vocabularies'
  AND column_name IN ('difficulty', 'stability', 'last_review_at',
                      'next_review_at', 'module_history', 'review_count');
-- 6 rows 기대

-- user_stats 테이블 존재 확인
SELECT count(*) FROM information_schema.tables WHERE table_name = 'user_stats';
-- 1 기대
```

---

### 단계 2 — 추천 엔진 (`next-action.ts`)

`apps/web/src/lib/recommend/next-action.ts` 신규 생성. CLAUDE.md §17.9 의사코드 그대로 구현.

#### 2-A. 사양

```typescript
// apps/web/src/lib/recommend/next-action.ts
//
// Vocaflow 추천 엔진 — CLAUDE.md §17.3 [3] 추천 축 + §17.9 의사코드
// 호출 위치 정확히 3곳 (§17 안티패턴 1: 4곳 이상 노출 금지):
//   1. Hub Today CTA       — getNextBestAction(userId)
//   2. FloatingSparkle     — getNextBestAction(userId, { context: 'workspace', textId })
//   3. 세션 종료 직후       — getNextBestAction(userId, { context: 'after-session', justFinished: 'flashcard' })
```

#### 2-B. 타입

```typescript
import type { ModuleId } from '@/lib/srs';

export interface RecommendedAction {
  module: ModuleId | 'library';
  /** 격려형 라벨 — UI에 그대로 노출. 정확도/실패 카운트 금지(§17 안티패턴 5). */
  label: string;
  /** 큐 빌더에 전달할 단어 ID 배열 */
  wordIds?: string[];
  /** 워크스페이스/스크립트퀴즈로 보낼 때 */
  textId?: string;
  /** 큐 빌더가 사용. Cold 사용자엔 'interleaved' 강제 X (§17 안티패턴 3). */
  strategy?: 'blocked' | 'hybrid' | 'interleaved';
  /** Dictation 전용 */
  unit?: 'sentence' | 'paragraph' | 'full';
}

export type RecommendContext =
  | { context: 'hub' }
  | { context: 'workspace'; textId: string }
  | { context: 'after-session'; justFinished: ModuleId };
```

#### 2-C. 구현 우선순위 (§17.9)

```
P1: filterUrgentCards (R<0.6) ≥ 3
    → { module: 'flashcard', strategy: 'blocked',
        label: `오늘 ${N}개를 다시 만나보세요` }

P2: 진행 중 원문 (progress_percent < 100, last_opened DESC LIMIT 1)
    → { module: 'workspace', textId,
        label: `${title} 이어 듣기` }

P3: user_stats.mastery_level별 분기
    P3-Cold: state='new' 단어 ≥ 5
        → { module: 'flashcard', strategy: 'blocked', wordIds: top10,
            label: '오늘 10개 단어를 만나볼까요?' }
    P3-Warm: shaky 단어 중 module_history에 'dictation' 없는 것 ≥ 5
        → { module: 'dictation', unit: 'sentence', strategy: 'hybrid',
            label: '귀로 익혀볼 시간이에요' }
    P3-Hot: 모든 단어가 stable인 텍스트 ≥ 1
        → { module: 'scriptquiz', textId, strategy: 'interleaved',
            label: '원문 전체를 점검해볼까요?' }

P4: Cold start fallback
    → { module: 'library', label: '새 원문을 만나보세요' }
```

#### 2-D. 데이터 접근

워크스페이스 기존 Supabase 클라이언트 패턴을 먼저 확인:

```bash
grep -rn "createClient\|createServerClient" apps/web/src/lib/supabase/ | head -5
```

기존 패턴 그대로 사용. `next-action.ts`는 server-only — `'server-only'` import 추가.

`apps/web/src/lib/srs/state.ts`의 `filterUrgentCards`와 `apps/web/src/lib/srs/supabase-adapter.ts`의 `rowToCard`를 활용.

#### 2-E. 테스트

`apps/web/src/lib/recommend/__tests__/next-action.test.ts`에 4 시나리오:

1. urgentWords ≥ 3 → P1 (flashcard, blocked)
2. urgentWords 0 + 진행 중 텍스트 1개 → P2 (workspace)
3. urgentWords 0 + 진행 중 X + Cold + new 단어 10개 → P3-Cold (flashcard, blocked)
4. 모두 비어있음 → P4 (library)

Supabase는 `vi.mock('@/lib/supabase/server')`로 모킹. 실제 DB 연결 X.

---

### 단계 3 — 큐 빌더 (`queue-builder.ts`)

`apps/web/src/lib/srs/queue-builder.ts` 신규 생성. CLAUDE.md §17.6 인지 축 구현.

#### 3-A. 사양

```typescript
// apps/web/src/lib/srs/queue-builder.ts
//
// CLAUDE.md §17.6 [6] 인지 축 — 큐 자동 분기
// 추천 엔진이 strategy를 결정하지만, 단어별 Stability에 따라 미세 조정.
// 근거: Hwang(2025) Language Learning + Brunmair 메타분석
```

#### 3-B. 시그니처

```typescript
import type { SrsCard } from './index';

export interface QueueOptions {
  strategy: 'blocked' | 'hybrid' | 'interleaved';
  blockedRepeats?: number;  // default 3
  hybridRepeats?: number;   // default 2
  maxLength?: number;        // default 20
  seed?: number;             // 결정성 확보 (테스트용)
}

export function buildQueue(cards: SrsCard[], options: QueueOptions): string[];
```

#### 3-C. 동작

| strategy | 동작 |
|----------|------|
| `blocked` | 각 카드 `blockedRepeats`회 연속 → 다음 카드. 예: `[A,A,A,B,B,B,C,C,C]` |
| `hybrid` | 라운드 로빈 — 카드 N개를 `hybridRepeats`회 순회. 예: `[A,B,A,B]` |
| `interleaved` | seed 기반 결정적 셔플. 인접 중복 자동 제거 |

`maxLength` 초과 시 자르기. 빈 cards 입력 시 빈 배열.

#### 3-D. 테스트

`apps/web/src/lib/srs/__tests__/queue-builder.test.ts`:

- `Blocked: [A,B,C], repeats=3 → [A,A,A,B,B,B,C,C,C]`
- `Hybrid: [A,B], repeats=2 → [A,B,A,B]`
- `Interleaved 결정성: 같은 seed → 같은 결과`
- `Interleaved 인접 중복 없음`
- `maxLength 적용`
- `빈 입력 → []`

---

### 단계 4 — 통합 검증

#### 4-A. 전체 빌드

```bash
cd apps/web
npx tsc --noEmit
npx vitest run
```

기대: **TSC 0 errors + 모든 테스트 PASS** (단계 0의 31 + 단계 2의 4 + 단계 3의 6 = 약 41 tests)

#### 4-B. CLAUDE.md 정합성 자가 점검

다음 모두 ✅이면 PR 준비 완료:

- [ ] `state` 컬럼이 어디에도 DB로 저장되지 않음 — 항상 `getMemoryState(card, now)` 호출
- [ ] FSRS 변수(D/S/R)가 사용자 가시 영역에 노출 X
- [ ] 추천 호출 지점이 정확히 3곳 (Hub Today CTA / FloatingSparkle / 세션 종료 후) — 그 외 추가 X
- [ ] 추천 라벨이 격려형 — 정확도/실패 카운트 X
- [ ] 큐 분기가 단어별 Stability 기반으로 자동 작동 — Cold 사용자에게 Interleaved 강제 X
- [ ] 한국 학습자 초기 파라미터(0.85 / 6.0 / 365 / [1d, 3d]) 적용 확인
- [ ] vocabularies 6컬럼 + texts 3컬럼 + learning_records.rating + user_stats 모두 마이그레이션됨
- [ ] 모든 코드는 strict TypeScript
- [ ] TODO·placeholder·"나중에" 0건
- [ ] 기존 `sm2.ts`는 손대지 않음

#### 4-C. 단계 4 보고

```markdown
### 전체 작업 완료
- 단계 0: zip 풀기 + CLAUDE.md v06.8 + SRS 6파일 + 의존성 ✓
- 단계 1: Migration SQL 작성·적용 ✓
- 단계 2: 추천 엔진 + 4 tests ✓
- 단계 3: 큐 빌더 + 6 tests ✓
- 단계 4: 통합 검증 — TSC 0 errors, 41 tests passed ✓
- 자가 점검 10개 항목 모두 통과 ✓

다음 후보:
- §14 Hub의 Today CTA에 next-action.ts 연결
- WordVault L3 등록 시 createNewCard 호출 통합
- Dictation/Flashcard에서 applyReview 호출 통합
```

---

## 5. 매 단계 보고 형식

```markdown
### 단계 N 완료

**변경 사항**
- 파일 X개 (생성/수정 구분)
- 핵심 결정: ...

**검증 결과**
- TypeScript: ✅ 0 errors
- Vitest: ✅ N tests passed
- (필요시) DB: ✅ 컬럼 N개 추가 확인

**다음 단계**
- 단계 N+1 진행할까요?
```

---

## 6. 막혔을 때

| 상황 | 대응 |
|------|------|
| zip 위치를 모름 | 사용자에게 zip 절대경로 확인 요청 |
| CLAUDE.md 버전이 v06.8이 아님 | zip 풀기 실패 — 사용자 보고 |
| `tsc` 에러 | 코드를 의심하기 전에 워크스페이스의 다른 tsconfig가 충돌하는지 확인 |
| Vitest 31 tests 일부 실패 | **테스트를 수정하지 말 것** — §17 사양 검증용. 사용자 보고 |
| `sm2.ts`와 import 충돌 | sm2는 그대로 두고 새 srs/index.ts를 사용. CLAUDE.md §17.4: "기존 sm2.ts 인터페이스는 wrapper로 유지" 정책 |
| Supabase migration이 기존 데이터와 충돌 | `IF NOT EXISTS` 패턴으로 idempotent하게 작성됨 — 재실행 안전 |
| 모노레포 경로(`packages/*`)를 가정한 import 발견 | 단일 앱이므로 `@/lib/srs` 등 alias 사용 |

---

## 7. 다음 작업 (참고용 — 본 지시문 범위 밖)

본 지시문 4단계가 끝나면, 다음은 §14 Hub 통합입니다:

1. `HubHero` Today CTA에 `getNextBestAction(userId)` 결과 바인딩
2. `Workspace` 페이지에 FloatingSparkle 컴포넌트 추가, `getNextBestAction(userId, { context: 'workspace', textId })` 호출
3. 게임 모듈 종료 화면에 `getNextBestAction(userId, { context: 'after-session', justFinished })` 호출
4. WordVault L3 단어 등록 시 `createNewCard()` 호출하여 vocabularies INSERT
5. Flashcard/Dictation/SpellForge에서 사용자 평가 직후 `applyReview()` + `cardToUpdatePayload()` + `resultToRecordPayload()` 흐름 통합

이 부분은 §14 Hub와 각 게임 모듈을 직접 수정해야 하므로 별도 지시문으로 진행 권장.

---

이 지시문을 끝까지 읽었다면, **단계 0**부터 시작하세요.
