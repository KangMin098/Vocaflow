# Factory I2 R5 첫 자료 자격 심사 패킷 — 2020#24 전이

> 근거 준비 문서다. **자격 · 승인 · 주문 · 납품 행은 만들지 않았다.** 개발 DB는 SELECT만 했고, migration은 적용하지 않았다. PR #280 · #281 파일과 기존 연구 봉인은 고치지 않았다.
> **독립 정정(2026-10-17)**: 제출 SQL의 기록 열만으로는 결속을 수용하지 않는다. 현재 파일은 독립 수정 v2다. 적용 순서는 C→B→I1-S→(선택 P)→주석 결속으로 바뀌었다. 현재 배포 등록부와의 공급/충족도 대조는 격리 검증했으나, 실제 배포 동기화 및 DB 적용은 승인하지 않았다. 최종 판정·잔여 차단은 [ACCEPTANCE](./ACCEPTANCE.md)를 따른다. 아래 7/7은 제출 당시 기록이다.
> 기준: main `edcfa5f95`(#277 병합 뒤) · 선행 감사 PR #281 head `b2edad0bc` · DB 측정 2026-10-17T09:49:47Z(첫 측정) · 10:03:48Z(최종 측정).
> 증거: [evidence.json](./evidence.json)(해시 · 일치 수만, 원문 없음) · 재현 [verify.mjs](../../../scripts/research/factory-i2-r5-qualification/verify.mjs) · [evidence.sql](../../../scripts/research/factory-i2-r5-qualification/evidence.sql).
> 공식 문제지 · 정답표 PDF는 사용자 로컬 파일(`Documents/영어/수능영어기출/수능기출`)이다. 이번에 웹에서 다시 받지 않았고 git에도 넣지 않았다.

## 0. 결론

**BLOCKED_EVIDENCE.** 2020#24는 원천 정체성(A)과 주석 의미(B)는 실제 근거로 확인된다. 그러나 전이 역할의 필수 축 중 **C · E · F · H 네 개가 unknown**이다. `fq_role_ok(transfer)` 기준으로 출시 · 평가 승인을 받을 수 없다. 원장(C/B) 9개 표도 아직 설치되지 않았다. **실제 I2 진입은 지금 불가능하다.**

| | 값 |
|---|---|
| FQ 축 | A **PASS** · B **PASS**(AI 한정) · C UNKNOWN · D UNKNOWN(전이 비필수) · E UNKNOWN · F UNKNOWN · G 공급 시점 판정 · H UNKNOWN |
| 전이 필수(A·B·C·E·F·H) 충족 | 2 / 6 |
| 사람 검수 | 0. 주석은 AI 맹검 2(원 출력 미보존) + 이 세션의 비맹검 확인 1 |
| 권리 기록 | 0. 문항 단위 이용 · 재배포 · 평가 사용 허락 기록 없음 |
| Gold | 0. `gold_revision` · `gold_hash`로 쓸 대상이 없음 |
| 현재 노출 | 2020#24 시도 0 · 세션 0 · 해설 0 · dx 0(10:03:48Z). **영구 보장이 아니다** — §3-B 참고 |

대안 2021#24도 A는 같은 수준으로 확인했다(문제지 3쪽 연속 일치 44/44 · 선택지 5/5 · 짝수형 정답 ③ 일치). 나머지 축 상태는 2020#24와 같다. 대상을 바꿔도 차단 원인은 그대로다.

## 1. 결속 값 (자격 행 후보)

| 칸 | 값 | 출처 |
|---|---|---|
| artifact_kind / ref | `csat_item` / `2020#24` | |
| artifact_revision | `665745b7…a8e8` | B 공식 `sha256(stem\|passage\|choices\|answer)`. #281 값과 같다 |
| source_revision | `kice:2020:suneung:짝수:24` (제안 표기) | `csat_exams.paper_form = 짝수` |
| source_hash | `d629652b…1c66` | 공식 문제지 `2020_영어_짝.pdf` sha256 |
| analysis_revision | `v4:3aa5023f…5974` (제안 표기) | 최신 published v4 내용 칸 해시(evidence.sql). `units_hash`는 null |
| annotation_ref / hash | `claim-support-2020-24.v1` / `72c534f8…2441` | `annotationHash` = `sha256(JSON.stringify(주석))`. 이 값은 시도 행의 `content_hash`에도 쓰인다. 파일 sha256은 `7e90b2b2…eeae` |
| skeletonSig | `6b2493db…4983` | 현재 구운 골격과 같다(문장 6) → 러너가 채점을 거부하지 않는다 |
| gold_revision / hash | **없음** | E unknown |
| task / role | `r.central_meaning` / `transfer` | 출시 행 `claim-support:2020-24` · `audience.role=transfer` · active · B7 승인 |
| evidence_ids | 주석 hash · 문제지 sha256 · 정답표 sha256 `141d60da…11d9` | |

## 2. FQ A~H

| 축 | 판정 | 근거 / 이유 | 남은 것 · 담당 |
|---|---|---|---|
| **A** 원천 | **PASS** | DB 지문이 공식 짝수형 문제지 3쪽 텍스트에 **연속으로** 들어 있다(8단어 창 39/39). 선택지 5/5. 정답표 짝수형 24번 ② = DB `answer 2`. 같은 지문 다른 문항 0. 시험 행 `kice · suneung · 2020 · 짝수` | 권리와 무관하다. A pass는 F를 대신하지 않는다 |
| **B** 의미 | **PASS — AI 한정** | 주석 키: 주장 2 · 근거 3·4·5 · 관계 4=reason · 0·1은 채점 제외. 이 세션에서 현재 DB 지문의 문장 단위로 다시 읽었고 모두 동의한다. 문장 2(Elton 가설: 다양성 → 침입 어려움)가 주장이다. 3(실험 · 음의 관계), 4(기제: 빈 지위 감소 · 자원 이용), 5(안정성)가 뒷받침한다. 정답 ②와 방향도 같다 | 원 맹검 2인의 출력이 보존되지 않아 맹검 여부를 다시 검증할 수 없다. 이 세션의 확인은 **비맹검**이다. 사람 확인은 0이다. 사람 검수를 붙이면 B를 재기록한다 · 담당: 큐레이터 |
| **C** TASK 수행 | UNKNOWN | R5 정의상 TASK 자산은 claim-support 하나다. 지문에 주장 · 근거 구조가 있다는 점은 B에서 확인했다. 그러나 이 문항에서 **TASK를 실제로 수행한 관찰 산출물**이 없다. 시도 0, 원 주석자 출력도 미보존이다. FQ: 유형 · 태그만으로 pass 불가 | 학습자 풀이 기록이 아닌 별도 검수 계정(노출 원장에서 분리)으로 수행 산출물 1건 이상, 또는 원 맹검 출력 재생성 · 보존 · 담당: 공장 검수 |
| D 교수 | UNKNOWN | 전이 역할에서는 필수가 아니다(`fq_role_ok`). 해설 v3/v4의 교수 적합성은 검수하지 않았다 | 전이에는 불필요. 같은 문항을 설명 · 연습 역할로 쓰려면 필요 |
| **E** 평가 Gold | UNKNOWN | 채점 키는 AI 주석이다. 사람 Gold와 부분 · 동등 · 보류 루브릭이 없다. `supportDisputed`(0·1) 처리 규칙은 final-v1에 있지만 사람 승인이 없다. C SQL은 E pass에 `gold_revision`·`gold_hash`를 요구한다(PGlite로 거절 확인) | 사람 Gold 1건(키 + 루브릭 + revision · hash) · 담당: 사람 검수자 1 + 에이전트 2차 승인자 |
| **F** 권리 | UNKNOWN | 문항 단위 권리 기록이 없다. 제품의 저작권 경계는 「원문을 싣지 않는다」는 **노출 축소 설계**다(CSAT_LEARNER_DELIVERY §5 · `csat_items_public`에 passage 없음). 이것은 이용 · 재배포 · 평가 사용 **허락 기록이 아니다**. 공식 문제지를 갖고 있다는 것도 재배포 권한이 아니다 | 평가원 기출의 교육 목적 이용 범위에 대한 권리 판단 기록(대상 · 범위 · 근거 문서 · 판단자) · 담당: 사용자(사람) — 에이전트가 만들 수 없다 |
| G 노출 | 공급 시점 | 콘텐츠 공통 자격이 아니다(`deliveryCheck`). 현재 0이다 | §3-B |
| **H** 실행 | UNKNOWN | 실행 경로는 있다: `api/csat/item/[slug]/task` → `recordItemTaskAttempt`(phase=transfer · activity=theater · content_hash=주석 hash), 연습 화면 전이 구간(phase=transfer · activity=practice). 주석 · 골격 서명도 일치한다. 그러나 **이 문항에서 실제로 실행된 기록이 0**이다. FQ는 정적 계약과 실제 실행 검증을 구별한다 | 노출 원장에서 분리한 검수 실행 1건(합성 계정 시도는 학습자 노출로 세지 않게 하는 규칙이 먼저) · 담당: 공장 검수 |

전이 역할 추가 조건(FQ1-ROLE-ELIGIBILITY): 다른 학습 본문 · 공유 · 정규화 동일 본문은 제외한다 → 같은 지문 0 ✔. 동일 수행 → claim-support 동일 ✔. 노출 · 힌트 · 평가 조건 → 아래 §3.

## 3. PR #281 결함 영향 (2020#24 기준)

| # | 결함 | 2020#24 I2 자격 · 납품을 **막는가** | 기존 실행 증거의 **해석만** 제한하는가 |
|---|---|---|---|
| A | 독립 확인이 `phase=practice`로 기록 | 막지 않는다. 2020#24는 전이라서 `phase=transfer`로 기록된다. 그리고 `activity`(theater / practice)로 출처는 구별된다(#281은 phase만 봤다 · 실측 `theater:practice` 130 · `practice:transfer` 2) | 확인 9문항의 G2 해석을 제한한다(phase만으로는 확인과 연습을 구별할 수 없다) |
| B | 지도 연습과 평가 자료가 같은 문항 | **막는다(노출 측면).** 연습 화면 `serverPool`은 TRANSFER_TYPES(R-TOPIC · R-TITLE)를 포함한다. 그래서 2020#24는 연습 화면 전이 구간에 **지금 열려 있다**. 실측: #281 측정(09:16Z) 뒤 다른 세션의 합성 계정이 그 구간에서 M2609#23 · 2026#23을 풀었다(10:03Z). 연습 화면 풀이는 `activity=practice`로 남는다. 노출로는 잡히지만, 도움 수준이 섞인 연습 풀이가 「전이 수행」으로 읽힐 수 있다 | 연습 화면 전이 시도를 독립 전이 증거로 쓰지 않는다 |
| C | 2026#23 복수 역할 출시 | 2020#24에는 해당하지 않는다(다른 TASK 출시 0) | 2026#23 전이 결과 해석 |
| D | B revision에 주석 hash 없음 | **막는다.** 주석이 바뀌어도 자격 행이 그대로 유효해진다. §4 결속안이 필요하다 | — |
| E | `supplyFor`가 확인 · 전이 자격을 상수 true로 표시 | I0 해결기와 C/B는 이 값을 쓰지 않는다 → 납품 자체는 막지 않는다. 다만 화면이 「검수됨」이라고 말하는 근거가 FQ가 아니다 | 진단 화면 문구의 근거 제한 · 첫 납품 전 고칠 것(§6) |
| F | 납품 ↔ G2 시도 연결 없음 | 첫 납품 **기록**은 막지 않는다. **I2 완료 판정**(납품된 자료의 결과 환류)은 막는다 | 기존 시도는 「스스로 연 것」과 구별할 수 없다 |

## 4. 주석 revision 결속 방안

C 원본 SQL에는 주석 hash 칸이 없다(`artifact_revision` = B revision만). 주석은 DB가 아니라 코드 파일이라 SQL이 hash를 스스로 계산하지 못한다.

| 안 | 방식 | 장점 | 단점 |
|---|---|---|---|
| **1(권장)** | `content_qualification.annotation_ref` · `annotation_hash` 칸 + CHECK(csat_item에서 B · C · E 중 pass가 있으면 둘 다 필수) + 정체성 색인에 포함 + 기록 함수 인자 추가(옛 서명 회수) | 명시적이다. 시도 행 `content_hash`와 같은 공식이라 G2와 바로 대조된다 | B 공급 함수에 `p_annotation_hash` 비교 delta가 추가로 필요하다 |
| 2 | 스키마 변경 없이 `artifact_revision = sha256(bRevision ':' annotationHash)`, 구성값은 `evidence_ids`에 기록 | 마이그레이션이 필요 없다 | 불투명하다. B의 `supply_artifact_revision('csat_item')`이 같은 합성을 계산하지 못해 납품 시 항상 `revision_mismatch` → B도 고쳐야 한다 |
| 3 | `artifact_kind = csat_item_task`, ref `claim-support:2020-24`, revision = 주석 hash | 과제 단위 정체성 | 원문 revision이 `source_*`로 밀려난다. CHECK 목록 · B 함수 모두 확장해야 한다 |

안 1 승인안: [`_pending_workspace_supply_c_annotation_binding.sql`](../../../supabase/migrations/_pending_workspace_supply_c_annotation_binding.sql)(**미적용**). PGlite 검증 [`supply-c-annotation-binding.pglite.test.ts`](../../../apps/web/src/lib/csat/map/v62/__tests__/supply-c-annotation-binding.pglite.test.ts) 7/7, 기존 C 시험 11/11 통과.
- 결속 없는 B pass는 거절된다. 64 hex가 아니면 거절된다. 옛 기록 서명은 남지 않는다.
- 2020#24 현재 판정을 기록하면 주석 · 원문 · B revision이 모두 남는다. 그 행의 public · assessment 승인은 **둘 다 거절**된다(`required axes not pass`).
- C · F · H를 채워도 E 없이는 승인이 불가하다. E pass에 Gold 결속이 없으면 기록이 거절된다.
- 제출본은 납품 비교를 후속 delta로 남겼다. **독립 수정 v2는 이 공백을 같은 승인안에서 보완**한다(현재 배포 등록부와 비교 · 정보 없음은 거절). 배포 소유자의 현재 주석 동기화는 아직 미승인이다.

## 5. 기존 수행 기록과 신규 납품의 정합성

- 2020#24의 기존 수행 기록은 **0**이다. 정합성을 깨뜨릴 과거 기록이 없다.
- 러너는 시도마다 `content_hash = annotationHash`, `application_id`, `phase=transfer`, `activity`를 남긴다. 그래서 안 1의 `annotation_hash`와 행 단위로 대조할 수 있다(주석이 바뀐 뒤의 시도는 다른 hash).
- 납품 id 칸이 없다(결함 F). 납품 뒤 시도가 「납품받아 푼 것」인지, 「연습 화면에서 스스로 연 것」인지는 `activity`로만 일부 구별된다. 연습 화면(`activity=practice`)이 같은 문항을 열어 두는 동안에는 납품 귀속이 불완전하다.
- 합성 계정 시도는 `synthetic=true`다. 노출 판정에서 합성 계정을 실제 학습자와 섞지 않는 것은 B delta D1 범위다.

## 6. 첫 납품까지 최소 변경

| 종류 | 변경 | 승인 |
|---|---|---|
| DB | C → B → I1-S → (선택 P) → 주석 결속 v2, 한 트랜잭션. I0 delta 제외. 배포 manifest와 현재 등록부 동기화는 별도 승인 | 사용자(SQL/hash/허용 객체 확인 뒤) · `/db-checkpoint` 앞뒤 |
| 코드 | ① 연습 화면 `serverPool`에서 `audience.role=transfer`로 출시된 문항 제외(또는 전이 구간 자체를 납품 경로로 대체) — 결함 B ② `supplyFor` 확인 · 전이 자격 상수 true 제거 → 원장 읽기(결함 E) ③ 시도 기록에 `delivery_id`(nullable) — 결함 F ④ 검수 실행 계정의 시도를 노출 · G2에서 분리하는 표지(C · H 근거용) | 코드 PR(I1 #280 병합 뒤 · 그 파일을 피해서) |
| 근거(사람) | F 권리 판단 기록 · E 사람 Gold 1건 · B 사람 확인(선택이지만 권장) | 사용자 · 사람 검수자 |
| 근거(공장) | C · H: 분리된 검수 실행 1건 + 산출물 보존 · 원 맹검 출력 재생성 · 보존 | 에이전트 가능 |

이 넷이 갖춰진 뒤에야 `content_qualification_record` → `content_release_approve(public, assessment)` → 해결기 `eligible_existing` → 납품 1행 순서가 성립한다(#281 §7 종단 검증).

## 7. 실제 I2 진입 가능 여부

**불가 — BLOCKED_EVIDENCE.**
- 기술 차단: C/B 원장 미설치 · 주석 결속 없음(§4 안 1 미승인).
- 근거 차단: F(권리 · 사람만 가능) · E(사람 Gold) · C · H(분리된 실제 수행 · 실행 기록) 4축 unknown.
- 운영 위험: 2020#24가 연습 화면 전이 구간에 열려 있다. 이 상태로는 첫 납품 전에 노출이 생길 수 있다. 실측으로 같은 구간의 다른 두 후보가 오늘 노출됐다.

## 8. 하지 않은 것

자격 · 승인 · 주문 · 납품 · 학생 기록 쓰기, 개발 DB migration 적용, `apply_migration`, PR #280 · #281 파일 수정, V2 등 기존 봉인 변경, 원문 · PDF · 이미지 커밋, 웹 재다운로드, 학습 효과 주장. 이 패킷의 PASS 두 개(A · B)는 **기록 후보**이며 자격 원장 행이 아니다.
