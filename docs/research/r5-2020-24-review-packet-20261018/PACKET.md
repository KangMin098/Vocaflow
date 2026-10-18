# R5 `r.central_meaning` 첫 자료 사람 검수 패킷 — 2020#24(전이)

> 사람 검수자가 **한 번에** 결정하도록 모은 문서다. 선행 근거 [factory-i2-r5-qualification-20261017/PACKET.md](../factory-i2-r5-qualification-20261017/PACKET.md) · [ACCEPTANCE.md](../factory-i2-r5-qualification-20261017/ACCEPTANCE.md) · [evidence.json](../factory-i2-r5-qualification-20261017/evidence.json)을 다시 만들지 않고 재검증만 했다.
> 개발 DB는 SELECT만 했다(측정 DB 시각 `2026-10-17T17:00:37Z`). 쓰기 · migration · 자격/승인/납품 행 0. 원문 · PDF는 싣지 않는다(평가원 저작물).
> 작성: Claude Code(AI). **E · F는 AI가 PASS로 표시하지 않는다.**

## 0. 결론

**BLOCKED_EVIDENCE — 사람 E(Gold) · F(권리) 결정 전까지.**

| 축 | 상태 | 이번 변화 |
|---|---|---|
| A 원천 | PASS | 재검증 · 변동 없음 |
| B 의미 | PASS(AI 한정 · 사람 0) | 변동 없음 |
| C TASK 수행 | UNKNOWN → **VERIFIED_ISOLATED** | 실제 채점기 · 기록 경로를 격리 실행(§6). 원장 PASS 아님 |
| H 실행 | UNKNOWN → **VERIFIED_ISOLATED** | 같은 시험. 원장 PASS 아님 |
| E Gold | UNKNOWN | §7 양식 — 사람만 |
| F 권리 | UNKNOWN | §8 양식 — 사람만 |

VERIFIED_ISOLATED는 「코드 경로가 이 문항 주석으로 기대대로 채점 · 기록한다」는 뜻이다. 선행 패킷 §2대로 원장의 C/H PASS에는 **노출 원장에서 분리된 검수 계정의 실제 실행 1건 + 산출물 보존**이 따로 필요하다.

## 1. 원천 · revision (재검증 · drift 없음)

| 칸 | 현재 값 | 선행 패킷 | drift |
|---|---|---|---|
| 문항 | `2020#24` · R-TITLE · kice suneung 2020 짝수형 · 정답 ② | 같음 | 없음 |
| artifact_revision `sha256(stem\|passage\|choices\|answer)` | `665745b76f720932afd513e9242ed756be6c1d546f5c4d7de054aea824d3a8e8` | 같음 | 없음 |
| passage sha256 | `742cad64ab964a6aeaf6b35fc89ba91d91e31ef73333dae7975ccbe3f3c4e72c` | 같음 | 없음 |
| source_hash(공식 문제지 PDF, 사용자 로컬) | `d629652b…1c66` | — | 이번에 PDF 재계산 안 함(로컬 파일) |
| 정답표 sha256 | `141d60da…11d9` | — | 재계산 안 함 |
| analysis v4 내용 해시 | `3aa5023f451e1a9f1edd520f9b888a2179e1e4f4d5af79ecba4b77e3ad965974` (units_hash null) | 같음 | 없음. v3=v2 `16eb8e6f…19fe`, v1 `00fa7423…28d1` |
| annotation_ref | `claim-support-2020-24.v1` | 같음 | 없음 |
| annotation_hash `sha256(JSON.stringify(주석))` | `72c534f8543a48f0212a842c4943589a3662d4f5449e0bee92eb51112ac02441` | 같음 | 없음(`current-annotation-manifest.mts` 실행 결과) |
| 주석 파일 sha256 | `7e90b2b2abcc7c5b65717c39364d6eb4bfe7a1ff4eb7f813354efa1c65adeeae` · 마지막 변경 `d79a56cbb` | 같음 | 없음 |
| skeletonSig · 문장 수 | `6b2493db6e785ee2995570d57a1da0b162f5210ee48021e1b223dd82fb1b4983` · 6 | 같음 | 없음(지금 골격에서 `currentItemTask` 살아 있음) |
| 출시 | `claim-support:2020-24` active v1 · audience.role=transfer · B7 승인 | 같음 | 없음 |
| 같은 지문 다른 문항 | 0 | 0 | 없음 |
| 노출 | 시도 0 · 세션 0 · dx 0 | 0 | 없음(시점 관찰 — 연습 화면 전이 구간에 열려 있음은 그대로) |
| 원장 테이블 | content_qualification · content_release_approval · factory_order · workspace_content_delivery 모두 **미설치** | 미설치 | 없음 |

## 2. TASK 적합성 — 문장별 주장/근거 구조

주석 번호는 0부터, v4 해설(`answer_locus.passage_design.roles`)은 1부터 센다. 둘은 같은 구조를 가리킨다.

| 문장(0기준) | 주석 역할 | v4 역할 | 내용 요지(원문 아님) |
|---|---|---|---|
| 0 | supportDisputed(채점 제외) | background | 외래종 침입이라는 문제 도입 |
| 1 | supportDisputed(채점 제외) | background | 생물다양성 손실과의 관계 |
| **2** | **claim** · 정답 근거 앵커와 같음 | topic | 이름 붙은 가설: 다양성이 높을수록 군집이 침입되기 어렵다 |
| 3 | support | support | 실험 결과: 다양성과 침입 성공의 음의 관계 |
| 4 | support · **relationProbe = reason** | support | 기제: 빈 지위 감소 · 자원 이용 |
| 5 | support | support | 안정성으로 같은 방향 보강 |

R5 과제(「글의 핵심 잡기」를 다른 글에 적용)에 맞는 이유: 명제 문장이 하나로 분명하고, 뒷받침 세 문장이 모두 같은 방향이며, 반론 문장이 없다. 쟁점은 0·1(배경을 근거로 볼지)뿐이고 채점에서 뺐다.

## 3. 교수 설명 (기존 자산 연결)

- 발행 해설 v4(`csat_item_analyses`, item `2020#24`, version 4): 측정 능력 = 「이름 붙은 가설 인용 문장이 명제 자리임을 알아보고 뒤 기제 나열이 그것을 뒷받침함을 확인」. 풀이 절차 = 가설 문장 밑줄 → 인과 방향 화살표 → 부호어(decreased · negative 등)를 뗀 선지 제거.
- 출제 의도: 근거 문장에 부정 · 비교 낱말이 있어 부호 없이 옮기면 반대 제목이 된다 — 전이 과제에서 「근거를 주장으로 착각」하는 오답과 같은 함정.
- 「내 말로 이해하기」 콘텐츠: 저장소 · 문서에서 **찾지 못했다**(`git grep` 0건). 없음으로 둔다.
- D(교수)는 전이 역할 필수 축이 아니다.

## 4. 채점 루브릭 초안 — **AI DRAFT · 사람 Gold 필요**

현재 채점기(`gradeClaimSupport`)는 이진(정/오)이고 축별 요약(claim · support · relation)만 남긴다. 아래는 사람 Gold에서 확정할 **제안**이다.

| 등급 | 조건(제안) | 현재 채점기 결과 |
|---|---|---|
| full | 주장=2 · 근거={3,4,5}(0·1 추가 허용) · 문장4 관계=reason | isCorrect=true |
| partial | 주장=2 이고 (근거 하나 누락 또는 관계 오답) | isCorrect=false · claim=true |
| hold(사람 판단) | 주장=2 · 근거에 0 또는 1만 추가하고 3·4·5 중 누락 있음 / 주장 다시 말한 문장 선택(이 문항은 claimRestated 없음) | isCorrect=false |
| wrong | 주장≠2 | isCorrect=false · claim=false |

결정할 것: ① 0·1 쟁점 문장을 Gold에서 그대로 제외할지 ② partial을 점수로 기록할지(지금 스키마는 isCorrect만) ③ 관계 reason만 정답인지(example 허용 여부).

## 5. 독립 확인 vs 새 지문 전이 후보 (현재 출시 행 · 읽기 전용)

전이 역할(`audience.role=transfer`)로 active인 claim-support 출시: `M2609-23` · **`2020-24`** · `2021-24` · `2026-23`(evidence-locate 전이 4건은 draft). 확인 묶음(20번 문항들)과 지문이 겹치지 않는다(같은 지문 0).

| 후보 | 비교 |
|---|---|
| 2020#24 | 6문장 · 주장 1(앵커 일치) · 쟁점 2 · 노출 0 |
| 2021#24 | 10문장 · 주장 0 · 근거 8 · 쟁점 없음 · 노출 0 — 대안(A 동일 수준, 나머지 축 같음) |
| 2026#23 · M2609#23 | 연습 화면 전이 구간에서 합성 계정 노출 기록 있음(선행 evidence.json) → 첫 후보로 부적합 |

2020#24가 짧고 구조가 단순해 첫 Gold 비용이 가장 낮다.

## 6. C/H 증거 — VERIFIED_ISOLATED

시험: [`apps/web/src/lib/csat/map/v62/__tests__/r5-2020-24-ch-isolated.test.ts`](../../../apps/web/src/lib/csat/map/v62/__tests__/r5-2020-24-ch-isolated.test.ts) — `pnpm exec vitest run` **11/11 통과**(2026-10-18).
실제 주석 · 실제 구운 골격 · 실제 `item-tasks` 레지스트리 · 실제 `recordItemTaskAttempt`. DB는 가짜 클라이언트(출시 행 · 사슬만 흉내), 기록기는 메모리. DB 쓰기 0.

| 확인 | 결과 |
|---|---|
| 결속 | ref · hash `72c534f8…2441` · sig · 6문장 일치, `currentItemTask` 살아 있음 |
| 정답 `{2,[3,4,5],reason}` | isCorrect=true |
| 쟁점 0·1 추가 | 감점 없음 |
| 부분(근거 5 누락 / 관계 example) | isCorrect=false, 축 요약이 갈림 |
| 오답(주장 0) | isCorrect=false · supportExtra=[2] |
| 입력 거절(범위 밖 · 중복 · 빈 근거 · 모르는 관계) | 기록 전 거절 |
| 기록 payload | `phase=transfer` · `activity=theater` · `contentHash=72c534f8…2441` · `taskKey=claim-support` · `extra.annotation=claim-support-2020-24.v1` · 응답 근거 정렬 · synthetic=false |
| 역할 의존 | transfer가 아닌 audience면 phase=practice |

한계: 출시 사슬 · 원장은 가짜다. 실제 DB 쓰기 경로(g2 RPC)와 노출 분리 표지는 검증하지 않았다.

## 7. E 사람 Gold 결정 양식 (사람만 기입)

| 칸 | 기입 |
|---|---|
| Gold 키 | 주장 = ___ · 근거 = ___ · 채점 제외 = ___ · 문장 ___ 관계 = ___ |
| 근거 위치 | 문장 번호(주석 0부터 · 해설 v4 1부터 — §2 대응표) 주장 ___ · 근거 ___ |
| 원문 revision/hash 확인 | artifact_revision `665745b7…a8e8` · 주석 `claim-support-2020-24.v1` / `72c534f8…2441` 와 검토한 원문이 같음 ☐ |
| 루브릭 | §4 초안 채택 / 수정(내용: ___) |
| gold_revision | 제안 표기 `claim-support-2020-24.gold.v1` |
| gold_hash 계산 | Gold 키+루브릭을 JSON 파일(키 순서 고정)로 저장 → `sha256(JSON.stringify(gold))`(주석 hash와 같은 공식). 주석 v1과 같다면 annotation_hash를 그대로 인용하고 「주석 v1 승인」으로 적는다. 다르면 주석 v2를 만들고 출시 행 · 주석 결속을 다시 한다 |
| 검수자 | ___ (사람 1) · 2차 승인자 ___ (에이전트 가능) |
| 날짜 | ___ |
| 판정 사유 | ___ |
| 결정 | PASS / FAIL / HOLD |

## 8. F 사람 권리 결정 양식 (사람만 기입)

| 칸 | 기입 |
|---|---|
| 원천 | 한국교육과정평가원 2020학년도 대학수학능력시험 영어 짝수형 24번 |
| 범위 | 2020학년도 수능 영어 짝수형 24번(지문 · 선지) |
| 목적 | 교육 · 전이 연습 / 평가(assessment) 사용 여부 ___ |
| 원문 노출 | 학습자 화면에 원문 표시 ___ (현재 설계: 문장 지도만 · `csat_items_public` passage 없음) |
| 평가 사용 | 점수 · 진단에 쓰는지 ___ |
| 근거 문서 | ___ (예: 평가원 저작물 이용 안내 · 법률 검토) |
| 제한 조건 | ___ (예: 원문 비표시 · 비상업 · 출처 표기) |
| 판정 사유 | ___ |
| 판단자 · 날짜 | ___ |
| 결정 | PASS / FAIL / HOLD |

노출 축소 설계와 PDF 보유는 허락 기록이 아니다(선행 패킷 §2 F).

## 9. 서명 뒤 가능해지는 것

| 서명 | 가능해지는 것 | 여전히 남는 것 |
|---|---|---|
| E만 | gold_revision/hash로 C 원장 E pass 기록 **입력값** 준비 | F · 원장 미설치 · C/H 분리 실행 |
| F만 | F pass 입력값 준비 | E 없으면 승인 불가(C SQL이 거절) |
| E+F | 분리 검수 계정 실행 1건(C · H 원장 근거) → 원장 설치(C→B→I1-S→주석 결속 v2, 사용자 SQL 승인) → `content_qualification_record` → `content_release_approve(public, assessment)` | 연습 화면 전이 구간 제외(결함 B) · `supplyFor` 상수 true 제거 · `delivery_id` |

## 10. 하지 않은 것

자격 · 승인 · 납품 · 시도 쓰기, migration, git add/commit, 원문 · PDF 수록, E/F PASS 표시.
