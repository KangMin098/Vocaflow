# 24 — 위험 cue 916 감사(작업 B) · sidecar v2

> 상태: 연구 산출물 · AI 검토자(서브에이전트) 판정. 사람 검수 · 학습자 검증 아님. **원본 강의 JSON · DB · 공식 정답 변경 없음.**
> 결속: sidecar-v2 는 sidecar-final 과 같은 원본(main e3e0a6a0e · `lecture-data/*.json` 29 blob · cue sha256)에 묶인다. 새 버전 폴더 — sidecar-final 은 그대로 둔다.
> 검토 입력(지문 · 선지 원문 포함)은 저장소 밖 작업 폴더에만 두고 커밋하지 않았다. 검토 출력은 cue 대본 인용만 담는다(40자 이하, 2,002건 확인).

## 1. 대상 · 절차

| 단계 | 내용 |
|---|---|
| 대상 | sidecar-final 에서 위험 표지(정답 번호 언급 · 출제 의도 · 순서/삽입 지도 · 위치 표현)가 있는데 감사하지 않은 정답 공개 전 cue **916**(강의 563) |
| 맥락 | 처음으로 **실제 문항 발문 · 지문 · 선지 5개 · 공식 정답**(DB `csat_items` SELECT)을 검토자에게 줌 — 「보이는 선지로 답이 정해지는가」 를 판단 |
| 1차 | 서로 출력을 보지 않는 검토자 E · F 가 4묶음씩(서브에이전트 8). 판정 스크립트 금지, 형식 검사만 허용 |
| 근거 검증(엄격) | quote = cue 원문 부분 문자열(8~40자) · 해시 일치 · why 중복 금지 — **위반 0**(E · F · G 모두) |
| 2차 | E≠F 170건 → 3자 G(서브에이전트 2, 같은 맥락) |
| 병합 | E=F → 확정 · E≠F 는 G 가 한쪽과 같으면 2:1 확정 · 셋 다 다르면 UNKNOWN. 최종값은 기존 최종값보다 낮추지 않음(보수) |

## 2. 결과(`review4-compare-summary.json` · `review4-summary.json`)

| 지표 | 값 |
|---|---|
| 감사 완료 | **916 / 916** |
| E · F 지역 수준 일치 | 746 (0.814) · κ **0.64** — 기준 0.85 미만이라 불일치 전부 3자 판정 |
| E · F 혼동 | HINT/HINT 513 · NONE/NONE 126 · DECISIVE/DECISIVE 106 · DECISIVE/HINT 60 · NONE/HINT 49 · HINT/NONE 31 · HINT/DECISIVE 29 · NONE/DECISIVE 1 · ANSWER/ANSWER 1 |
| 3자 판정 | G 가 정리 167 · 셋 다 다름(UNKNOWN) **3** |
| 감사 cue 최종 | NONE 161 · HINT 593 · DECISIVE 158 · ANSWER 1 · UNKNOWN 3 |
| **과소 판정 정정(상향)** | **257** — HINT→DECISIVE 154 · NONE→HINT 98 · NONE→DECISIVE 4 · HINT→ANSWER 1 |
| 하향 이견(기존 값 유지) | 25 |
| 변화 없음 | 631 |

정답 공개 전 2,849 cue 최종(sidecar-v2): NONE 893 · HINT 1,640 · DECISIVE 301 · ANSWER 10 · UNKNOWN 5 · **감사 안 된 위험 cue 0**.
- ANSWER 상향 1건: 2019#33 c2(「정답의 잊기는…」 — 정답 내용을 직접 말함, E · F 독립 일치) → 이 강의의 정지 경계가 index 1 로 당겨짐.
- 과소 판정 비율: 합의(A·B)로 NONE/HINT 였던 위험 cue 916 중 257(28%)이 실제 맥락에서 더 높았다 — 앞선 표본 감사(20%)보다 높다. **지문 · 선지 없이 대본만 본 판정은 과소하다.**

## 3. 제품 적용(작업 A 와의 연결)

`scripts/csat/lecture-disclosure-build.mjs sidecar-v2` → `apps/web/src/lib/csat/lecture/disclosure-data.json`(feat/lecture-learner-control): 검증 경계 **796 / 796**(건너뜀 0), 정지 전 위험 — 결정적 확인 **254** · 결정적 가능 5 · 힌트만 500 · 없음 37. 경계가 첫 cue 인 3강은 「정답 직접 안내 전까지」 를 내주지 않는다.

승격 기준(제품이 자동으로 믿지 않는다):
- 제품은 **경계(R1 · R2 · R7 규칙 + 합의 ANSWER)** 와 **정지 전 위험 등급** 만 쓴다. cue 단위 HINT/DECISIVE 로 재생을 세분 통제하지 않는다.
- 위험 등급은 「단서 없음」 을 약속하는 데 쓰지 않는다 — `none` 도 안내 문구가 「정답 번호를 직접 말하기 직전에 멈춰요」 뿐이다.
- 결속(version · cue 수 · digest)이 깨지면 경계를 쓰지 않는다(서버 409).

## 4. 한계

- 검토자는 모두 AI(서브에이전트). E · F 일치 κ 0.64 — 3자 판정으로 정리했지만 「정답」 이 아니라 다수결이다.
- 검토자 작업 파일이 같은 작업 폴더에 남아 다른 검토자가 볼 수 있는 상태였다(보고: 열지 않음 · 별도 하위 폴더로 옮김). 독립성은 지시 · 자가 보고에 기대며 기계적으로 보장되지 않았다.
- 1차 A · B(대본만) 판정의 `quote · why · channels` 는 여전히 근거로 쓰지 않는다. channels(노출 경로)는 이번 감사에서도 다수가 `speech` 하나로 단순 기록 — 노출 경로별 통제의 근거로 쓰지 않는다.
- 학습 효과 · 이해: 미검증.

## 5. 재현

```
node cue-audit/review4-compare.mjs <검토 입력 폴더>   # E · F 비교 · 3자 입력 생성
node cue-audit/review4-merge.mjs <검토 입력 폴더>     # sidecar-final + review4 → sidecar-v2
```
검토 입력 폴더(지문 포함)는 `fetch-items`(csat_items SELECT) + sidecar-final 로 다시 만든다 — 저장소에는 없다.
