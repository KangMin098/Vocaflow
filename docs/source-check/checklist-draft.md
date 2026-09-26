# 보관 판정 체크리스트 — v7 채택(비논문 원천)

> **기준 정본은 [criteria.md](./criteria.md) v7 이다.** 이 파일은 그 §3-6 **체크리스트 경로**의 질문지다 — 종합 판정 「보관할까」를
> 질문으로 쪼개고, 보관 여부는 **판정자가 아니라 규칙**(`scripts/csat/checklist-exp/decide.mjs`)이 계산한다.
> **쓰는 곳: 논문 원천을 뺀 원천만**(criteria §3-6). 규칙이 `keep` 이라 한 것만 확정하고 나머지는 전문 판정으로 간다 · 배치마다 5% 무작위 전문 재판정.
> 질문마다 근거가 된 criteria.md 절을 적었다. 질문 뜻이 criteria.md 와 어긋나 보이면 criteria.md 를 따르고 `note` 에 적는다.
> 실측: `docs/reports/checklist-exp-20260926.md`.
>
> v7 에서 기준이 정한 두 자리(판정자가 `gap` 으로 갈리던 곳):
> - 운율을 맞춘 **아동 그림책·동시는 Q1 `blocked` 가 아니다**(`poetry-drama` 는 성인 대상 시·희곡만) — 다른 질문을 산문과 똑같이 답한다(criteria §5 `verse-children`).
> - **Wikinews Shorts(단신 모음)** 는 수집 단계에서 꼭지별로 쪼갠다. 쪼개기 전 모음 행이 오면 Q1 `mixed` 로 막지 말고 Q14 `gap` 에 「단신 모음」이라 적는다(criteria §8).

## 답하는 법

- **본문 전문을 처음부터 끝까지 읽는다**(criteria §2). 제목만·앞부분만 보고 답하지 않는다.
- 각 질문에 `true` / `false` 로만 답한다(`blocked` 는 장르 이름 또는 `null`, `linkage` 는 세 값 중 하나). 망설여지면 그 질문에서 더 보수적인 쪽(아래 「망설이면」)을 고른다.
- **보관·폐기를 답하지 않는다.** 종합 판단은 규칙이 한다. 질문에 없는 이유로 결론이 달라질 것 같으면 Q14 에 적는다.
- 가공 질문(Q9–Q11)은 criteria §3-2 대로 **문단 하나를 골라 실제로 해 본다.** `sample` 에 그 문단 첫 여섯 낱말을 적는다.

## 질문

| # | 키 | 질문 | 망설이면 | 근거 |
|---|---|---|---|---|
| Q1 | `blocked` | 차단 장르 9종 중 하나인가 — 값은 장르 이름 또는 `null` | `null` | §5 |
| Q2 | `needsVisual` | 그림·지도·표·화면 조작을 봐야 뜻이 서는가(캡션·포스터 해설·「화살표를 누르라」) | `false` | §5 fragmentary |
| Q3 | `truncated` | 글이 **중간에서 끊겼나** — 목록 머리만 있고 목록이 없다 · 문장 도중 끝 · 예고한 절이 통째로 없다. 짧거나 도입부뿐인 것은 `false` | `false` | §3-5 |
| Q4 | `listOnly` | 본문 대부분이 목록·주소·링크·편성표·참고문헌·수치 나열이고, 그 앞뒤에 권유·설명의 까닭이 서지 않는가 | `false` | §3-2 · §5 reference |
| Q5 | `linkage` | 문장끼리 **원인·결과·반응·다음 절차·이유·순서**로 이어지는 정도 — `strong`: 그런 연결이 둘 이상이고 글이 한 흐름으로 간다 · `thin`: 연결이 **하나뿐**이고 나머지는 수치·이름·일정만 바뀐 되풀이이거나 특징 나열이다 · `none`: 연결이 없다(수치만 되풀이 · 무관한 특징 나열 · 요일·색 이름만 차례로 대기) | `strong`↔`thin` 이면 `thin` | §3-2 초등 최소선 · 짧은 사실 단신 |
| Q6 | `mainPoint` | 글 전체(또는 떼어 낼 문단)의 요지를 한 문장으로 말할 수 있는가 | `false` | §6 argument |
| Q7 | `narrative` | 사건·절차가 시간순으로 이어지는 이야기·전기·절차인가 | `false` | §6 sequence |
| Q8 | `notice` | 누가 · 누구에게 · 무엇을 하라고(참여·신청·이용·주의) 알리는 글이 한 편 안에서 서는가 | `false` | §3-2 기관 공지문 |
| Q9 | `detachable` | 고른 문단을 떼어 냈을 때 앞 문맥 없이 시작하는가(지시어·앞 장 참조를 걷어 낼 수 있으면 `true`) | `false` | §3-2 |
| Q10 | `standsAlone` | 그 문단에서 고유명사·인용·수치를 걷어도 논지 또는 사건이 서는가 | `false` | §3-2 |
| Q11 | `vocabAdjustable` | 어려운 낱말 2~3개를 실제로 바꿔 보면 어느 학습 밴드(V0–V11)로 내려오는가 | `false` | §3-2 |
| Q12 | `factsMany` | 확인 가능한 사실 진술이 셋 이상이고, 그 사실들이 한 사건·주제로 묶이는가 | `false` | §6 factual · §3-2 |
| Q13 | `stereotypeCore` | 외모·인종·성별 고정관념이 글의 **요지나 결말**인가(한두 구절에 그치면 `false`) | `false` | §8 |
| Q15 | `strippedRemains` | 본문에서 수치·이름(사람·단체·지명)·날짜·순위를 걷어 내도 **내용 있는 문장이 둘 이상** 남는가(「올랐다」「발표했다」 한마디만 남으면 `false`) | `true` | §3-2 칸 하나만 수치 나열 |
| Q14 | `gap` | 위 질문들로는 담기지 않는 이유로 이 원천의 보관이 갈릴 것 같은가 — `true` 면 `note` 에 그 이유 | `false` | §3-5 criteria-gap |

## 출력 한 편

```json
{ "id": "…", "answers": { "blocked": null, "needsVisual": false, "truncated": false, "listOnly": false, "linkage": "strong", "strippedRemains": true,
  "mainPoint": true, "narrative": false, "notice": false, "detachable": true, "standsAlone": true, "vocabAdjustable": true,
  "factsMany": true, "stereotypeCore": false, "gap": false }, "sample": "첫 여섯 낱말", "note": "한국어 한 문장" }
```

## 규칙 (요약 — 정본은 코드)

1. `blocked` 또는 `stereotypeCore` 또는 `needsVisual` → `discard`
2. `truncated` → `hold`(`incomplete-source`)
3. 채울 칸 = `mainPoint` ∨ `narrative` ∨ `notice` ∨ `factsMany`. 칸이 없거나 `listOnly` 이면서 `mainPoint`·`narrative`·`notice` 가 모두 없으면 → `discard`
4. `linkage` 가 `none` → `discard`(수치만 되풀이되는 단신 · 무관한 특징 나열)
5. `linkage` 가 `strong` 이 아니고 `strippedRemains` 도 아니면 → `discard`(칸 하나만 수치 나열)
6. 가공 셋(`detachable` · `standsAlone` · `vocabAdjustable`)이 모두 안 되면 → `discard`
7. `linkage` 가 `thin` → `hold`(`borderline`)
8. `gap` → `hold`(`criteria-gap`)
9. 나머지 → `keep`

## 판 기록

- **v1**(2026-09-26 첫 측정 200편): Q5 가 예/아니요 `linked`(망설이면 true). 폐기 재현율 48.3% — 판정자가 note 에 「연결이 가늘다」 라고
  적은 경계선 단신 22건이 true 로 접혔다. `docs/reports/checklist-exp-20260926.md`.
- **v2**: Q5 를 세 값 `linkage` 로, Q15 `strippedRemains` 추가. 첫 200편을 뺀 새 표본으로 잰다(같은 표본에 다시 대면 과적합).
