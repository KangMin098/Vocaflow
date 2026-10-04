# rev4 재검증 — 사전 등록 (2026-10-05 · 사례 작성 · 실행 전에 고정)

> 대상 코드북: [CODEBOOK.rev4.md](./CODEBOOK.rev4.md) `f72c37c58407`(초안). 변경: [REV4_CHANGES.md](./REV4_CHANGES.md). rev4 는 이 재검증을 통과하기 전까지 candidate.
> 절차: 지난 회차와 같은 4중 blind(격리 · A1 · B1 · 사전 독립 판정 · 반대검증 · Final · 봉인) — [XMODEL_DRY_RUN.md](./XMODEL_DRY_RUN.md). 사람 검증 아님.

## 세트 — 따로 보고, 전체 평균으로 채택하지 않는다

| 세트 | 건 | 뜻 |
|---|---|---|
| Regression | 12 | 지난 회차 사례 중 rev4 가 바꾼 경계에 걸린 것 — C2-02 · C4-11 · H-13 · H-05 · C4-07(`V.wrong_sense ↔ R.inference`) · H-17 · N-04 · N-13 · N-14(V 세 코드 · multiword) · N-15 · H-04 · N-05(`multiple ↔ insufficient`) |
| Holdout | 7 | **새 사례**(지난 회차에 없던 문항) — `V.wrong_sense ↔ R.inference` 2(방향마다 1) · V 세 코드 3(unknown · wrong_sense · multiword 가 각각 기대) · `multiple_plausible ↔ insufficient_evidence` 2(방향마다 1) |
| Surveillance | 2 | 새 `S.attachment` 사례(해석에 부착 대상 오류가 직접 드러남) — pass/fail 에 넣지 않는다 |

## 기대 판정

- **Regression**: adjudication 에서 두 판정자가 같은 권장 기대를 낸 7건(C4-11 R.inference · H-13 V.wrong_sense · N-13 V.multiword · N-14 R.main_point · N-15 insufficient · H-04 R.relation · N-05 insufficient) + adjudication 대상이 아니었던 2건은 원래 기대(H-05 V.wrong_sense · C4-07 R.inference). 이 9건의 rev3 일치는 **7/9**(N-15 · N-05 미해결).
- 권장 기대가 갈린 3건(C2-02 · H-17 · N-04 — rev4 가 겨냥한 사례)은 정답 대신 **수렴**으로 본다: rev4 에서 `FINAL_VERIFIED` 이고 그 판정이 두 adjudicator 권장 중 하나.
- **Holdout · Surveillance**: 사례 작성 에이전트(새 context, 이 대화 밖)가 rev4 로 기대 판정을 쓰고, **실행 전에** sha256 으로 봉인해 이 문서 아래 「봉인 기록」에 적는다. 결과를 본 뒤 고치지 않는다.

## 채택 기준 — 변경점마다(하나라도 실패하면 그 변경은 candidate 로 남는다)

| 변경 | Holdout | Regression |
|---|---|---|
| R6 판정 단위(`V.wrong_sense ↔ R.inference`) | 그 경계 2건 모두 `FINAL_VERIFIED` + 기대와 같음(두 방향 모두) | C2-02 수렴 · C4-11 · H-13 · H-05 · C4-07 기대와 같음 |
| R12 V 세 코드 | 3건 모두 `FINAL_VERIFIED` + 기대와 같음 | H-17 · N-04 수렴 · N-13 기대와 같음 |
| §6 V vs S → R9 | 2건 모두 `FINAL_VERIFIED` + 기대와 같음(두 방향 모두) | N-15 · N-05 기대와 같음 |

- **퇴행 없음**: 기대가 정해진 Regression 9건의 일치가 rev3(7/9)보다 낮으면 rev4 전체 보류.
- 모델 합의가 holdout 기대와 다르면 그 사례는 다시 adjudication(같은 2단계)을 거친 뒤에만 판단한다 — 기대가 틀렸다는 adjudication 합의가 나오기 전에는 「실패」로 센다.
- **Surveillance**: 두 건 모두 다른 S 코드로 흡수되면 다음 개정에서 `S.attachment` 병합 · 하향 후보로 올린다(이번 채택과 무관).

## 하지 않는 것

rev3 · 지난 회차 봉인 자료 · 기대 판정 파일 수정, seed · DB · Pilot · Gold tagging · push/PR.

## 봉인 기록

(사례 작성 뒤, 실행 전에 채운다)
