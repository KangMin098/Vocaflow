# 사전 결손 4종 채우기 — 청크 사양

`chunk-NN.json` 의 낱말마다 **`need` 에 적힌 칸만** 채워 `chunk-NN.out.json` 으로 쓴다.
이미 차 있는 칸은 `need` 에 없다 — 적재기가 그런 칸을 **아예 안 쓴다**(덮어쓰기 경로가 없다).

## 입력

| 필드 | 뜻 |
|---|---|
| `word` | 표제어 |
| `pos` | 품사 (`noun`·`verb`·`adjective`·`adverb` 등) |
| `meaning_ko` | 이미 있는 한국어 뜻 — **이것을 바꾸지 않는다** |
| `example_en` | 이미 있는 예문 (맥락 판단용) |
| `cefr` · `v_level` · `rank` | 난이도·빈도 (노트의 눈높이를 정할 때 참고) |
| `need` | 채워야 할 칸 목록 |

## 출력

```json
[
  {
    "word": "intercut",
    "collocations": ["intercut the scene", "intercut with flashbacks", "intercut footage"],
    "korean_learner_note": "cut 이 들어 있어 '자르다'로 오해하기 쉽지만, 두 장면을 번갈아 '끼워 넣는' 편집이다.",
    "synonyms": ["interweave", "splice", "crosscut"],
    "ipa": "ˈɪntərkʌt"
  }
]
```

- 유효한 JSON 배열만. 마크다운 코드펜스·설명문 금지.
- `need` 에 없는 칸은 **넣지 않는다**.
- 확신이 없는 칸은 **비운다.** 그 낱말을 통째로 빼도 된다 — **정확도가 수량보다 우선이다.**
  (억지로 채운 값이 들어가면 그 칸은 「완료」로 세어져 **영영 다시 안 잡힌다.**)

---

## 칸별 규칙 — 적재기가 같은 자로 판정한다

### `collocations` — 이 낱말이 실제로 어떤 낱말과 붙어 다니는가

뜻과 예문을 알아도 `make a decision`(o) / `do a decision`(x) 를 구분 못 하면 산출이 안 된다.

- **2~5개.** 각 항목은 **2~5낱말**.
- **반드시 표제어(또는 그 굴절형)를 포함한다.** 안 들어가면 연어가 아니다 — 반려된다.
- 영문·공백·하이픈·아포스트로피만. 표제어 하나만 덜렁 쓰지 않는다.
- 중복 금지.
- **실재하는 결합만.** 사전적으로 가능해 보이는 조합을 지어내지 않는다.

### `korean_learner_note` — **뜻을 다시 쓰지 않는다**

이 칸은 "뜻"이 아니라 **"한국인이 여기서 틀린다"** 를 적는 자리다. 뜻을 되풀이하면
카드에 같은 말이 두 번 나오고 채움률만 오른다 — **적재기가 그런 노트를 반려한다.**

쓸 만한 갈래:
- **거짓짝·오해** — 형태가 비슷한 다른 낱말과 헷갈림 (`intercut` 의 `cut`)
- **연어 제약** — 한국어 직역이 만드는 틀린 결합
- **격식/맥락** — 구어전용·전문용어·문어체라 아무 데나 못 씀
- **문법 함정** — 자동사/타동사, 가산/불가산, 전치사 고정
- **발음 함정** — 철자와 소리가 어긋나는 자리

12~160자, 한글 포함. 한 문장이면 충분하다.

### `synonyms` — 바꿔 써도 뜻이 서는 낱말

- **2~5개.** 각 항목 3낱말 이하. 표제어 자신 금지, 중복 금지.
- **뜻이 실제로 겹치는 것만.** 느슨한 연상어를 넣지 않는다
  (`sufi` 의 유의어로 `muslim` 은 틀리다 — 상위어이지 유의어가 아니다).
- 적당한 유의어가 없으면 **그 칸을 비운다.** 고유명사·전문용어는 대개 그렇다.

### `ipa` — 영국/미국 어느 쪽이든 하나, 표준 IPA

- 슬래시·대괄호 **없이** 기호만: `ˈɪntərkʌt` (`/ˈɪntərkʌt/` 아님)
- 강세 표시(`ˈ`·`ˌ`)를 넣는다. 숫자 금지, 한글 금지.
- **모르면 비운다.** 지어낸 발음은 학습자를 반대로 훈련시킨다.

---

## 쓰기 전에 스크립트로 검산한다

사람 눈은 250개를 못 센다. 출력 파일을 쓴 **뒤에** 이렇게 확인하고, 문제가 있으면 고쳐 다시 쓴다:

```bash
node -e '
const fs=require("fs");const N="NN";
const src=new Map(JSON.parse(fs.readFileSync(`scripts/dict/w0906-fill/chunk-${N}.json`,"utf8")).map(x=>[x.word,x]));
const out=JSON.parse(fs.readFileSync(`scripts/dict/w0906-fill/chunk-${N}.out.json`,"utf8"));
let bad=0;
for(const it of out){
 const s=src.get(it.word); if(!s){console.log("모르는 낱말",it.word);bad++;continue}
 for(const k of Object.keys(it)) if(k!=="word" && !s.need.includes(k)){console.log("need 에 없는 칸",it.word,k);bad++}
 const c=it.collocations, y=it.synonyms, n=it.korean_learner_note, p=it.ipa;
 if(c!==undefined){ if(!Array.isArray(c)||c.length<2){console.log("colloc 2개 미만",it.word);bad++}
   else for(const x of c){const w=x.toLowerCase(),t=it.word.toLowerCase();
     if(!w.includes(t)&&!w.includes(t.slice(0,-1))){console.log("표제어 없음",it.word,x);bad++}
     if(x.split(" ").length<2||x.split(" ").length>5){console.log("길이",it.word,x);bad++}}}
 if(y!==undefined){ if(!Array.isArray(y)||y.length<2){console.log("syn 2개 미만",it.word);bad++}
   else for(const x of y) if(x.toLowerCase()===it.word.toLowerCase()){console.log("자기자신",it.word);bad++}}
 if(n!==undefined){ if(typeof n!=="string"||n.length<12||n.length>160||!/[가-힣]/.test(n)){console.log("노트 길이/한글",it.word);bad++}
   else{const m=(s.meaning_ko||"").replace(/\s+/g,"");
     if(m&&n.replace(/\s+/g,"").includes(m)&&n.length<m.length+20){console.log("뜻 되풀이",it.word);bad++}}}
 if(p!==undefined){ if(typeof p!=="string"||/[가-힣0-9]/.test(p)||!/[ˈˌəɪʊɛæɑɔʌʃʒθðŋɹɜː]/.test(p)||/^[\/\[]/.test(p)){console.log("ipa",it.word,p);bad++}}
}
console.log("불통과",bad,"/ 낱말",out.length);'
```

`불통과 0` 이 될 때까지 고친다. 통과 못 한 칸은 적재기가 **넣지 않고 건너뛴 수를 출력한다.**

마지막에 한 줄로 답한다: `chunk-NN: <낱말 수> · colloc <n> · note <n> · syn <n> · ipa <n>`
