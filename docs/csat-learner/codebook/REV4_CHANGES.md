# Codebook rev4 초안 — 변경 내역 (2026-10-05)

> rev3([CODEBOOK.md](./CODEBOOK.md) `d19e04e8c70e`)는 그대로 둔다(지난 회차 재현 기준). 초안: [CODEBOOK.rev4.md](./CODEBOOK.rev4.md) `f72c37c58407`.
> 근거: [ADJUDICATION_RESULT.md](./ADJUDICATION_RESULT.md) — 사전 등록 rev4 조건 4 충족(`V.wrong_sense` 인접 경계 C2-02 · N-04). 채택은 subset 재-blind-run 통과 뒤(사전 등록 seed 조건 6).

## 고친 것 — 두 판정자가 함께 「규칙 약함」으로 본 경계 + rev4 조건을 건드린 경계만

| # | 바뀐 곳 | 무엇 | 근거 사례(adjudication) |
|---|---|---|---|
| 1 | §4-1 R6 | **판정 단위** 추가 — 학생이 한 낱말에 다른 사전 뜻을 넣었으면 낱말 단위(`V.wrong_sense`), 낱말 뜻은 맞는데 글쓴이가 만든 구절 비유를 잘못 옮겼으면 구절 단위(`R.inference`), 둘 다면 R3 순서 | C2-02(두 판정자 BOUNDARY_WEAK — 「R6 를 낱말에 적용할지 비유 전체에 적용할지 불명확」) |
| 2 | §4-1 R12(신설) · `V.unknown_word` · `V.wrong_sense` · `V.multiword` 제외 항목 · §6 | V 세 코드 tie-break — 채운 뜻이 사전 뜻이 아니면 확신도와 무관하게 unknown · 고정 표현 안 한 낱말의 다른 뜻은 multiword(표현이 단위) · 구별 증거 없으면 둘 다 최소 증거일 때만 multiple | N-04(두 판정자 BOUNDARY_WEAK — 「고정 표현 안 한 낱말의 다른 뜻 우선순위가 두 코드 정의에 없다」) · H-17(한 판정자 — 「추측으로 채움 vs 다른 확정 뜻」) |
| 3 | §6 V vs S | 「막힌 곳만 있으면 multiple(V · S)」를 R9 로 제한 — 특정 낱말 · 구조를 가리키고 두 후보가 각각 최소 증거일 때만 multiple, 문장 전체 표시뿐이면 insufficient | N-15(두 판정자 BOUNDARY_WEAK — 「§6 표가 R9 와 충돌」) |

## 고치지 않은 것 — 한 판정자만 지적(후보로 기록)

| 경계 | 지적 | 사례 |
|---|---|---|
| `R.reference ↔ R.relation` | 「some others」 같은 대조 집단 표현의 연결 오류 기준 | C3-15 |
| `B.outside_knowledge ↔ R.relation` | 관계 판단의 근거 출처가 글 밖일 때 Q5 우선과 B 중 무엇이 이기나 | C2-08 |
| `R.inference ↔ V.multiword` | §3 「결정적」 판정 검사 — 이른 단계 실패가 거의 맞는 방향일 때 | H-14 |
| `E.evidence_location ↔ E.option_mismatch` | 맞는 단락의 일부 문장에만 대응한 「불완전 대응」 | H-24 |
| `S.attachment ↔ S.core_structure` | 판정이 갈림 — CODE_REDUNDANT(Claude) / ITEM_BAD_CONSTRUCT(Codex). 감시 사례에서 attachment 판정 0건 | N-02 · N-01 |

S.attachment 는 rev4 조건 3 을 충족하지 않았다(합의 사례 없음) — 병합하지 않고 감시를 이어 간다. 다음 회차에 attachment 를 해석 증거로 직접 드러내는 사례가 필요하다(N-01 · N-05 ITEM_BAD_CONSTRUCT 합의).

## subset 재-blind-run 범위(채택 조건)

바뀐 경계를 겨냥했거나 adjudication 에서 그 경계로 분류된 사례 — C2-02 · N-04 · H-17 · N-15 + 말뭉치 겨냥 경계 `V.wrong_sense ↔ R.inference`(5) · `감시: V.multiword`(2) · `multiple_plausible ↔ insufficient_evidence`(4) 의 합집합. 같은 4중 절차(격리 · 반대검증 · Final · 봉인)로 rev4 를 써서 돌리고, 판정 기준은 adjudication 에서 두 판정자가 권장한 기대 판정(합의한 사례만)과 비교한다.
코드북 헤더의 원칙대로 **새 사례**도 함께 쓰는 것이 바람직하다 — 기존 사례만으로 통과하면 「이 사례들에 맞춘 규칙」일 수 있다.
