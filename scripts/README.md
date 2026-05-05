# scripts/

워크스페이스 유틸 스크립트.

## 영단어 사전 import — `import-anki-dictionary.mjs`

Oxford Dictionary A1-C2 (Anki .apkg) → Supabase `shared_dictionary` + `dictionary_categories` + `dictionary_word_categories` 일괄 import.

### 사전 준비

1. **마이그레이션 적용** (필수, 1회)
   ```powershell
   pnpm db:push
   ```
   적용 마이그레이션:
   - `20260504144011_add_shared_dictionary.sql`
   - `20260504154153_add_dictionary_categories.sql`
   - `20260504160708_prepare_dictionary_for_anki_import.sql` ★ Anki import 전 필수

2. **`.env.local` 에 `SUPABASE_SERVICE_ROLE_KEY` 추가**
   - Supabase Dashboard → Project Settings → API → `service_role (secret)` 복사
   - `eyJ...` 로 시작하는 JWT
   - ⚠️ `NEXT_PUBLIC_` prefix 절대 금지 — 클라이언트 노출 시 RLS 우회 권한 유출

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

3. **데크 파일 배치**
   - `data/import/Oxford_Dictionary_A1-C2_American_English_Categorized.apkg`
   - `.gitignore` 처리됨 — 커밋되지 않음

4. **의존성** (1회)
   ```powershell
   pnpm add -D -w adm-zip better-sqlite3 @supabase/supabase-js dotenv
   ```

### 실행

```powershell
# 통계만 확인 (DB 변경 없음)
pnpm db:import-anki -- --dry-run

# 실제 import (확인 프롬프트 → y)
pnpm db:import-anki

# 확인 프롬프트 스킵 (CI 용)
pnpm db:import-anki -- --yes
```

내부적으로 `node --env-file=.env.local scripts/import-anki-dictionary.mjs` 실행.

### 출력 예시

```
[1/5] env 검증
  ✓ url          : https://xxxx.supabase.co
  ✓ service_role : eyJhbGciOiJI…aBcDeF
  ✓ apkg         : .../Oxford_Dictionary_A1-C2_American_English_Categorized.apkg

[2/5] .apkg 압축 풀기
  ✓ extract → /tmp/vocaflow-anki-XXXX
  ✓ db     : collection.anki21

[3/5] notes + 모델 필드 파싱
  ✓ raw notes : 29,339
  ✓ parse 완료

[4/5] 통계
  unique words      : 21,820
  categories        : 566  (H1=18 / H2=76 / H3=472)
  word-category map : 29,145
  skipped — bad POS : 109
  skipped — empty   : 85
  skipped — bad CEFR: 0

  → 총 31,531 row 를 https://xxxx.supabase.co 로 INSERT 합니다.
    계속? (y/N) y

[5/5] Supabase upsert (ignoreDuplicates=true)
  dictionary_categories          566 / 566
  shared_dictionary              21,820 / 21,820
  dictionary_word_categories     29,145 / 29,145

✅ import 완료
```

### 멱등성

3 테이블 모두 `upsert(..., { ignoreDuplicates: true })` — DO NOTHING 의미.

- 기존 row 의 `meaning_ko` (Phase 4-4 에서 채워짐), `verified`, `cover_emoji` 등은 **절대 덮어쓰지 않음**.
- 부분 실패 후 재실행해도 중복 INSERT 없음.

### 안전 장치

| 장치 | 동작 |
|---|---|
| `service_role` 형식 검증 | `eyJ` 로 시작하지 않으면 즉시 종료 |
| 사용자 확인 프롬프트 | "총 N row INSERT 합니다. 계속? (y/N)" |
| `--dry-run` | INSERT 없이 통계만 |
| 임시 파일 자동 삭제 | OS tmpdir 에 추출 후 종료 시 `rmSync` |
| FK 순서 강제 | categories(level↑) → dictionary → mapping |

### 검증 SQL (import 후 실행)

Supabase SQL Editor 에서:

```sql
-- 1) 카운트 일치
SELECT 'shared_dictionary'           AS t, COUNT(*) FROM shared_dictionary
UNION ALL SELECT 'dictionary_categories',           COUNT(*) FROM dictionary_categories
UNION ALL SELECT 'dictionary_word_categories',      COUNT(*) FROM dictionary_word_categories;
-- 기대: 21820 / 566 / 29145

-- 2) 카테고리 트리 정합 (orphan parent_id 검출)
SELECT c.id, c.parent_id
FROM dictionary_categories c
LEFT JOIN dictionary_categories p ON p.id = c.parent_id
WHERE c.parent_id IS NOT NULL AND p.id IS NULL;
-- 기대: 0 row

-- 3) get_category_path 동작
SELECT get_category_path(id) AS path
FROM dictionary_categories
WHERE level = 3
LIMIT 5;
-- 기대: ['People','Personal qualities','Brave'] 식 3원소 배열
```

### 데이터 보정 (Phase 4-4 — Claude 한국어 번역)

본 스크립트는 `meaning_ko = ''` 빈 문자열로만 채움. 한국어 뜻은 별도 단계에서 Claude API 로 일괄 채움 예정 (`scripts/translate-dictionary.mjs` — 미작성).

### `source` 필드 설계 메모

| 테이블 | `source` 값 | 이유 |
|---|---|---|
| `shared_dictionary` | `'oxford-anki'` | 20260504160708 마이그레이션에서 CHECK 에 추가 |
| `dictionary_word_categories` | `'oxford-anki'` | 매핑 출처 정확히 추적 |

두 테이블 모두 동일 `source` 값 사용 — 사전 row 와 매핑 row 의 출처를 일관되게 추적.

---

## 기타 스크립트

| 파일 | 용도 |
|---|---|
| `smoke-tokens.mjs` | `@vocaflow/design-tokens` 런타임 검증 |
| `verify-tokens.mjs` | 토큰 export 일관성 검증 |
| `fix-mojibake.mjs` | 한글 깨짐 일괄 복구 |
| `fix-mojibake-runs.mjs` | Slate runs 한글 깨짐 복구 |
| `marketing-ref-transform.mjs` | 마케팅 레퍼런스 변환 |
