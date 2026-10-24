# 유형 전용 판단 도구 — 공유 화면 연결 계약 (대량작업 D)

- 작성 2026-10-24 · 작성 owner `csat-judgment-d`(Claude) · 대상 브랜치 `feat/csat-judgment-bridge`
- 받는 쪽: 공유 화면 · 서버 파일 단일 owner `csat-lecture-disclosure`(T-0140 · T-0147). **D 는 아래 owner 파일을 수정하지 않는다.**
- 이 문서는 연결 인터페이스다. 제품 연결 · 실계정 E2E · 서버 공개 계약 검증의 완료 선언이 아니다.

## 1. 경계 — 누가 무엇을 고치나

| 파일 | 소유 | 이 계약에서 |
|---|---|---|
| `apps/web/src/{lib,components}/csat/judgment/**` | csat-judgment-d | 도구 · 로더 · provider · 선택기(이미 구현) |
| `apps/web/src/app/(app)/csat/item/[slug]/page.tsx` | csat-lecture-disclosure | `loadJudgmentItem` 호출 1회 + prop 전달 |
| `apps/web/src/app/api/csat/item/[slug]/judgment/route.ts` | csat-lecture-disclosure | 노출 원장 커밋 **뒤** 응답에 `judgment` 필드 추가 |
| `apps/web/src/components/csat/theater/AnalysisTheater.tsx` | csat-lecture-disclosure | 판단 장면 자리에 `<TypeJudgment>` 배치 |
| `lib/csat/inquiry/` · `theater/inquiry/` · 2026-34 판단 도구 | csat-v4-s0(T-0145) | 손대지 않는다 — 34번 컴포넌트 중복 개발 없음 |

## 2. D 가 제공하는 인터페이스

```ts
// 서버 전용 (import 'server-only') — apps/web/src/lib/csat/judgment/server.ts
loadJudgmentItem(db, itemId, analysisVersion): Promise<{ state: 'ready'; item: JudgmentItem } | { state: 'unavailable'; reason }>
loadJudgmentReveal(db, itemId, analysisVersion): Promise<RevealData | null>

// 클라이언트 — apps/web/src/lib/csat/judgment/provider.ts
judgmentRouteProvider(slug, deps?): RevealProvider   // POST /api/csat/item/[slug]/judgment, source 'judgment_scene'

// 클라이언트 — apps/web/src/components/csat/judgment/TypeJudgment.tsx
<TypeJudgment item={JudgmentItem} reveal={RevealProvider} stages?={['first']} />   // 도구 없는 유형 → null
hasJudgmentTool(typeId, stages?): boolean
```

- `JudgmentItem` 에는 정답 번호 · verdict · 정답 위치 · 해설이 **없다**(로더가 그 컬럼을 select 하지도 않는다).
- `db` 는 **service-role 서버 클라이언트**(`createAdminClient()`)여야 한다. `csat_item_units` 는 authenticated SELECT 권한 · RLS 정책이 없다(2026-10-24 확인). 스키마 · 권한 변경은 필요 없고 요청하지 않는다.
- `analysisVersion` 은 페이지가 이미 읽은 `CsatItemExplain.analysis_version` 을 넘긴다 — 해설 판본과 원문 단위 판본이 갈리지 않는다. 판본 · 단위 해시가 안 맞으면 `unavailable` 로 아무것도 내지 않는다.
- 공개 상태는 문항 id · 분석 판본 · 단위 판본에 묶인다. 같은 인스턴스에 다른 문항이 와도 이전 해설 · 학습자 선택이 이월되지 않고, 진행 중 요청의 늦은 응답은 버린다(T-0151 P1-01 수정).

## 3. owner 쪽 최소 변경 (제안 — owner 가 자기 TASK 로 적용)

**page.tsx** (첫 응답 — 정답 없음)
```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { loadJudgmentItem } from '@/lib/csat/judgment/server'
// item = loadCsatItemExplain 결과
const judgment = await loadJudgmentItem(createAdminClient(), item.id, item.analysis_version)
// <AnalysisTheater … judgmentItem={judgment.state === 'ready' ? judgment.item : null} />
```

**judgment/route.ts** (노출 원장 `learning_exposure_record` 커밋 성공 · 마지막 보류 관문 통과 **뒤**)
```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { loadJudgmentReveal } from '@/lib/csat/judgment/server'
const judgment = analysisVersion == null ? null : await loadJudgmentReveal(createAdminClient(), itemId, analysisVersion)
return NextResponse.json({ ok: true, exposureId: data, reveal, judgment }, { headers: NO_STORE })
```
- 기존 인증(401) · 보류(423) · 판본(409) · 원장 실패(503) 순서를 바꾸지 않는다. `judgment` 는 원장 커밋 뒤 같은 응답에만 실린다.
- provider 의 상태 매핑: 401/403→로그인 필요 · 409→판본 불일치 · 423→공개 보류 · 그 밖/네트워크→다시 시도 · `judgment` 없는 200→형식 오류(정답 없는 응답을 성공으로 만들지 않는다).
- 같은 문항 재시도는 같은 `clientExposureId` 를 보낸다(원장 멱등).

**AnalysisTheater.tsx** (판단 장면)
```tsx
import { TypeJudgment } from '@/components/csat/judgment/TypeJudgment'
import { judgmentRouteProvider } from '@/lib/csat/judgment/provider'
const judgmentReveal = useMemo(() => judgmentRouteProvider(slug), [slug])
{judgmentItem && <TypeJudgment item={judgmentItem} reveal={judgmentReveal} />}
```
- 도구는 자기 안에 원문 증거면 + 판단면(각자 스크롤)을 가진 두 면 레이아웃이다. 기존 장면의 문제지 · 강의 레일과 겹쳐 놓지 말고 **판단 장면 하나를 통째로** 차지하게 둔다.
- 도구는 `scrollIntoView` · 전역 keydown · 숙달/기록 API · analytics 를 쓰지 않는다. 강의 진행이 도구 안 선택 · 스크롤을 바꾸는 경로를 만들지 않는다(owner 의 학습자 제어 계약과 같다).

## 4. 유형별 연결 준비도 (2026-10-24 DB 실측)

판본이 결속된 문항 = 최신 published 분석에 `units_version` 이 있고 같은 판본 · 해시의 `csat_item_units` 가 있는 문항.

| 유형 | 도구 | 단계 | 결속 문항(전체) | 수능 · 모평 결속 | 비고 |
|---|---|---|---|---|---|
| R-IRRELEVANT | IrrelevantTool | **first** | 104 (132) | 0 · 0 | 첫 제품 연결 후보 |
| R-ORDER | OrderTool | isolated | 205 (262) | 0 · 0 | P1-02 수정(문장 안 대명사) 뒤 재검증 필요 |
| R-NOTICE | InfoMatchTool | isolated | 208 (265) | 0 · 0 | |
| R-FACT | InfoMatchTool | isolated | 103 (131) | 0 · 0 | |
| R-GRAMMAR | GrammarTool | isolated | 99 (129) | 0 · 0 | DB 선지 문자열 절단 결함 — 도구는 원문 ①~⑤ 위치로 우회. DB 수정은 별도 SQL 승인 전 실행 안 함 |
| R-SUMMARY | SummaryTool | isolated | 101 (130) | 0 · 0 | 픽스처 1문항 |
| R-MOOD | MoodTool | isolated | 104 (132) | 0 · 0 | |
| X-FACT · X-ORDER | (없음) | — | 104 · 104 | 0 · 0 | 장문 범위 실물 격리 검증 전 연결 안 함 |
| R-CHART · 듣기 | (없음) | — | — | — | 증거 부족 — 만들지 않는다 |

**핵심 공백:** 결속 문항은 전부 학평이다. 수능 · 모평 문항에는 단위 판본이 묶인 published 분석이 0건이라, 그 문항 페이지에서는 `loadJudgmentItem` 이 `unavailable` 을 내고 도구가 나타나지 않는다(의도된 동작 — 근거 없는 도구를 띄우지 않는다). 수능 · 모평 연결은 분석 단위 결속 드레인(콘텐츠 작업)이 먼저다.

## 5. 검증 상태

| 항목 | 상태 |
|---|---|
| 서버 로더 ↔ 개발 DB(읽기 전용) 13문항 7유형 | PASS — 로더 결과가 커밋된 픽스처와 동일(`server.live.test.ts`, 명시 실행) |
| provider 상태 매핑 · 멱등 키 · 비보안 컨텍스트 uuid | PASS(단위) · 격리 브라우저 `bridge-irrelevant` |
| 같은 인스턴스 문항 교체 · 늦은 응답 · 접근성 이름 · 근거 링크 44px | PASS(격리 `swap`, 5개 도구) |
| 실제 페이지 · 라우트 · AnalysisTheater 연결 | **BLOCKED** — owner(csat-lecture-disclosure) 적용 대기. `judgment/route.ts` 는 아직 main 에 없다(owner 브랜치 `feat/lecture-learner-control`) |
| 실계정 인증 E2E | **BLOCKED** — 위 연결 전에는 대상 화면이 없다 |
| 서버 정답 공개 계약 | owner(T-0140 · T-0147) 책임 — D 는 검증했다고 주장하지 않는다 |
