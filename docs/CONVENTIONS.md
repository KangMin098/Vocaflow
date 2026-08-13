# Conventions

> Vocaflow 코드 작성 패턴 · 네이밍 · 안티패턴. 새 PR 머지 전 체크리스트로 활용.
> 작성 시점: 2026-06-08 (v06.34).

---

## 절대 하지 않을 것

### Typography
- `Inter` · `Roboto` · `Arial` 사용
- 한글 텍스트에 영어 폰트 (Lora) 사용
- 영어 본문에 산세리프 (Plus Jakarta / DM Sans) 사용

### 색상
- `--color-primary` 등 v5 롱폼 변수 사용 (**v6 이후 `--p` 축약형만**)
- 보라색 그라디언트 배경 (PairFlip Editorial 팔레트 제외)
- Quizlet 로고·아이콘·브랜드색(#4255FF teal) 복사
- 색상만으로 정보 전달 (접근성 위반)

### 학습 UX
- 학습 중 화면 광고 배치
- 모달 오버레이로 학습 중단 ("3일 연속 학습이 끊겼어요!")
- 정답률 빨간 글씨 압박 ("정확도 67% 😢")
- 진행률 100% 도달 시 폭죽·트로피 — 차분한 "오늘 잘 마쳤어요" 선호

### 접근성
- 44px 미만 터치 타겟
- placeholder 만으로 레이블 대체
- 애니메이션 없는 상태 전환

### 데이터 모델
- `memory_state` 컬럼 DB 저장 (R(t) 동적 계산만)
- `mastery_progress` 컬럼 5단계 (learning_records 누적으로 계산)
- `last_days` / `next_days` 컬럼 (Date 차이로 derive)
- 암호화되지 않은 Claude API 키 / 사용자 비밀번호 (Supabase Vault 사용)
- `module_history` 를 정규화 (TEXT[] 그대로 유지)

### 텍스트 토큰화 (v06.35 — 실측 누수 6종에서 도출)
학습자 입력 스크립트는 **아무 글이나 들어온다**. 아래는 모두 `lib/text-extract/tokenize.ts` 에서 실제로 발생했던 결함이다.

- **정렬 후 절단** — `sort().slice(0, N)` 은 알파벳 뒷글자를 통째로 지운다. 상한을 둘 거면 **등장 순서**로 자르고, 잘린 수를 반드시 반환값에 노출 (조용한 절단 금지)
- **아포스트로피를 문자 클래스로 처리** — `split("'")[0]` 류는 `didn't`→`didn`, `won't`→`won` 을 만든다. **`won`·`don` 은 사전에 실재하므로 하류 필터를 전부 통과해 원문에 없던 단어를 학습자에게 가르친다.** 축약은 불규칙 맵 + `n't`/clitic 규칙으로 어간 복원
- **숫자 결합 토큰의 알파벳 앞부분만 남기기** — `CO2`→`co` 는 없는 단어를 짓는 것. 숫자가 섞이면 **통째로 제외**
- **유니코드 정규화 생략** — U+0027 vs U+2019, soft hyphen, `ø`/`é` 를 정규화하지 않으면 붙여넣기 출처에 따라 결과가 달라진다 (재현성 없음 = 회귀 측정 불가)
- **하이픈과 대시를 같이 취급** — 하이픈은 복합어를 잇고(`self-taught`), em/en dash 는 구두점으로 끊는다
- **관습 제거 정규식을 느슨하게** — 화자 라벨 스트립이 `"There is one lesson here: "` 를 통째로 삼켰다. **덜 지우는 쪽이 안전하다** (남은 인명은 서버 `word_register='proper_noun'` 이 거른다). 과삭제는 누수, 과소삭제는 무해

원칙: 표제어 해석은 서버 `resolve_dict_headword`(4계층) 담당. 클라이언트 토크나이저는 **"있던 것을 있는 그대로, 빠짐없이. 없던 것은 만들지 않기"** 만 책임진다.

### Cross-platform
- 웹 전용 또는 앱 전용 단방향 설계
- Parts Kit v01~v05 기준 코드

---

## 항상 지킬 것

### 컴포넌트
- 모든 인터랙티브 요소에 hover + active + focus + disabled 4상태
- 모든 카드·버튼에 transition (`--dur-normal`, `--ease`)
- 정답/오답 피드백: 색상 + 아이콘 + 애니메이션 3중
- 모바일 퍼스트 → 데스크톱 확장 (390 → 768 → 1280)
- 공통 컴포넌트 `components/ui/` 재사용 우선

### 스타일
- CSS Variables (`--p`, `--bg`, `--t1`) 로 테마 제어 — 하드코딩 금지 (게임 전용 예외 제외)
- `data-theme="dark"` 모든 컴포넌트 대응 필수
- 이미지 대신 Lucide 아이콘 우선

### React Native
- `minHeight: 44, minWidth: 44` 터치 타겟
- `accessibilityLabel` 모든 버튼

### 코드 작성
- 파일 첫 줄에 경로 주석 (`// apps/web/src/components/ui/Button.tsx`)
- 완성형만 — TODO·생략·placeholder 절대 금지

---

## 파일 경로 주석 규칙

```typescript
// 웹 (Next.js)
// apps/web/src/components/ui/Button.tsx              ← 공통 UI
// apps/web/src/components/game/spellforge/...        ← 게임
// apps/web/src/components/wordvault/WordList.tsx     ← 단어장
// apps/web/src/app/(main)/hub/page.tsx               ← 페이지
// apps/web/src/lib/supabase/client.ts                ← Supabase

// 앱 (Expo)
// apps/mobile/src/components/ui/Button.tsx           ← RN 버전

// 공유 패키지
// packages/design-tokens/src/colors.ts
// packages/types/src/database.ts
```

---

## 폴더 분리 원칙 (Single Responsibility)

| 폴더 | 책임 | 들어가는 것 / 들어가면 안 되는 것 |
|---|---|---|
| `components/ui` | 디자인 시스템 원자 | Parts Kit 컴포넌트만. 비즈니스 로직 금지 |
| `components/{도메인}` | 도메인별 합성 | API 호출 OK. 다른 도메인 import 금지 |
| `components/admin` | 관리자 콘솔 전용 | AdminSidebar 등. 사용자 앱과 격리 (보라 액센트) |
| `components/dev` | 개발 도구 | StubPage 등 placeholder. 프로덕션 의미 부여 금지 |
| `hooks` | UI ↔ 데이터 연결 | React 훅만. 순수 함수는 `lib/utils` |
| `stores` | 전역 클라이언트 상태 | Zustand 스토어 |
| `lib` | 외부 통합 + 유틸 | API SDK 래핑·파서·계산. React 훅 금지 |
| `types` | TS 타입 | 인터페이스·타입·enum. 실행 코드 금지 |

---

## Supabase 클라이언트 패턴

### Server Component / Route Handler
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('texts').select('*')
}
```

### Client Component
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

function Component() {
  const supabase = createClient()  // 동기 (싱글톤)
}
```

### Service Role (절대 클라이언트 노출 금지)
```typescript
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
```

## Admin API 인증 패턴

```typescript
import { requireAdminApi } from '@/lib/auth/require-admin-api'  // ✅ API route
import { requireAdmin } from '@/lib/auth/require-admin'         // ✅ RSC / Server Action

// API route — NextResponse 반환
const adminOrError = await requireAdminApi()
if (adminOrError instanceof NextResponse) return adminOrError

// RSC / Server Action — redirect()
await requireAdmin('/admin/curation')
```

---

## 풀스크린 라우트 정책

`lib/layout/full-screen-routes.ts` `isFullScreenRoute(pathname)` — Sidebar 와 FlowNav 가 공유:

```typescript
const FULL_SCREEN_ROUTES = [
  '/flashcard/play', '/spellforge/play', '/scriptquiz/play',
  '/pairflip/play', '/dictate/session',
  '/wordvault/browse',
  '/play/wordblitz', '/play/pirate-quest',
]
```

세션 셸 `components/layout/SessionFrame.tsx` 자동 주입.

### 세션 "제자리 복귀" (?from / backHref) — 항상 지킬 것

풀스크린 세션은 진입 출처로 닫혀야 한다("진입→닫기→제자리"). 두 축을 반드시 지킨다:

1. **진입 링크**: 풀스크린 play 라우트로 보내는 링크는 **`?from=<현재경로>`** 를 부착한다.
   SessionFrame(X·Esc)이 이를 읽어 복귀 — 미부착 시 모듈 hub로 튕긴다.
   - 워크스페이스: `ModePills.withReturn()` · 계획/홈: `activityLaunchHref(m, activity, origin)` (풀스크린 라우트에만 자동 부착).
   - 해시(`#set-…`)·비세션(`/dictate/setup`·echo·hub)엔 붙이지 않는다.
2. **세션 내부 닫기/완료 버튼**: `/text/${id}` 를 직접 하드코딩하지 말 것. 반드시 서버/클라이언트
   페이지가 계산한 **`backHref`** 를 prop 으로 받아 쓴다 — [`resolveSessionReturnHref(from, text, hubHref)`](../apps/web/src/lib/layout/session-return.ts)
   (`?from` → 스코프 텍스트 → hub). 스코프 진입 시 `textId` 는 단어 id 라 링크로 쓰면 404.
3. **`router.back()` 금지 조건**: 직접 진입(북마크/새로고침) 가능한 비세션 화면(`/dictate/setup` 등)에서
   무가드 `router.back()` 은 앱 이탈 → `window.history.length > 1` 가드 후 hub `push` fallback.

---

## 폼 검증

- `min` 50자 (`CONTENT_MIN`)
- `max` 100,000자 (`CONTENT_MAX`)
- title `max` 200자 (`TITLE_MAX`)
- 책 챕터 `max` 50개 (`MAX_CHAPTERS`)

---

## Server Action 결과 타입

```typescript
export type DeleteResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'unauthenticated' | 'not_found' | 'error'; message?: string }
```

---

## 에러 처리

### 클라이언트
- `window.alert` — 사용자 액션 결과
- `console.error` — DevTools 진단용
- Toast (`components/ui/Toast.tsx`) — 격려·정보

### 서버
- `try/catch` + `console.error` + `NextResponse.json({ error })`
- `revalidatePath('/text')` 등 — 변경 후 cache 무효화

---

## 마이그레이션 작명 규칙

```
YYYYMMDDHHMMSS_descriptive_name_in_snake_case.sql

예:
20260608120000_texts_user_book_group_id.sql
20260607170000_admin_bulk_return_to_source.sql
```

내용 첫 줄: `-- {filename}` 주석.
두 번째 블록: 의도 설명 (Korean OK).

### 적용 전 검토

**[memory: 사용자 SOP]** 마이그레이션 자동 적용 금지. SQL 보여주고 승인 받은 뒤 `apply_migration` 실행.

---

## 안전 가드 패턴

### Bulk RPC

```sql
CREATE OR REPLACE FUNCTION admin_bulk_X(p_book_ids uuid[])
RETURNS TABLE(...)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  -- 자격 row 만 처리, 자격 외는 silently skip
  FOR v_id IN
    SELECT id FROM library_books
     WHERE id = ANY(p_book_ids) AND status = ANY(v_eligible)
  LOOP
    -- 안전 가드 1: published 단어장 존재
    -- 안전 가드 2: 사용자 텍스트 참조
    -- 실제 작업
  END LOOP;

  RETURN NEXT;
END $function$;
```

---

## 컴포넌트 props 인터페이스 규칙

```typescript
interface FooProps {
  /** 한 줄 설명 */
  required: string
  /** 선택 — null 일 때 폴백 동작 명시 */
  optional?: string | null
  /** 이벤트 — on{Action} */
  onAction?: () => void
  /** disabled flag */
  pending?: boolean
}
```

- 모든 prop JSDoc 1줄 (의도 + 선택 여부)
- callback prefix `on{Action}`
- `loading` 보다 `pending` 선호 (useTransition 정합)

---

## 한글 vs 영어 표기

| 항목 | 표기 |
|---|---|
| 모듈 이름 (UI) | "플래시카드", "단어장", "스크립트" |
| 모듈 이름 (코드) | Flashcard, WordVault, TextViewer |
| 학습 카피 | 한글 (사용자 친화) |
| 코드 주석 | 한글 OK (디자인 의도 명확화) |
| 변수명 | 영어 camelCase |
| 함수명 | 영어 camelCase (`saveText`, `aggregateBookChapters`) |
| 파일명 | kebab-case (`save-text.ts`, `book-chapter-input.tsx`) |
| 컴포넌트명 | PascalCase (`TextCard.tsx`, `BookChapterInput.tsx`) |

---

## 가독성 명명 규칙

### TypeScript
```typescript
// ✅ 명확한 의도
const isLibraryBookCard = !!text.bookId
const isUserBookCard = !isLibraryBookCard && !!text.userBookGroupId
const chapterN = text.chapterCount ?? 0

// ❌ 모호
const ok = !!text.bookId
const n = text.chapterCount ?? 0
```

### DB
- 테이블: 복수형 (`texts`, `vocabularies`, `library_books`)
- 컬럼: snake_case
- FK: `{table}_{column}_fkey`
- 인덱스: `idx_{table}_{cols}` (또는 `{table}_{col}_key` for unique)
- RPC: `{verb}_{noun}` (`admin_bulk_requeue_books`)

---

## PR 자가 점검 체크리스트

머지 전:
- [ ] 학습 과학 원칙 중 최소 1개에 명시적 기여?
- [ ] Calm UI 위반 없는가? (색·소리·애니메이션 과잉)
- [ ] 회상 부담을 명시적으로 만드는가?
- [ ] 실패가 비난적이지 않은가? ("다시 만나봐요" / "곧 익숙해질 거예요")
- [ ] 진행을 환경으로 보여주는가? (숫자만이 아닌 색·아이콘·여백)
- [ ] 맥락을 보존하는가? (단어/표현은 스크립트이나 예문과 결합)
- [ ] DB direct query · 라우트 grep 으로 검증 가능한가?
- [ ] 파일 첫 줄 경로 주석 있는가?
- [ ] 모든 인터랙티브 hover/active/focus/disabled 4상태?
- [ ] data-theme="dark" 정합?
- [ ] WCAG AA 대비 + 44px 터치 타겟?
- [ ] 색상 + 형태 + 텍스트 3중 표현 (색맹 대응)?

---

## 골든셋 스냅샷 규약 (v06.118 · 파이프라인 품질평가 Q1)

파이프라인 순수 함수(`computeLexicalNoise` · `segmentBook`/`normalizeBook` · `alignChaptersBy*` · `judgeIPlusOne`)는
골든셋 fixture 기반 스냅샷 테스트가 CI(`turbo run test`)에서 회귀를 감시한다.

- fixture: `packages/library-pipeline/test/fixtures/` (책·글 raw + meta.json) · `apps/web/src/test/fixtures/librivox/` (정합 리스트)
- **라이선스-안전만** (PD / CC BY / CC BY-SA + attribution). CC BY-ND(The Conversation)는 fixture 저장 금지.
- **스냅샷 diff = 차단 아님, 리뷰 필수 신호.** 의도적 파이프라인 개선 시: ① diff 검토 ② 스냅샷 갱신을 별도 커밋으로 분리 ③ CHANGELOG 에 "골든셋 스냅샷 갱신 — 사유" 1줄.
- fixture 는 분기당 1건 교체 (화석화 방지).
- RPC 통합 스냅샷(`extraction-rpc.integration.test.ts`)은 env-skip — CI 에서 skip 이 정상, 로컬/수동 실행 전용.

---

## 변경 이력 기록

각 PR 머지 후 [CHANGELOG.md](./CHANGELOG.md) "Unreleased" 또는 새 버전 섹션에 추가:
- 신규 라우트 / API
- 신규 컴포넌트
- 마이그레이션 (요약 — 정확한 SQL 은 git log)
- 모듈 시맨틱 변경
- 안티패턴 추가

3개 버전 (v06.32~34) 만 보존 — 이전은 git 이력 참조.

---

## 자동 .md 갱신 매트릭스 (사용자 standing authorization · 2026-06-08)

**[CLAUDE.md "자동화 정책" 섹션 참조]**. 코드 변경 발생 시 같은 turn 에 해당 .md 도 함께 갱신 (사용자 요청 없어도):

| 트리거 | 갱신 대상 |
|---|---|
| 마이그레이션 적용 | [DB_SCHEMA.md](./DB_SCHEMA.md) + [CHANGELOG.md](./CHANGELOG.md) |
| 새 RPC / view / trigger | [DB_SCHEMA.md](./DB_SCHEMA.md) |
| 새 라우트 | [ROUTES.md](./ROUTES.md) |
| 새 컴포넌트 (도메인 신설) | [MODULES.md](./MODULES.md) |
| 학습 모듈 / 인지 계층 변경 | [LEARNING_MODEL.md](./LEARNING_MODEL.md) + [MODULES.md](./MODULES.md) |
| 디자인 토큰 / 컴포넌트 패턴 | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Admin 라우트 / 일괄 액션 | [ADMIN_CONSOLE.md](./ADMIN_CONSOLE.md) |
| 큐레이션 RPC / 파이프라인 | [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md) |
| 코딩 패턴 / 안티패턴 추가 | 본 파일 ([CONVENTIONS.md](./CONVENTIONS.md)) |
| 패키지 추가/버전 변경 | [STACK.md](./STACK.md) |
| 위 모든 변경 (요약) | [CHANGELOG.md](./CHANGELOG.md) Unreleased |

### 갱신 원칙
- 정확도 100% — DB direct query / grep 으로 검증 가능한 사실만
- 같은 turn 안에 코드와 .md 함께 변경 (drift 차단)
- 별도 사용자 알림 없이 자동 — 작업 결과 요약에만 "+ 관련 doc 갱신" 한 줄

### Git 자동 commit / push (요약)

논리적 milestone 또는 파일 ≥5 변경 시 자동 commit + push (작업 브랜치만, main 직접 push 금지).
Conventional commits 스타일 + `Co-Authored-By` 첨부. 안전 안티패턴 (`.env`/secret/빌드 실패/DROP TABLE/30+ 파일) 시 사용자 확인.

상세: CLAUDE.md "🤖 자동화 정책".
