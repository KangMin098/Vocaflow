# V2 주석 파일럿 — Codex 맹검 검수 절차

> 검수자: Codex(Claude 초안을 보지 않은 세션). 결과는 DRAFT 합의 자료일 뿐 accepted 승격 · 출시가 아니다(사람 게이트 별도).

## 읽어도 되는 것 / 안 되는 것

| 읽어도 됨 | 읽으면 안 됨(맹검이 깨진다) |
|---|---|
| `private/blind/stage1-<slug>.json` | `private/claude-drafts.json` |
| DB `csat_items.passage` · `answer`(select 만) | `private/annotations/*.draft.json` |
| #276 instrument 문서(`LM-G1_5a_V2_INSTRUMENT.md`) §1–2 | `README.md` §5 의 문항별 모호성 메모 · 이 PR 의 커밋 diff 중 private 관련 해시 외 내용 |
| 2단계에서만: `private/blind/stage2-<slug>.json` | |

## 1단계 — 독립 판정(선택지 없이)

문항마다 `private/blind/review-<slug>.stage1.json` 을 쓴다.

```json
{ "itemId": "2026#30", "sourceRevision": "<stage1 의 값 그대로>", "reviewer": "codex:<세션>",
  "misfit": 0, "contextSenseKo": "그 자리에 문맥이 요구하는 뜻(자기 말)", "why": "한두 문장",
  "cue": { "sentences": [0], "acceptable": [0] }, "ambiguity": "없으면 빈 문자열" }
```

- 문장 번호는 0부터, `stage1.sentenceRanges` 기준. `sourceRevision` 이 DB 원문 SHA256 과 다르면 그 문항은 중단하고 보고한다.
- 제출 뒤 파일 SHA256 을 `private/blind/stage1-submissions.json` 에 `{slug: sha256, at: ISO}` 로 남긴다. **이 해시가 남기 전에는 2단계 파일을 열지 않는다.**

## 2단계 — 뜻 선택지 판정

`stage2-<slug>.json` 의 `senseOptions` 중 정답 하나를 고르고 각 오답의 배제 이유를 쓴다 → `review-<slug>.stage2.json`. 1단계 답은 고치지 않는다(고치고 싶으면 `revisedAfterStage2` 에 따로).

## 합의 계산(Claude 가 두 단계가 끝난 뒤 수행)

| 축 | 일치 정의 | 반영 기준 |
|---|---|---|
| B 판별 | misfit 같음 | **독립성 증거로 쓰지 않음**(공식 정답 공개) — 불일치면 원문 · 표지 오류 의심 |
| D 뜻 | 2단계 선택 = 초안 정답, 그리고 1단계 자기 말 뜻이 그 선택지와 같은 극성 | 12문항 일치율 ≥ 0.85 |
| C 근거 | 1단계 `cue.sentences` 가 초안 `sentences ∪ accepted` 와 겹치고 초안 `sentences` 하나 이상 포함 | 불일치 문항은 `cue.reviewed=false` 유지 |

결과는 `private/agreement.json` + 공개용 요약(문항별 일치 불리언 · 해시만)을 LEDGER 옆에 둔다. 0.85 미만이면 초안 · 선택지를 고친 새 revision 으로 다시 돈다 — 옛 해시는 지우지 않는다.
