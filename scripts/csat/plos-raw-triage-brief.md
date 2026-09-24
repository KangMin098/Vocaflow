# PLOS 원본 보관 판정 — 판정자 지시

> 청크: `scripts/csat/plos-raw-triage/chunk-NN.json` (만드는 곳 `plos-raw-triage-export.mjs`)
> 판정자: `csat-source-judge` 서브에이전트. 기본 규격(verdict·genre·uses·why)은 그 에이전트 정의를 따르고, **이 파일이 다른 점만** 정한다.

## 무엇을 판정하나

이 논문을 **교재 원천으로 보관할 가치가 있는가.** 게시 여부가 아니다 — 보관된 원본은 `plos-extract` 로
잘린 뒤 발췌본이 전문 판정을 한 번 더 받는다. 여기서 버린 원본은 다시 읽히지 않는다.

## 입력

`content` 가 없다. 대신:

| 키 | 뜻 |
|---|---|
| `sections` | 서론·배경·고찰·결론 절만 잘라 낸 본문(`## 절이름` 으로 구분, 편당 약 2,000어). 방법·결과는 일부러 뺐다 |
| `sections_found` | 찾은 절 이름. 비어 있으면 절 제목이 없는 글(대개 논평·에세이)이다 — 3,000어 이하면 **전문**, 넘으면 **앞 700어 + 뒤쪽 1,200어** |
| `words` · `has_items` | 전문 어수 · 이미 문항이 붙었는가 |

## 반드시 지킬 것 (시범에서 어긴 것들)

1. **`sections` 를 처음부터 끝까지 전부 읽는다.** 앞 몇백 자만 보고 판정하지 않는다 —
   앞부분만 본 판정이 보관할 논문의 70%를 버렸다(2026-09-24 · 30편 대조). 읽을 만한 단락은 **고찰 쪽**에 많다.
2. **`why` 는 편마다 따로** 쓴다. 근거가 된 절과 그 단락이 무슨 말을 하는지를 적는다. 같은 문장을 여러 편에 복사하지 않는다.
3. 출력은 기본 일곱 키 + `"basis": "sections"` — **여덟 키.** `id`·`source_updated_at`·`body_sha256` 은 한 글자도 고치지 않는다.

## 판정 기준

| verdict | 언제 |
|---|---|
| `use` | 이 절들 어디든 떼어 내면 고교~성인 영어 지문이 될 만한, **일반 독자에게 읽히는** 설명·논증 단락이 있다 |
| `narrative` | 사례·회고처럼 사건이 시간순으로 흐르는 단락이 중심이다 |
| `reject` | 어느 단락을 떼도 유전자·경로 이름, 수치, 수식 나열이라 일반 독자용 지문이 안 된다(`reference`), 또는 차단 장르 |

- 망설여지면 **보관 쪽**으로 둔다. 보관 쪽 오류는 발췌 판정에서 걸러지지만, 버린 쪽 오류는 되돌릴 길이 없다.
- 제목이 `RETRACTED:` 로 시작하는 철회 논문은 `reject` / `obsolete-fact`.

## 검사 → 적재 (에이전트가 아니라 부르는 쪽이 한다)

```
node scripts/csat/gate-reviews-verify.mjs <chunk-NN.json> <chunk-NN.out.json>
node --tls-max-v1.2 scripts/csat/gate-mixed-import.mjs --input <chunk-NN.out.json>            # 예행
node --tls-max-v1.2 scripts/csat/gate-mixed-import.mjs --input <chunk-NN.out.json> --commit
```

적재기는 이 판정을 `csat_fit.gate.retain` 에만 쓴다(`gate.verdict` 는 그대로). 같은 판정을 다시 넣으면 변경 0 — 재실행 안전.
