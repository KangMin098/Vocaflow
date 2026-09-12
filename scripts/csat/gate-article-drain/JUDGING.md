<!-- scripts/csat/gate-article-drain/JUDGING.md -->
# 기사 단위 게이트 판정 규칙 (드레인 정본)

`chunk-NN.json` 을 읽고 **각 항목에 `verdict`·`genre`·`why` 세 키를 더해**
`chunk-NN.out.json` 으로 저장한다. **입력 배열의 순서·개수·기존 키를 그대로 보존한다**
(`book`·`url`·`source`·`v_level`·`words`·`rows`·`excerpts` 를 지우거나 고치지 않는다).

판정 대상은 PLOS 논문에서 잘라 낸 **300어대 발췌**다. 논문 전문이 아니라,
수능 지문 한 편으로 쓸 수 있는지를 본다.

## verdict — 셋 중 하나 (다른 값은 적재기가 통째로 차단한다)

| 값 | 언제 |
|---|---|
| `use` | 설명·논증문으로 읽힌다. 한 편의 글로 논지가 서고 자족적이다 |
| `narrative` | 이야기·전기·회고 — 사건이 시간순으로 흐른다 (심경·장문 유형용) |
| `reject` | 아래 차단 장르 중 하나에 해당한다 |

## genre

**`verdict: 'reject'` 면 genre 는 반드시 아래 차단 장르 중 하나여야 한다.**
(`reject` 인데 차단 장르가 아니면 검사기가 오류를 낸다. 반대로 `use`·`narrative` 인데
차단 장르를 쓰면 그 조합은 **조용히 게시된다** — 절대 쓰지 말 것.)

차단 장르 9종:

| genre | 뜻 |
|---|---|
| `fragmentary` | 그림 캡션·표 조각·문장 중간에서 끊긴 덩어리. 앞뒤 없이 뜻이 안 선다 |
| `reference` | 사전 항목·목록·참고문헌·방법 절차 나열 — 읽는 글이 아니다 |
| `mixed` | 서로 다른 글이 섞였다. 주제가 중간에 갈아엎힌다 |
| `bias` | 특정 집단에 대한 편견이 전제로 깔렸다 |
| `doctrine` | 교리·신조를 사실로 제시한다 |
| `pseudoscience` | 의사과학 |
| `obsolete-fact` | 지금은 폐기된 사실을 현재형으로 말한다 |
| `polemic` | 선동·일방적 정치 논박 |
| `poetry-drama` | 운문·희곡 |

**`use`·`narrative` 의 genre 는 주제 분류다** — 이미 쓰인 어휘를 그대로 쓴다:
`health` `science` `social` `technology` `nature` `space` `climate` `history`
`education` `economics` `news` `art` `essay` `psychology` `language` `sports`
`environment` `engineering` `culture` `geography` `energy` `literature`
`fiction` `biography` `memoir` `travel` `food` `agriculture`
(새 낱말을 만들지 말고 위에서 고른다. genre 를 비워 두면 안 된다.)

## why

**한국어 한 문장.** 왜 그렇게 판정했는지 — 라벨이 말하지 않는 것을 적는다.
비면 "왜" 가 남지 않아 나중에 판정을 되짚을 수 없다. 12자 이상.

## 판정 요령 (실측)

- **캡션·표 조각을 놓치지 말 것.** `(A)` `(B)` `Fig 1` `Table 2` 로 시작하거나
  그림 없이는 뜻이 안 서는 덩어리는 `reject`/`fragmentary` 다. PLOS 발췌에서 가장 흔한 탈락 사유.
- **방법(Methods)·결과 수치 나열**은 `reject`/`reference`. "참가자 N=312, 평균 연령…" 이
  이어지면 읽는 글이 아니다.
- **서론 1~2단락**이 가장 좋다 — 통념 제시 → 반전 → 이 연구의 물음. `use`.
- **논문 인용 표시**(`[12]`, `(Smith et al., 2019)`)가 남아 있는 것만으로는 탈락이 아니다.
  기계 규칙이 따로 본다. 여기서는 **글로서 읽히는가**만 본다.
- `excerpts` 는 발췌 일부만 보여 준다. **두 조각이 서로 다른 글로 보이면** `mixed`.
- 자기 인용·연구비 명시·저자 기여 진술 덩어리는 `reference`.

## 재실행 안전

`.out.json` 이 이미 있는 청크는 다시 만들지 않는다. export 는 이미 판정된 기사를
건너뛰므로 몇 번 돌려도 같은 결과다.
