# 03 정답·오답 설계 논리 평가 (E3 · U3 DISTRACTOR_FAILURE)

기계 판독본: [rubric/distractor-logic.json](./rubric/distractor-logic.json). 확인일 2026-10-24.

## 1. 분류는 새로 만들지 않는다 — 기존 trap-atlas 에 사상

이미 저장소에 오답 실패 분류 체계가 있다.

- 원천 데이터: DB `csat_item_analyses.choice_analysis[]` 의 `trap`(함정 이름) · `why_tempting` · `how_to_reject` (오답 선지별, 출제자·오답·학습자 3층위 분석의 오답 층위).
- 집계본: `D:/workspace/Vocaflow-main-serving/apps/web/src/lib/csat/trap-atlas.json` (생성기 `scripts/csat/build-trap-atlas.mjs`, built_at 2026-10-11). 802문항, 오답 2,680개, 그중 이름 붙은 것 2,232개, 서로 다른 이름 303가지.
- 해석 근거: `docs/CSAT_DESIGNER_MODEL.md` §4.0(「방향 반전」·「주제 아닌 세부」를 전수 검정한 결과 표지 기반으로는 기각), §6.12(오답은 정답보다 **지문**을 닮는다. 등급은 SOFT).

과제 예시로 나온 범주는 모두 atlas 키에 대응한다. 범위 과대 → `범위 과대`, 부분 진실 → `부분 사실`, 인과 역전 → `인과 역전`, 주제 밖 세부 → `무관`/`부분 사실`, 조건 오류 → `조건-귀결 절단`(위치형) 및 34번의 조건 한정, 매력적 어휘 일치 → `어휘 함정`/`어휘 반복 유인`. JSON 은 atlas 키마다 ASCII 코드를 하나씩 붙였을 뿐이다(예: `LEX_BAIT`=어휘 함정). 상위 18개 키 밖의 이름은 `OTHER_ATLAS:<원래 이름>` 으로 원문 그대로 둔다.

계열은 둘이다. **명제형**(빈칸·요지·주제 등: 어휘 함정 · 반대 진술 · 무관 · 부분 사실 · 지문 밖 상식 · 주체 역전 · 범위 과대/과소 · 인과 역전)과 **위치형**(삽입·순서·무관문장: 지시어 선행사 절단 · 첫 등장 위반 · 어휘 반복 유인 · 연결사 방향 충돌 …)이다. atlas 의 `by_type` 분포가 이렇게 갈린다. 화면에는 그 문항 유형 계열의 코드만 보여 준다.

## 2. U3 평가 방식

U3 는 "이 선지가 틀렸다"를 아는 것으로 성립하지 않는다. **어떤 조건에서 실패하는지**와 **그것을 반증하는 지문 위치**를 짚어야 한다.

선지마다 묻는 구조화 응답은 다음 셋이다.
1. 판정: 정답 또는 오답.
2. 실패 코드: 닫힌 목록에서 1~2개(목록은 6개 이상 보여 준다).
3. 반증 근거: 지문에서 문장 index 나 토큰 범위를 선택한다.

자유서술은 받을 수 있지만 채점하지 않는다.

**채점 (선지 단위)**

| 조건 | 점수 |
|---|---|
| 판정 정답, 코드가 expected 안에 있음, 근거 span 이 evidence 문장과 겹침 | 1.0 |
| 판정 정답, 코드와 span 중 하나만 맞음 | 0.5 |
| 판정만 맞음, 또는 판정 오류 | 0 |
| contested 선지(분석 버전마다 코드가 다름) | 코드는 채점하지 않고 span 만 본다(최대 0.5). 아니면 NOT_EVALUATED |

**문항 U3 통과(제안 문턱, 보정 전 UNVERIFIED_THRESHOLD)**: 검증된 오답 선지의 full 비율이 0.75 이상이고, 판정 오류가 0이며, 노출 등급이 X0/X1 이면서 INDEPENDENT_ELIGIBLE 이어야 한다.

**함정 처리**
- 기억으로 제거: 재노출(X2/X3)이거나 해설·강의 cue 를 본 뒤의 응답은 ASSISTED_ONLY 로 둔다. U3 로 올리지 않는다.
- 찍기: 코드를 우연히 맞힐 확률은 |expected| / |노출 코드 수| 다. span 을 필수로 받아 우연 일치를 억제한다. 모든 선지에 같은 코드를 고르는 응답은 플래그를 단다.
- 낱말 지름길: span 이 선지와 낱말만 겹치는 문장이고 evidence 와 다르면 상한을 partial 로 둔다. §6.12 는 오답이 지문 어휘를 닮게 설계된다고 본다.
- 클릭·펼치기·강의 시청은 점수를 만들지 않는다.
- expected 코드는 **AI 분석 라벨**이다. 정답(진리)으로 다루지 않는다. 아래에서 실측한 버전 표류가 그 이유다.

## 3. 사례 평가 명세 (DB SELECT 2026-10-24, version 1~5 대조)

### 2026-22 (요지, 정답 ①): verified = true
v1~v5 라벨이 모두 같다.

| 선지 | 기대 코드 | 반증 근거 |
|---|---|---|
| ① 정답 | — | 6·9·10번 처방(balancing act, pursue both) |
| ② | OUTSIDE_KNOWLEDGE (지문 밖 상식) | 4번 trust and confidence 는 관리의 이유다. 교육 계열 낱말이 없다 |
| ③ | PARTIAL_TRUE (부분 사실) | 7번 Often 은 진단이고 결론은 9번 처방이다. 단 선지와 7번 문장의 동일성은 NOT_VERIFIED(G1 CONFLICTS #10) |
| ④ | SCOPE_UNDER (범위 과소) | 3번 but potentially compete. 두 축 중 하나만 담았다 |
| ⑤ | LEX_BAIT (어휘 함정) | 8번 By necessity 가 꾸미는 것은 정보 공유(협력)다 |

### 2026-34 (빈칸, 정답 ③): verified = false
- ①만 v1~v5 가 일치한다(REVERSAL, 7·6번).
- ②: v1~4 는 어휘 함정, v5 는 주체 역전이다(1번 strong defender = Kant). G1 CC-02 에 따르면 분석은 진위를 unknown 으로 두었고, 강의는 거짓으로 단정했다. 미조치 상태다. → contested
- ④: 부분 사실 ↔ 반대 진술(5번 harmony). → contested
- ⑤: 무관 ↔ 어휘 함정(6번 이상적 법). → contested
- ③ 정답 근거는 6·7번 + If 조건 + Ideally 한정이다. 34번의 조건부 명제 판단(「부정어 뒤 빈칸 = 지문이 거부하는 견해」)을 다른 문항 규칙으로 일반화하지 않는다(CC-03).
- 현재 U3 채점 가능 범위: ①은 full, ②④⑤는 span 만.

### 2026-38 (문장 삽입, 정답 ⑤): verified = false
- ① FIRST_MENTION_VIOLATION: v1~v5 일치. [3] stories 와 [4] we routinely form narratives.
- ②: v1~4 는 「인과 연쇄 절단」(atlas 상위 키 밖), v5 는 어휘 반복 유인이다. → contested
- ③: v1~4 는 「예시-일반화 절단」(atlas 밖), v5 는 지시어 선행사 절단이다. → contested
- ④ REF_ANTECEDENT_CUT: 일치. [7] the university ← [6] a particular university.
- ⑤ 정답의 these 지시 범위(6~7 대 4~7)는 CC-01 로 미승인이다.
- 현재 채점 가능 범위: ①④는 full, ②③은 span 만.

세 문항의 구조가 다르다. 22는 결론 대 진단, 34는 부정 빈칸 속 조건 명제, 38은 지시·첫 등장이다. 그래서 공용 규칙은 형식(판정 + 코드 + span)만 둔다. 코드 계열과 근거 단위는 문항마다 따로 정한다.

## 4. 발견과 차단 사항

- **분석 버전 표류**: 34·38의 published 행이 v1~v5 다섯 개 있다. v5(2026-10-11)에서 오답 7개 중 5개의 trap 라벨이 바뀌었다. trap-atlas 가 어느 버전을 세는지는 이번에 확인하지 않았다(UNVERIFIED). 평가 기준으로 쓰기 전에 정본 버전 결정이 필요하다.
- 선지별 실제 선택률이 없다(DESIGNER_MODEL §6.12, EBSi 접근 차단). 코드별 난이도나 매력도 수치는 만들지 않았다.
- 효과 주장은 없다. 문턱 0.75 와 partial 0.5 는 학습자 데이터로 보정하기 전의 제안값이다.
