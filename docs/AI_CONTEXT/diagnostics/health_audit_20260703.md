# 프로젝트 건강도 감사 — 미완료·오류·개선점 우선순위 (2026-07-03)

> 첫 질문("미완료·오류·개선점 찾아 우선순위로 정리") 답변 산출물.
> 검증 방법: `tsc`·`next lint`·`next build`·`vitest` 실행 + Supabase security/performance advisor + `pg_policies`/live SQL + 코드 grep. 메모리 "잔여" 주장은 live 수치로 재확인.
> 이 세션(2026-07-03)에 P0 보안·빌드·품질 항목을 **처리 완료**(PR #92 → main merge `949f17b`). 아래는 처리분 + 잔여 백로그.

---

## ✅ 이 세션에서 처리 완료 (PR #92, main 반영)

| # | 항목 | 근거/검증 |
|---|---|---|
| 1 | **P0 보안 — public RLS 하드닝 8테이블** | security advisor ERROR **8→0**. `vocaflow_levels/tracks/domains/skills` authenticated read · `vrl_data_integrity_concerns` admin read · `noise_blacklist`/`english_irregular_forms` 락. 원인: 전 테이블 anon SELECT+INSERT + RLS off = 익명 read/write 가능 |
| 2 | **유출 backup 테이블 DROP** | `shared_dictionary_p5a_backup_20260620` (16,492 row) — 추출 P1~P4 목적 종료. 마이그레이션 `20260703120000` + `20260703120010` |
| 3 | **ESLint 빌드 게이트 복원** | lint 부채 청산(0 error) 후 `eslint.ignoreDuringBuilds` true→false. 풀 `next build` EXIT 0 (CI build job pass 2m21s) |
| 4 | **a11y — 지원 안 되는 `aria-*` 3건** | SourceCard `article`/Radio `radio`/CEFRDistribution `listitem` 의 aria 제거·승격 (스크린리더 무시되던 실버그) |
| 5 | **미커밋 방치 기능 복구** | "챕터 퀴즈 검수" admin(`ChapterQuizAdminSection`·`Modal`·`admin-quiz-queries`·`preview/[bookId]/page`)이 untracked 로 방치돼 CI import 미해결이던 것 완결 |
| 6 | **세션 hook 정리** | flashcard 카드마다 찍히던 프로덕션 `console.log` + stale TODO 제거 (영속화는 이미 `pushPendingResult`→`flushPendingSession` 로 동작 확인) |

**검증 상태(merge 시점)**: `tsc` 0 · `next lint` 0 error / 6 warning · `next build` EXIT 0 · `vitest` pass · CI 전 잡 green.

---

## 🔴 P0 — 보안/컴플라이언스 (잔여)

- **Auth 유출 비밀번호 보호 비활성** — HaveIBeenPwned 체크 off. Supabase 대시보드 → Authentication → Attack Protection 토글(코드 아님, 사용자 액션 30초).
- **약관 동의가 `raw_user_meta_data`에 임시 저장** — [signup/page.tsx:11]. `user_consents` 테이블 부재로 동의 시각이 감사 불가한 곳에 저장. Google OAuth 경로는 사전 동의 미수집. → 제품/법무 결정 필요(테이블 필드·요건).

## 🟠 P1 — 기능 정합·미검증 (잔여)

- **게임 모듈 런타임 미검증** — pairflip·scriptquiz 실데이터 배선은 랜딩됐으나 런타임 open. 학습자 관리 P0~P3 UI 도 동일. → dev 서버+브라우저(`/verify`) 필요.
- ~~**실패 도서 `The Marvelous Land of Oz`**~~ → **✅ 해소(이 세션)** — `reprocess-book.mjs --commit` 로 재fetch 완주: status `failed`→**`ready`** · 24챕터 · 41,589단어 · V7/B1 · vocab 3,033. `failed` 도서 잔여 **0**. (블로커는 패키지 빌드가 아니라 `pnpm dlx tsx` 가 깨진 `tsx@0.0.0` 을 받아온 것 — `pnpm install`(로컬 `tsx 4.22.1`) 후 `pnpm exec tsx` 로 해결.)
- **소셜 로그인** — Google 실연동, Apple/Kakao/Naver 는 "(목업) Phase 3" 토스트(정직 라벨). 죽은 버튼 아님 → 우선순위 낮음.

## 🟡 P2 — 인프라/성능 부채 (보류 확정)

- **DB 성능 advisor** — `multiple_permissive_policies` 120 · `auth_rls_initplan` **54정책/43테이블**(`auth.uid()` 미래핑) · unindexed FK 38 · unused index 35 · no PK 1. **보류 권장**: WARN 급 + DB 사실상 비어 있어(`user_profiles` 2행) 실이득 0, 반면 54 RLS 정책 재작성은 보안표면 리스크 → 스케일 시 프로그램적 생성+advisor 재검증으로.
- **`swcMinify: false`** — piper-tts/onnxruntime-web minify 실패 회피. 메모리 [project_next_build_broken] 재검증 결과 *불가 확정*(Next14 per-module 제외 API 없음). 진짜 fix = EchoMatch를 CDN/external 로드로 빼기. 우선순위 낮음.

## 🟢 P3 — 콘텐츠 백로그 (정상 추적)

- ScriptQuiz 큐레이션 퀴즈: 6권 360문항 완료, `ready` 14권 미발행 + 대형 도서(Pride·Twenty·Les Mis 등) 큐 대기.
- P6.4~6 구독 i+1 잔여 [handoffs/p6_subscribe_user_filter] · ACP 4 ingester 라이브 검증 미실시 · publish 시 `curation_metadata`→`library_books` 자동복사 미구현.

## ⚪ P4 — 소규모 정리 (잔여)

- `next lint` warning 6건 — exhaustive-deps(SpellForge 3·RecallCard 2·RssFeedTab 1). 각 per-case 분석 필요(의존성 추가 시 루프 위험) — 게이트는 warning 비차단이라 빌드 무영향.
- [queries.ts:160] `progressPercent: 0` 하드코딩 · [layout.tsx:9] mock 주입 TODO.

---

## 참고 — advisor 스냅샷 (2026-07-03, 처리 후)

- **Security**: ERROR 0 (was 8) · WARN 341 (security_definer_function_executable·pg_graphql_table_exposed·function_search_path_mutable 등 대량 — 대부분 설계상 노출/저위험) · INFO 3.
- **Performance**: WARN 173 (multiple_permissive_policies 120 + auth_rls_initplan 53) · INFO 74 (unindexed FK 38 + unused index 35 + no PK 1).
