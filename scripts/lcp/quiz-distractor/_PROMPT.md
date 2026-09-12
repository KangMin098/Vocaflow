# ScriptQuiz 오답 재생성 — 청크 사양

## 왜 하는가

실측 2026-09-05: 「가장 긴 선지를 누른다」 전략의 정답률이 **95.1%**(2,288/2,406)다.
우연이면 25%다. 정답 평균 89.8자 vs 오답 35.8자(2.5배). 챕터 342개 중 246개(71.9%)는
그 전략만으로 전문항 정답이고, 문항 10개 이상인 57권이 전부 50%를 넘었다.

**지문을 한 줄도 읽지 않고 95점이 나온다.** 화면은 보기를 섞지 않지만, 섞어도 소용없다 —
단서가 자리가 아니라 **길이**이기 때문이다. 정확도·점수·주간 리포트는 전부 "이해했다"로
기록되고, 실제로는 Active Recall 이 한 번도 일어나지 않는다.

## 무엇을 하는가

`chunk-NN.json` 의 각 문항에서 **오답(distractor)만** 다시 쓴다.

### 절대 규칙

1. **정답 선지(`options[correct_index]`)는 한 글자도 바꾸지 않는다.**
   정답을 줄여서 길이를 맞추는 것은 반려된다 — 정답을 뭉개면 답이 흐려진다.
   적재기가 정답 문장이 바뀐 청크를 **거부**한다.
2. `correct_index` 를 바꾸지 않는다. 배열 길이도 그대로 둔다(보통 4개).
3. **오답을 정답만큼 구체적으로 쓰되 내용이 틀리게** 만든다. 짧게 끝내지 않는다.

   ⚠️ **실행 가능한 조건은 이것 하나다 — 오답 중 최소 하나는 정답보다 길거나 같아야 한다.**

   「0.8~1.2배」 같은 목표만 주면 대개 0.9배쯤에서 멈추고, 그러면 **정답이 여전히 최장**이라
   단서가 그대로 남는다(실측: 첫 웨이브 150문항 중 **79건**이 그렇게 실패했다).
   길이를 세어 보고, 정답보다 짧기만 하면 오답 하나를 더 늘린다.

   나머지 오답도 정답의 0.75배 아래로 내려가지 않게 한다(정답이 오답 평균의 1.25배를
   넘으면 그것만으로도 거부된다).
4. 오답은 **그 지문에서 실제로 틀린 진술**이어야 한다. 그럴듯하지만 본문이 부정하는 것,
   인물·시점·인과를 바꾼 것, 본문에 나오는 다른 사건을 이 질문의 답인 양 놓은 것이 좋다.
   본문과 무관한 헛소리는 오히려 더 쉬운 문항을 만든다.
5. `textKo` 는 새 영어 문장의 한국어 번역으로 함께 고친다. 빠뜨리면 카드가 반쪽이 된다.
6. 형식 단서를 정답에만 주지 않는다 — 실측상 **정답에만** 대시(—/–)가 든 문항이 993건(41.3%),
   따옴표가 든 것이 235건(9.8%)이다. 대시·따옴표를 쓸 거면 오답에도 고르게 쓴다.
7. 확신이 없으면 그 문항은 **건드리지 말고 출력에서 뺀다.** 정확도가 수량보다 중요하다.

### 입력 필드

| 필드 | 뜻 |
|---|---|
| `id` | 문항 id — 출력에 그대로 넣는다 |
| `book` · `chapter` | 출처 (맥락 판단용) |
| `question` · `question_ko` | 발문 |
| `source_snippet` | 그 문항의 근거 인용 — **이것이 곧 지문 근거다** |
| `correct_index` | 정답 자리 |
| `options[]` | `{text, textKo}` |
| `correct_len` · `distractor_lens` | 지금의 길이 편향(참고용) |

## 출력

`chunk-NN.out.json` 에 배열로 쓴다. **바꾼 문항만** 넣는다.

```json
[
  {
    "id": "17048adb-d073-40e5-80af-74ad1da90d9d",
    "options": [
      { "text": "To race the Hardys' iceboat against the professional crews each morning.", "textKo": "…" },
      { "text": "To go winter camping — renting a shack with a fireplace and stove.", "textKo": "겨울 야영 — 벽난로와 난로가 있는 오두막을 빌리는 것." },
      { "text": "To build a second iceboat before the ice on the bay grows too thin.", "textKo": "…" },
      { "text": "To spend the whole holiday skating along the shore near Bayport.", "textKo": "…" }
    ]
  }
]
```

- 유효한 JSON 만. 마크다운 코드펜스·설명문 금지.
- 정답 자리(위 예에서 index 1)는 **입력과 문자 단위로 동일**해야 한다.

## 쓰기 전에 **스크립트로 검산한다** (이게 통과율을 가른다)

첫 웨이브 실측이 분명했다 — 스스로 세어 본 청크는 **89/90 통과**, 눈대중으로 쓴 청크는
**13/60** 이었다. 사람 눈은 글자 수를 못 센다. 출력 파일을 쓰기 **전에** 이렇게 확인한다:

```bash
node -e '
const a=JSON.parse(require("fs").readFileSync("scripts/lcp/quiz-distractor/chunk-NN.out.json","utf8"));
const s=new Map(JSON.parse(require("fs").readFileSync("scripts/lcp/quiz-distractor/chunk-NN.json","utf8")).map(x=>[x.id,x]));
let bad=0;
for(const it of a){const q=s.get(it.id); const L=it.options.map(o=>o.text.trim().length);
 const c=L[q.correct_index], mx=Math.max(...L), ties=L.filter(v=>v===mx).length;
 const others=L.filter((_,i)=>i!==q.correct_index), avg=others.reduce((x,y)=>x+y,0)/others.length;
 const sole=c===mx&&ties===1, over=avg>0&&c>avg*1.25;
 if(sole||over){bad++;console.log("FAIL",it.id,"정답",c,"오답",others.join(","));}
 if(it.options[q.correct_index].text!==q.options[q.correct_index].text) console.log("정답을 고쳤다",it.id);}
console.log("불통과",bad,"/",a.length);'
```

`불통과 0` 이 나올 때까지 고친다. 통과 못 한 문항은 적재기가 **넣지 않는다.**

## 스스로 확인할 것 (적재기가 같은 자로 판정한다)

- 정답이 최장인가? → 그러면 아직 실패다
- 정답 길이가 오답 평균의 1.25배를 넘는가? → 그러면 아직 실패다
- 정답 문장을 건드렸는가? → 그 문항은 통째로 거부된다

적재기는 통과 못 한 문항을 **넣지 않고 건너뛴 수를 출력한다.** 우회 플래그는 없다.
