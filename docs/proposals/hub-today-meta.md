# hub "오늘" META 재설계 — 처방 정본화 (Opt A)

> **확정: 2026-07-11.** CTP(CSAT Track Pipeline) ⑥ Today UI 의 선행 게이트였던 "학습자 홈(META) 재설계" 결정.
> 사용자 승인: META 방향 = **Opt A(처방=스마트 기본값)** · Phase 1 착수 승인.

---

## 1. 문제 — hub "오늘"의 삼중 출처

로그인 후 홈은 `/hub`(Today)로 수렴한다. 그런데 "오늘 무엇을 할지"를 말하는 표면이 이미 둘이었고, CTP `prescribe_today`가 셋째가 되려던 상황이었다:

| 표면 | 출처 | 성격 |
|---|---|---|
| `TodayPlanCard` | `study_plan_items`(사용자가 `/plan`에서 편성한 요일별 계획) | 명시적·사용자 의지 |
| `TodayFocus` | `getPersona()` **클라이언트 휴리스틱**(진단여부·단어수·risk·streak 5분기) | 암묵적·추정 |
| (신규) `prescribe_today` | 결정론 5블록 처방(stage_band 기반) | 교육학적 근거 |

Calm UI · Progressive Disclosure 상 "오늘 할 일"은 **하나의 정본(SSoT)** 이어야 한다 → 삼중화 해소가 META 의 본질.

## 2. 확정 규칙 (Opt A — 처방=스마트 기본값)

`hub/page.tsx` 에서 **단일 표면만** 노출(우선순위):

| 학습자 상태 | "오늘" 표면 |
|---|---|
| **오늘 수동계획 있음**(오늘 요일 `study_plan_items`) | `TodayPlanCard` — 사용자 의지 우선(Empathetic override) |
| **진단완료 + 수동계획 없음** | `TodayPrescriptionCard`(★ `prescribe_today` 5블록) — 스마트 기본값 |
| **미진단** | `TodayFocus`(진단 유도 CTA만) |

→ `TodayFocus` 의 페르소나 휴리스틱은 진단완료자에게 **처방으로 승격 대체**, 미진단 유도만 잔존.
`prescribe_today` 5블록(복습→듣기→읽기→연습→검증)은 수능 전용이 아니라 일반 학습 루프 — 진단 완료자 전반에 적용 가능하며 휴리스틱보다 근거가 강하다.

## 3. prescribe_today 5블록 → hub 런처 매핑

`prescribe_today(uuid)` 반환 jsonb `blocks[]` 파싱: `lib/learner/prescription-actions.ts`.

| # | 블록 kind | 카드 표기 | Phase 1 런처 |
|---|---|---|---|
| ① | `fsrs_due` | 복습 · due N개 · 10분 | `/flashcard/play`(전역 due 큐). due 0 → "완료" 상태칩 |
| ② | `listening` | 따라읽기 · 10분 | 최근 텍스트 `/text/[id]/echo`, 없으면 `/library/books` |
| ③ | `input` | 읽기 · stage_band · 30분 | 후보(≤4): book → `/library/books/[id]`, article → `startArticleLearning`(texts 변환) → `/text/[id]?mode=read` |
| ④ | `practice` | 구문 연습 · N개 · 15분 | **Phase 2**(DCP order/insert 인터랙션). Phase 1 = 상태칩("곧 제공"/"—")만 |
| ⑤ | `verify` | 점검 · 10분 | `/scriptquiz`(카탈로그) |

**설계 제약**: 처방 candidates(`csat_stage_catalog`: article=`library_articles.id`, book=`library_books.id`)는 읽기 URL 직결 불가 — article 은 `startArticleLearning` 서버액션이 `texts` 행으로 멱등 변환, echo 는 `texts.id` 필요. 이 때문에 article 후보만 client 런처(`PrescriptionArticleLaunch`).

## 4. 구현 (Phase)

- **Phase 1 (✅ v06.203)** — 처방 정본 배선. 신규: `lib/learner/prescription-actions.ts`(서버 액션) · `components/home/TodayPrescriptionCard.tsx`(서버) · `components/home/PrescriptionArticleLaunch.tsx`(client). `hub/page.tsx` 분기 배선 + `TodayFocus` 진단완료 경로 대체. ④ DCP 는 상태 표시만.
- **Phase 2 (✅ v06.204)** — DCP 인터랙션 라우트 `/practice/dcp`: order(문장 배열·이동 버튼)·insert(위치 슬롯) 플레이어(`DcpItems`/`DcpPlayer`) → `grade_dcp_item`(서버 answer_key, `attempt_id` 반환) → `csat_item_attempts` 기록 → 오답 시 error_cause 1-tap(5원인 · 정적 라우팅=존재 라우트만, vocab→`/flashcard/play`). hub practice 블록 상태칩→실런처. **CTP ⑥ 완결.**

## 5. 검증

- tsc: 신규 3파일 + hub 배선 clean(전체 잔여 에러는 기존 `recommend/next-action.mock.ts` 1건, 무관).
- 데이터 경로: `prescribe_today` 5블록 payload 실측(RPC 정상 반환).
- 스모크: `/hub` 무회귀(기존 runtime-test 계정 = 오늘 수동계획 보유 → TodayPlanCard 경로). 처방-분기 실 렌더 검증은 "진단완료 + 오늘 수동계획 없음" 계정 필요 — 후속 spec 자산화 대상.

---

*관련: `docs/AI_CONTEXT/diagnostics/ctp_p0_20260709.md`(CTP P0) · `docs/CSAT_SOURCE_MATRIX.md` · CHANGELOG v06.163~199.*
