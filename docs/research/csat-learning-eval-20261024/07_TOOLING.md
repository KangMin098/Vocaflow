# 07 평가 보조 도구 (E7)

> 위치: `tool/` · 의존성 없음 · Node 20 · 네트워크·DB·제품 코드 접근 없음.
> 실행: `node --test tool/__tests__/*.test.mjs` (Windows 에서는 디렉터리 형태 `tool/__tests__/` 가 실패한다 — 파일 glob 을 쓴다).
> 이 도구가 내는 수준은 **SUGGESTION** 이다. 최종 판정은 평가자 판정과 불일치 검토(adjudication)로만 정한다.

## 명령

```
node tool/cli.mjs <명령> --in <records.json> [--rubric rubric/levels.json] [--map rubric/p6-exposure-map.json] [--out 파일]
```

| 명령 | 하는 일 | 출력 |
|---|---|---|
| `validate` | 판정 기록 스키마 검사 · 이메일/전화번호 형태 값 거부 · 숫자 수준 거부 · 누락은 UNKNOWN 경고 | errors / warnings |
| `score` | 근거 코드 → 수준 제안. E1 `min_evidence{all_of, any_of}` 적용 · 탐색 근거만 있으면 U0 상한 · U5 는 TRANSFER 단계 + 미학습 문항 + `transfer_eligibility_verified` 일 때만 | 기록·평가자별 SUGGESTION |
| `agree` | 두 평가자 일치율: 단순 일치율 · Cohen κ · 이차 가중 κ · Krippendorff α(서열, 결측 허용) · 시드 고정 부트스트랩 95% CI. UNKNOWN/NOT_EVALUATED 쌍은 **제외하고 제외 수를 보고** | 통계 + excluded |
| `disagree` | 수준 차 ≥1 또는 독립 자격 불일치 사례 + 근거 추적 | 사례 목록 |
| `review-html` | 불일치 검토용 단일 정적 HTML(서버 없음, 모든 값 이스케이프, 키보드 조작·보이는 focus). 판정은 JSON 으로 내려받는다 | HTML |
| `compare` | 학습자별 PRE → POST_INDEPENDENT → TRANSFER 짝 비교. 기본은 **독립 자격 기록만**. 결측은 UNKNOWN 으로 남기고 대체하지 않는다. SYNTHETIC 이 섞이면 배너 「SYNTHETIC — 학습 효과 근거 아님」, REAL 이 없으면 `effect_status: NOT_EVALUATED` | 전이표·경로별 집계 |
| `check` | 결측 보고 · 노출 수준 분포 · 문항/분석 버전 불일치 · 부여 코드가 응답 요소를 가리키는지(근거 추적) | 점검 보고 |

## 노출 지도

`exposure.mjs` 는 두 형식을 받는다.
- E7 형식: `{rules:[{id, match, level, precedence}]}`
- E5 형식(`rubric/p6-exposure-map.json`): `{precedence:[X3,X2,X_UNKNOWN,X1,X0], rules:[{id, when, exposure}]}` — `when` 의 키는 `attempt.exposure_order_at` 처럼 점 경로, 값 `null` 은 없음/NULL, `"not null"` 은 값 있음.

규칙이 있는데 하나도 해석하지 못하면 **오류를 낸다**. (통합 중 실측: 처음 구현은 E5 지도 12개 규칙을 형식 불일치로 전부 버리고 모든 시도를 조용히 X_UNKNOWN 으로 만들었다. 결과는 보수적이었지만 지도가 무시된 것을 알 수 없었다 — 회귀 테스트 `exposure(실제 E5 지도)` 가 막는다.)

## 수식과 출처

- Cohen κ = (p_o − p_e)/(1 − p_e). 모든 평정이 한 범주면 p_e = 1 → **값 null + 사유** (0 으로 두지 않는다). Cohen, J. (1960). *Educational and Psychological Measurement*, 20(1), 37–46.
- 가중 κ(이차 가중 w_ij = 1 − (i−j)²/(k−1)²). Cohen, J. (1968). *Psychological Bulletin*, 70(4), 213–220.
- Krippendorff α = 1 − D_o/D_e, 서열 거리. Krippendorff, K. (2004/2018). *Content Analysis* (Sage). 결측 칸이 있어도 계산된다.
- 부트스트랩: 단위(기록) 재표집, mulberry32 시드 PRNG 주입 — 같은 입력·시드면 같은 CI.
- 위 출처는 표준 문헌 표기를 기억으로 적었다(이번 작업에서 원문 대조 안 함).

## 한계 — 이 도구가 증명하지 않는 것

1. **AI 평가자끼리 일치해도 타당성이 아니다.** 같은 모델 계열은 같은 방향으로 틀린다. 일치율은 신뢰도(reliability)이고 정답성(validity)이 아니다. 최소 한 평가자는 사람이어야 하고, 타당성은 원문·정답 키 대조와 이의 검토로만 다룬다.
2. 수준 제안은 루브릭 코드의 존재만 본다. 코드를 붙이는 판단 자체의 오류는 `disagree` → 사람 검토로 잡는다.
3. 빈 `exposure_events: []` 는 「기록된 노출 없음」으로 처리해 INDEPENDENT_ELIGIBLE 이 될 수 있다. 실제 P6 데이터에서는 E5 규칙 R12(원장 0행 **그리고** 순서 시각 있음)를 거쳐야 X0 이다 — 실데이터 입력은 반드시 `--map rubric/p6-exposure-map.json` 과 함께 쓴다. 서버가 볼 수 없는 외부 노출은 어느 경우에도 판정하지 않는다(05 문서).
4. 합성 데이터셋(`__tests__/fixtures/synthetic-dataset.json`, 30건, 전부 SYNTHETIC)은 계산 로직 검증용이다. 여기서 나온 어떤 수치도 학습 효과·평가자 신뢰도의 근거가 아니다.

## 테스트

`tool/__tests__/agreement.test.mjs`(통계, 교과서 예제 손계산 대조) · `modules.test.mjs`(스키마 · 실제 E1 루브릭 all_of · 탐색 U0 상한 · U5 제한 · 실제 E5 지도 12규칙 · 이스케이프 · SYNTHETIC/NOT_EVALUATED · 결측 비대체 · CLI 7명령). 2026-10-24 실행: tests 20 · pass 20 · fail 0.
