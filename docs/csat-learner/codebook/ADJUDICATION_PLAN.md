# Cross-Model Dry Run adjudication — 사전 등록 (2026-10-04 · 판정 전에 고정)

> 이 문서는 adjudication 결과를 보기 **전에** 커밋한다. 결과를 본 뒤 기준 · 문턱을 바꾸지 않는다(바꾸려면 새 회차).
> 대상 회차: [XMODEL_RESULT.md](./XMODEL_RESULT.md) `xm-20261004` · 최종 판정 봉인 `830ee7004b19`.

## 대상 — 26건

- 모델 최종 확정이 기대 판정과 다른 18건(허용 대안에 든 5건 포함) + UNRESOLVED 8건.
- 목록은 `XMODEL_RESULT.json` 의 `expected.models_agree_expected_differs` · `final_status=UNRESOLVED` 에서 기계적으로 뽑는다.

## 판정자 · 순서 — 모델 합의에 끌려가지 않게

판정자는 새 context 의 Claude(`claude-opus-5-5`)와 Codex(`gpt-6.1-sol`) 둘, 서로 독립(같은 격리 · 감사 · 봉인 규칙). 운영 세션(이 대화)은 모든 결과를 봤으므로 판정자가 아니다.

1. **1단계(독립 판정)**: 사례 원문 · 학생 과정 증거 · 코드북 rev3 · **기대 판정과 그 작성 근거**(true_mechanism · evidence_design · boundaries)만 보고 스스로 판정하고, 기대 판정이 증거로 지지되는지 평가한다. Claude/Codex 1차 · 반대검증 · Final 결과는 **보지 않는다**.
2. **2단계(분류)**: 새 context 에서 자기 1단계 판정 + 익명 모델 판정들(출처 · 단계 이름 없음) + 회차 최종 결과를 공개하고 adjudication 코드를 매긴다.

## adjudication 코드(8종)

| 코드 | 뜻 |
|---|---|
| `GOLD_WRONG` | 기대 판정 자체가 잘못됨 |
| `GOLD_UNDERSPECIFIED` | 기대 판정은 가능하지만 허용 대안 · 범위가 부족 |
| `ITEM_AMBIGUOUS` | 사례 자체가 두 코드 이상을 정당화 |
| `ITEM_BAD_CONSTRUCT` | 그 코드를 검사하려고 만든 사례가 실제로 그 구분을 잘 못 드러냄 |
| `CODEBOOK_BOUNDARY_WEAK` | 정의나 tie-break 규칙 부족 |
| `CODE_REDUNDANT` | 두 코드가 실제 판정에서 안정적으로 구분되지 않음 |
| `MODEL_SHARED_BIAS` | 규칙은 충분한데 두 모델이 같은 방향으로 오판 |
| `INSUFFICIENT_EVIDENCE` | 지금 자료만으로 adjudication 불가 |

- 사례마다 주 코드 1개 + 선택 부 코드 1개 + 관련 경계(예: `S.attachment ↔ S.core_structure`) + 권장 기대 판정(허용 대안 포함).
- `S.attachment` 는 `CODE_REDUNDANT` 가능성을 처음부터 열어 둔다(「규칙만 보완하면 구분된다」고 가정하지 않는다).
- 두 판정자의 주 코드가 다르면 그 사례는 「adjudication 불일치」로 따로 센다 — 운영자가 한쪽으로 정하지 않는다.

## rev4 를 만드는 조건(하나라도 충족 시)

판정자 **둘 다** 그 코드를 매긴 사례만 센다(한쪽만은 참고).

1. `CODEBOOK_BOUNDARY_WEAK` 가 **같은 경계에서 2건 이상**.
2. `identified ↔ multiple_plausible` 경계의 오분류가 **같은 이유로 2건 이상**(`CODEBOOK_BOUNDARY_WEAK` 또는 `MODEL_SHARED_BIAS` 가 그 경계로 2건 이상).
3. `S.attachment` 사례에서 `CODE_REDUNDANT` 또는 `CODEBOOK_BOUNDARY_WEAK` 가 1건 이상(감시 코드 — 인접 S 코드와 일관되게 분리되지 않음).
4. `R.relation` · `R.inference` · `V.wrong_sense` · `B.outside_knowledge` 가 걸린 사례에서 `CODEBOOK_BOUNDARY_WEAK` · `CODE_REDUNDANT` 가 합쳐 2건 이상.

반대로 대부분(26건 중 과반)이 `GOLD_WRONG` · `GOLD_UNDERSPECIFIED` · `ITEM_BAD_CONSTRUCT` 이고 위 조건이 하나도 없으면 rev3 를 유지한다.

## v0.1 seed 후보 조건(모두 충족)

1. UNRESOLVED = 0, 또는 남은 사례를 사유와 함께 명시적으로 제외.
2. 같은 코드 경계의 반복적 규칙 실패 없음(위 rev4 조건 1 · 2 · 3 · 4 가 하나도 충족되지 않음 — rev4 를 만들었다면 rev4 기준).
3. 모델-기대 불일치 중 `MODEL_SHARED_BIAS` 비율 ≤ 25%(18건 중 4건 이하) 이고 각 사례의 원인이 설명됨.
4. `identified / multiple_plausible` 경계에 재현 가능한 결정 규칙이 있음 — 그 경계 사례가 adjudication 에서 두 판정자 모두 같은 코드로 분류되고 `CODEBOOK_BOUNDARY_WEAK` 가 아님.
5. 허용 대안이 필요한 기대 판정(`GOLD_UNDERSPECIFIED`)은 기대 판정 스키마(accept)에 반영 — 새 회차 파일로, 지금 봉인 파일은 고치지 않는다.
6. 코드북을 고쳤다면(rev4) 바뀐 경계의 subset 을 새 blind run 으로 다시 돌려 통과.

## 하지 않는 것

이번 adjudication 에서 코드북 · 사례 · 봉인된 기대 판정을 고치지 않는다. 결과는 「rev4 필요 여부 · seed 후보 여부」 판정과 수정 제안까지. DB · seed · Pilot · Gold tagging · push/PR 없음.
