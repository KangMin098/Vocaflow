# v4 콘텐츠 초안 검토 (2026-10-11)

> 상태: **draft · single annotator · needs second annotator + anchor-bind + blind adoption + release approval**
> 작성: Claude 단일 판정자. 정답을 본 상태에서 작성했으므로 맹검 판정이 아니다. 코드·DB 는 고치지 않았고, DB 는 `csat_items.passage` 를 읽기만 했다.
> 문장 번호는 0부터 센다. `splitSentences`(passage-skeleton-split-1)로 나눈 문장 수가 골격 `sentences.length` 와 같은지 문항마다 대조했다.
> skeletonSig 는 `claim-support.ts` 의 `skeletonSig` 와 같은 계산(sha256(JSON.stringify(chars)))으로 구했다.

## 1. R-INSERT(문장 삽입) 적합성 — **partial**

현재 과제 정의(`cohesion-link.ts`)는 다음과 같다.
- 각 probe 의 단서는 `cueSentence` 로 지문 안의 문장 번호를 가리킨다.
- 학습자는 그 단서가 가리키는 문장 하나를 고른다(`picks` 는 0 ≤ i < sentenceCount).
- 마지막으로 `order.options` 중 하나를 고른다. 채점은 probe 마다 referent ∪ disputed 에 들어 있는지, 그리고 order 가 정답인지다.

이 구조 가운데 order 부분은 그대로 쓸 수 있다. options 를 「①…⑤」로 두면 된다. 하지만 R-INSERT 에서 핵심 단서는 **주어진 문장**(삽입할 문장) 안에 있고, 그 문장은 지문 번호 체계 밖에 있다. 그래서 `cueSentence` 로 그 자리를 가리킬 수 없다.

- **2025#38**: 주어진 문장 "However, without … the secretive inventor risks …" 가 csat_items.passage 에서는 0번째 문장으로 앞에 붙어 있다. 그 문장에는 `①` 같은 표지가 없다. 반대로 지문 쪽 단서인 6번째 문장 「Such a predicament」는 **주어진 문장**을 가리킨다. 그런데 referent 가 「지문 안 문장 번호」라서, 주어진 문장이 index 0 으로 섞여 있는 상태에 기대야 한다. 이 섞임이 우연인지 규칙인지 확인되지 않았다.
- **2024#38 등 일반 형식**: 주어진 문장 속 단서(However·this·such)가 가리키는 것은 지문의 ⓝ번 **앞** 문장이고, 그 다음 문장이 주어진 문장과 이어지는지가 판정의 근거다. 그러니 「가리키는 문장」 한 개가 아니라 **앞뒤 두 문장의 끊김**을 보는 과제다.

필요한 변경(코드는 고치지 않음):
1. 주석에 `givenSentence`(지문 밖, 단서 문장)를 별도로 두고 `cueSentence: "given"` 을 허용한다.
2. 골격·splitSentences 에서 주어진 문장과 원문자 표지 `( ① )` 를 지문과 분리한다(지금은 표지가 문장 머리에 섞여 들어간다).
3. probe 종류에 「끊긴 곳 고르기(gap)」를 더한다. 이것은 앞 문장의 단서가 다음 문장과 이어지지 않는 지점을 고르는 과제다.

## 2. 응집 연결 초안 (R-ORDER)

| 문항 | 정답 | 단서 → 가리키는 문장 | 갈린 문장(disputed) |
|---|---|---|---|
| 2024#36 | C-A-B | cue1 3→2 (these forms→those instances) · cue2 1→5 (areas of difference→areas of … conflict) | cue2: 6 |
| 2025#36 | C-B-A | cue1 1→5 (Similarly, a landowner→a farmer can reduce effort) · cue2 4→6 (reputations) | cue2: 7 |
| 2025#37 | B-C-A | cue1 6→5 (The birds in a line) · cue2 3→6 (more fearful→more nervous) | cue2: 5 |

모호성:
- **2025#36**: (B) 첫 문장 「Over time landowners monitor」도 단서 후보다. 하지만 가리키는 대상이 흐려서 넣지 않았다.
- **2025#37**: 두 단서가 같은 표현(birds in (a) line)을 쓴다. 그래서 학습자가 두 단서를 혼동할 위험이 있다.
- 세 문항 모두 정답 근거 앵커가 단서 문장과 같다(answerAnchorOverlap 에 적었다).

## 3. 근거 찾기 전이 초안 (R-BLANK)

대상은 2024#31 · 2024#33 · 2023#32 · 2025#34 다. confirm 세트(2025#32 · 2026#31~34)와 진단 준비 시험(M2409, transfer_only) 밖에서 골랐다.

- `deriveEvidenceAnnotation` 규칙을 하나씩 확인했다.
  - 문장 수 n ≥ 4 이고, 주석의 sentenceCount 가 골격 문장 수와 같다.
  - skeletonSig 가 지금 골격의 서명과 같다.
  - 근거 문장은 1~2개이고, 빈칸이 든 문장은 근거에서 뺐다.
  - 모든 번호가 문장 범위 안에 있다.
- `source` / `anchors` 결속은 없다. 그래서 `checkBinding` 이 unbound 로 판정해 과제를 닫는다. 이 문항들을 쓰려면 먼저 anchor-bind 를 돌려야 한다.
- **2023#32**: 2번째 문장 「frequently exposed to one another」도 근거로 읽힐 여지가 있다. 그래서 갈린 문장에 넣었다.
- **2025#34**: 인정할 만한 문장이 넓다(2 · 3 · 5). 2025#31 이 인정 범위가 지문 절반을 넘어 진단 문항에서 빠졌는데, 같은 이유로 빠질 위험이 있다.

## 4. 노출 점검

- 초안에 쓴 문항은 모두 content-candidates 에서 `confirm_or_transfer` 이고, `exposedByExam` 은 false 다.
- 2026 시험 문항은 쓰지 않았다.

## 5. 남은 일

1. 두 번째 판정자가 맹검으로 판정한다(Codex 또는 맥락 없는 새 서브에이전트, 같은 질문지 사용).
2. 합의한 것만 referent·evidence 로 두고, 갈린 문장은 disputed 로 옮긴다.
3. `scripts/csat/map/anchor-bind.mts` 로 원문 결속(source · anchors)을 만든다.
4. 맹검 채택 검토를 한다.
5. 적용 초안을 만든다. 코드 쪽에서 cohesion-link 의 ANNOTATIONS 와 evidence-tasks.v1.json 에 넣고 회귀 테스트를 붙인다.
6. 출시 승인을 받는다.
