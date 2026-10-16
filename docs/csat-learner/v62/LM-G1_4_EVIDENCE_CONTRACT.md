# LM-G1.4 — 증거 자격 · 주장 범위 계약

> 수행 기록이 **어떤 교육적 주장까지** 지지하는지 정한다. 새 판정 엔진이 아니다. 기존 판정 결과만 조합한다.
> 구현: `apps/web/src/lib/csat/map/v62/evidence-claims.ts`(순수) → `composeV4().evidence` → 팝업 · 상세 서랍 · Workspace 창(`EvidenceClaims.tsx`).
> DB · RPC · RLS 변경 없음. 원장은 읽기만 한다.

## 1. 증거 층(섞지 않는다)

| 층 | 뜻 | 근거 | 이것만으로 말하지 않는 것 |
|---|---|---|---|
| A 수행 사실 | 원장 행(과제 키 · 문항 · 단계 · 서버 수신) | `learning_task_attempts.received_at` | 링크 클릭 · 해설 열람은 수행이 아님 |
| B 조건 성공 | 그 과제 조건(claim-support: 주장 · 근거 · 관계)을 그 주석 기준으로 맞힘 | `is_correct` + `content_hash` = 현재 주석 해시 | TASK 전체 숙달 |
| C 독립 수행 | 적격 첫 시도(도움 · 해설 선노출 없음 · 시각 확실) | `isEligible`, prior-help | 불확실하면 승격하지 않고 보류 |
| D 전이 경험 | 서로 다른 정규 원문에 적용한 기록 | `transferDoneOf` · `passageIdentity` | 독립 적용 능력 |
| E 지연 유지 | 승인된 간격 · 도구로 다시 확인 | **없음 → NOT_ESTABLISHED** | 120일 만료 · resolved · 다음 날 재시도 |
| F 학습 효과 | 사전 · 사후 · 지연 설계 | **NOT_EVALUATED** | — |

## 2. 필드 상태

`CONFIRMED` · `UNKNOWN`(못 구함 · 옛 입력 · 순서 불확실) · `STALE`(과거 주석 해시) · `INELIGIBLE`(도움 · 해설 뒤 · 연습 화면 · 합성 표본) · `NOT_APPLICABLE`(첫 시도 아님 · 확인 단계 아님).
시도 하나의 주장은 가장 강한 것 하나다. `independent_check` 는 수행 · 정오 · 현재 주석 · 독립이 **모두 CONFIRMED** 일 때만 나온다. 루브릭 · 정책 버전은 원장에 열이 없어 항상 `UNKNOWN` 이고, 이것으로 새 수준을 주장하지 않는다.

`correct: CONFIRMED`는 정오가 기록됐다는 뜻이다. 오답도 독립 첫 관찰일 수 있으며 `outcome`의 맞힘/틀림을 구별한다. `condition_success`는 정답이고 현재 도구가 확인됐을 때만 가능하다. 원장 ID가 첫 시도 뷰의 `attempt_id`와 TASK·문항·phase까지 일치해야 첫 시도로 연결한다. 배열 정렬로 다시 선출하지 않는다.

독립성 판정 순서: 연습 화면이면 INELIGIBLE. 도움 · 해설 뒤가 확정이면 INELIGIBLE(자기 보고 `viewed_first` 포함). 그 다음 시각 불확실이면 UNKNOWN(보류). 도움 기록이 없어도 UNKNOWN(보류). 같은 과제 · 문항 · 단계의 두 번째 이후 시도는 독립 관찰이 아니다. 같은 지문의 다른 문항은 `sharedPassageGroups` 로 따로 알린다.

## 3. 화면의 네 값(하나의 숙달률로 합치지 않는다)

| 값 | 출처 | 표시 |
|---|---|---|
| 지금 확인 | skillDiagnosis `check.status` 그대로(unverified · verified · still_needed · resolved · expired) | 아직 확인 전 · 확인 중 · 연습이 필요하다고 확인됨 · 다시 확인에서 아직 막힘 · 통과(지금 기준) · 기간 지나 다시 확인 필요 |
| 교수 경로 | `repairWindow` 안의 바로잡기 시도 · 적용 수행/계획 | 아직 없어요 · 해 봤어요 · 맞혀 봤어요 — 「익혔다는 뜻은 아니에요」 |
| 다른 글 적용 | 서로 다른 원문 수 / 계획량 | 해 봤어요 · n / m편 — 「혼자 적용할 수 있다는 판정은 아니에요」 · 요구 확정 뒤 계획 없음만 「준비 중」 |
| 시간 지나 다시 확인 | 고정 | 아직 근거 없음(기간 만료와 다른 것) |

근거가 없거나 보류인 것은 실패 · 부족으로 말하지 않는다(e2e V06 이 문구를 검사한다).

## 4. R5(claim-support) 도구 범위

- 관찰: 중심 주장 문장 고르기 · 근거 문장 고르기(정답 범위, 논쟁 문장 제외) · 표시한 문장과 주장의 관계.
- 관찰하지 않음: 원문 이해 전체 · 자유 요약/자기 설명 · 모든 선지 판단 · 다른 유형으로의 일반화 · R5 전체 숙달.
- 채점: 주석 정답 기준 자동 채점. 전문가 루브릭 검수(R3) 전 · `rubricVersion: null`.

## 5. 원장 계보 실측(2026-10-16 · 읽기 전용 SQL · 개발 DB)

| 표 | 행 | 합성 | 누락(해시 · 수신 · 도움 · 화면 · 세션 · 정오) |
|---|---|---|---|
| `learning_task_attempts`(claim-support) | 125 | 124 | 0 · 0 · 0 · 0 · 0 · 0 |
| `learning_first_attempts`(claim-support) | 121 | 120 | 도움 기록 누락 0 · 시각 불확실 0 · 도움 뒤 0 |

위 수치는 최초 작성자의 당시 snapshot이며 독립 검증의 현재 모집단 수치가 아니다. 합성 표시가 없는 1행도 실제 학생 실증으로 확정하지 않는다. 효과 표본으로 쓰지 않는다. 루브릭 · 정책 버전은 UNKNOWN이다. 연결 조회·첫 시도·수행 원장을 못 읽으면 `ledger: unknown`이고 정상0건과 구분한다. 집계 범위는 현재 연결된 과제의 기록이며 학습자의 모든 DB 기록을 뜻하지 않는다.

## 6. 재사용

- 원장 열: `attempt_id`/`id` · `content_hash` · `activity` · `help_level` · `synthetic` · `received_at`. 현재 도구 해시는 `currentItemTask`의 골격·선택 과제와 기존 `anchorGate`를 통과해야 부여한다. 연습/확인의 서로 다른 채점 key는 합치지 않는다. legacy boundary-only 원문 검증 범위는 유지하며 완전한 본문·전문가 타당도 검증으로 표현하지 않는다.
- 판정: `skillDiagnosis` · `isEligible` · prior-help(`timingUncertain`) · `repairWindow` · `transferDoneOf` · `transferPlanned` · `passageIdentity`.
- 목표는 증거 adapter의 입력이 아니다. 실제 서로 다른 목표 snapshot과 상위 compose 검증은 독립 I03을 따른다. E17 자기 동일성 검사만으로 제품 연결을 입증하지 않는다.

과거 asof에는 현재 도구 해시를 그때의 증명으로 재사용하지 않는다(UNKNOWN). 원장 정오는 보존한다. 이는 전체 DB·원문의 과거 버전 재생이나 기존 resolved/120일 정책 변경이 아니다. 최종 독립 판정은 [별도 원장](../../research/lm-g1-4-independent/ACCEPTANCE.md)을 따른다.
