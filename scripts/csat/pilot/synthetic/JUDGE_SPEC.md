# G6-S 판정 지시 (Claude · Codex 공통 — 서로의 판정을 보지 않는다)

입력: `.pilot-private/synthetic/packets/<pre|post>/<attempt>.json`(합성 학습자 · 비식별) · `.pilot-private/synthetic/codebook.json`(v0.1 코드 정의 · 포함 · 제외 기준).
출력: 지시받은 파일 하나에 JSON 배열 — attempt 마다 한 객체:

```json
{ "attempt": "S01-E1-#31", "outcome": "code", "primary": "V.wrong_sense", "candidates": ["V.wrong_sense", "R.inference"], "confidence": "medium", "note": "근거 한 줄(학생 말 인용)" }
```

- `outcome`: `code`(원인 하나로 판정) · `multiple`(둘 이상이 남아 고를 수 없음 — candidates 에 남은 것) · `insufficient`(증거 부족 — 해석 모름/건너뜀 · 서술이 원인을 가리키지 않음) · `no_cause`(맞힌 문항 · 원인이 없음)
- `primary`: outcome = code 일 때만 코드, 아니면 null. `candidates`: 고려한 코드(최대 3).
- `confidence`: high · medium · low.

## 판정 원칙

1. **원인은 학생의 과정 증거(막힌 곳 · 이유 · 해석 · 범주 · 추가 질문 응답)로만** 정한다. 정답 · 고른 답 · 문항 내용은 증거를 해석하는 맥락으로만 쓴다 — 「이 유형은 보통 이렇다」로 원인을 정하지 않는다.
2. 학생이 고른 **범주(category)는 학생의 자기 진단**이라 틀릴 수 있다. 서술과 어긋나면 서술을 따른다.
3. 추가 질문(targeted_probe) 응답은 한 방향의 **보조 증거**다(A = 사전 뜻 직접 쪽, B = 기본 뜻에서 도출 쪽). 단독으로 판정을 정하지 않는다 — 서술과 함께 본다. C · D · 건너뜀은 구별 증거가 아니다.
4. 증거가 두 코드 사이에서 갈리지 않으면 억지로 고르지 말고 `multiple`. 해석이 모름/건너뜀이고 다른 증거도 약하면 `insufficient`.
5. 코드 정의의 포함 · 제외 기준(codebook.json)을 지킨다.
6. 모든 packet 을 판정한다(빠뜨리지 않는다). 파일은 JSON 배열 하나만.
