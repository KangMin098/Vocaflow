# PLOS 원문 36,337편 — 수능형 지문을 기계적으로 뽑아낼 수 있는가

측정일 **2026-09-05** · 대상 `library_articles WHERE source='plos'` · **읽기 전용** (DB·코드 무변경)
표본 **500행** (전체 36,337 중 1.38%) · 판정이 아니라 **계측** 문서다. 고치는 방법은 제안하지 않는다.

---

## 0. 여섯 답 요약

| # | 물음 | 수치 | 방법 |
|---|---|---|---|
| 1 | 섹션 표제가 실제로 있는가 | `Introduction` **92.6%** · `Discussion` 77.0% · `Results` 76.2% · `Conclusion` 60.8% · `Methods`계 41.8%. 그러나 **45.8%의 행은 줄바꿈이 하나도 없어** 표제가 산문에 구분자 없이 눌어붙어 있다 | 표본 500 정규식 실측 |
| 2 | Methods/Results 를 버리면 얼마가 남나 | Intro+Disc **p50 13,668자 / 1,927어**(원문의 **43%**) → 124–163어 창 **p50 14개**. 단 구조 판독 실패 6.4%, 창 0개 9.0% | 표본 468행(판독 성공) |
| 3 | 인용 잔재 밀도 | Intro+Disc **1,000어당 14.9개** (숫자형 9.03 + 빈괄호 5.91) → 창의 **71.2%**가 인용을 문다. 정규식 제거 가능 **94.1%**, 불가 **5.9%**(문두·전치사 직결) + `Author et al.` 397건 | 표본 실측 |
| 4 | 나머지 장치 | 원문 전체 → Intro+Disc 로 살아남는 비율: 그림/표 98.1%→**42.5%** · DOI/URL 100%→**20.9%** · 통계 66.7%→**14.3%** · 유전자/화학 56.4%→**36.5%** · 사사/저자기여 53.8%→**1.1%** | 표본 실측 |
| 5 | 1인칭 | Intro+Disc **문장의 12.6%**가 we/our, 자기연구 지시 9.3%. **창 단위로는 39.4%** 가 we/our, 36.5%가 "we found/our study" 류, 22.6%가 "this study/the proposed method" | 표본 42,330문장 |
| 6 | 몇 %가 쓸 만한 150어 지문 1개를 내나 | **기계적으로 깨끗한 자족 창 ≥1 인 행 = 74.2%**(표본 371/500) → 전체 약 **27,000편**. 다만 이건 정규식 통과일 뿐이고, 손으로 본 결과 **실제 교재 투입 가능은 15–35%로 추정** | 실측 + 추정 (§7) |

---

## 1. 접속·표집 방법 (재현용)

```js
// apps/web/.env.local 의 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 사용
// (scripts/csat/topic-gap.mjs L47-L70 과 동일 경로)
const db = createClient(URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// (1) 전수 id — id 키셋 페이지네이션 1,000행씩. MCP SQL 로는 타임아웃 나는 구간이다.
let last = ''
for (;;) {
  const q = db.from('library_articles').select('id').eq('source','plos')
              .order('id',{ascending:true}).limit(1000)
  const { data } = last ? await q.gt('id', last) : await q
  if (!data.length) break; ids.push(...data.map(r=>r.id)); last = data.at(-1).id
}
// → 36,337개 (count exact 와 일치)

// (2) 결정적 셔플 후 앞 500개만 본문 적재 (mulberry32, seed 20260905)
//     .in('id', chunk25) 로 25개씩 20회
```

전체 편수는 `select('id',{count:'exact',head:true}).eq('source','plos')` → **36,337** (직접 계수).

### 먼저: `word_count` 컬럼은 못 믿는다 (전수 직접 계수)

| | |
|---|---|
| `word_count` 가 0 또는 NULL | **22,373 / 36,337 = 61.6%** |
| 값이 있는 13,964행 | p10 2,232 · p50 **4,307** · p90 6,805 · 평균 4,473 |

**길이 게이트를 이 컬럼에 걸면 61.6%가 그냥 통과한다.** 아래 길이 수치는 전부 `content` 를 직접 센 값이다.

### 표본 500행의 본문 크기 (실측)

| 척도 | p10 | p25 | p50 | p75 | p90 | max | 평균 |
|---|---|---|---|---|---|---|---|
| `length(content)` 자 | 20,225 | 25,172 | 33,235 | 42,050 | 55,779 | 118,854 | 35,359 |
| 어수 `/[A-Za-z’'-]+/g` | 2,795 | 3,529 | 4,554 | 5,962 | 8,024 | 17,098 | 4,974 |

**수능 지문 대역(700–1,000자)에 드는 행 = 500 중 0개.** 최솟값도 만 자 단위다.

---

## 2. Q1 — 섹션 표제는 실제로 어떻게 들어 있나

표제 판정: 라벨 뒤가 `공백+대문자` 또는 줄바꿈일 때만 표제 후보로 보고, 앞 문맥으로 위치를 나눴다.

```js
const heading = (before, after) =>
  (/^\s*\n/.test(after) || /^\s+[A-Z(“"0-9]/.test(after)) && (
    idx === 0                                       // docstart
    || /\n\s*(?:\d+(?:\.\d+)*\.?\s*)?$/.test(before) // ownline  (줄머리)
    || /[\s\n]\d+(?:\.\d+)*\.\s*$/.test(before)      // numbered ("3.1 Results")
    || /[.?!][)”"']?\s+$/.test(before)               // sentEnd  (앞 문장 끝)
    || /[a-z0-9)\]%]\s$/.test(before))               // glued    (구분자 없음)
```

| 라벨 | 등장 행% | 표제로 인정 행% | ownline | numbered | sentEnd | glued | docstart | 낱말쓰임 |
|---|---|---|---|---|---|---|---|---|
| Abstract | 50.2 | 50.2 | 251 | 0 | 0 | 0 | 0 | 25 |
| Background | 18.2 | 16.0 | 76 | 0 | 3 | 2 | 67 | 20 |
| **Introduction** | **92.8** | **92.6** | 251 | 0 | 30 | 5 | 195 | 5 |
| Materials and methods | 42.2 | 41.6 | 109 | 5 | 95 | 2 | 0 | 46 |
| Methods / Methodology | 50.6 | 41.8 | 219 | 9 | 63 | 28 | 0 | 122 |
| Results and discussion | 5.8 | 5.6 | 12 | 1 | 13 | 4 | 0 | 1 |
| **Results** | 85.4 | **76.2** | 334 | 24 | 156 | 24 | 0 | 217 |
| **Discussion** | 80.4 | **77.0** | 203 | 23 | 144 | 23 | 0 | 26 |
| **Conclusion(s)** | 65.2 | **60.8** | 330 | 15 | 107 | 6 | 0 | 32 |
| Limitations | 18.6 | 6.4 | 20 | 0 | 10 | 2 | 0 | 84 |
| Supporting information | 21.8 | 3.4 | 0 | 0 | 10 | 11 | 0 | 103 |
| References | 1.4 | 0.6 | 0 | 0 | 0 | 3 | 0 | 4 |
| Acknowledgments | 6.4 | 6.4 | 32 | 0 | 0 | 0 | 0 | 0 |
| Author Contributions | 1.4 | 1.2 | 6 | 0 | 0 | 0 | 0 | 2 |
| Data Availability | 48.2 | 0.2 | 1 | 0 | 0 | 0 | 0 | 242 |
| Competing interests | 53.8 | 0.0 | 0 | 0 | 0 | 0 | 0 | 269 |
| Funding | 54.2 | 1.0 | 1 | 0 | 2 | 16 | 0 | 283 |

읽는 법 세 가지.

1. **줄바꿈이 없는 행이 45.8%(229/500)** 다. 그런 행에서 표제는 마침표조차 없이 문장에 이어 붙는다 —
   `…would not be affected by their decision Results Women made up 90% of cohort 1…`
   즉 "줄 단위로 자른다"는 전략은 절반의 문서에서 성립하지 않는다.
2. `References` / `Acknowledgments` / `Supporting information` 이 거의 안 잡히는 건 좋은 소식이다 —
   `scripts/csat/harvest-plos.mjs` 의 `cleanBody()` 가 **뒤 40% 구간의 첫 표식에서 잘라** 이미 떼어 냈다.
   반대로 `Data Availability`(48.2%)·`Competing interests`(53.8%)·`Funding`(54.2%) 는 **문자열로는 남아 있다**
   (뒤에 `:` 가 와서 표제 판정만 안 될 뿐이다).
3. `Results`(217건)·`Methods`(122건)·`Supporting information`(103건)·`Limitations`(84건)의 **낱말쓰임** 열이
   표제 탐지의 오탐 위험이다. 산문 안에서 그냥 쓰인 낱말이라 자르는 기준으로 삼으면 본문이 잘린다.

---

## 3. Q2 — Introduction + Discussion/Conclusion 만 남기면

### 절차

```
표제 목록 = 위 규칙으로 찾은 모든 표제 (INTRO/METHOD/RESULT/DISC/TAIL 로 분류)
intro    = 첫 INTRO 표제
introEnd = intro 뒤 첫 비-INTRO 표제
disc     = introEnd 이후 첫 DISC 표제
discEnd  = disc 뒤 첫 비-DISC 표제 (없으면 문서 끝)
keep     = content[intro.end … introEnd.at] + content[disc.end … discEnd.at]
```

`discEnd` 를 TAIL 만이 아니라 **METHOD/RESULT 에서도 끊어야** 한다 — PLOS 계열 일부는
Materials and methods 를 Discussion **뒤에** 둔다. 처음엔 TAIL 만 봤다가 보존율 p90 이 95.9% 로
부풀었고(= Methods 를 통째로 삼킴), 규칙을 고치자 43% 로 내려갔다.

### 구조 판독 결과 (표본 500)

| | 행 |
|---|---|
| 판독 성공 | **468 (93.6%)** |
| `Introduction`/`Background` 표제 없음 | 22 |
| Intro 를 끝낼 표제 없음 | 10 |
| Discussion/Conclusion 없음 (Intro 만) | 18 |

Disc 구간을 끝낸 표제 종류: 문서 끝 317 · **INTRO 66** · **METHOD 36** · TAIL 28 · RESULT 3.
`INTRO 66` 은 Discussion 뒤에 `Background`/`Introduction` 낱말이 표제처럼 걸린 **오탐 가능성**이 높다 —
그만큼 Discussion 이 일찍 잘린다. 아래 길이는 그만큼 보수적으로 잡힌 값이다.

### 남는 양 (판독 성공 468행)

| 척도 | p10 | p25 | p50 | p75 | p90 | 평균 |
|---|---|---|---|---|---|---|
| 원문 자 | 21,904 | 25,827 | 33,538 | 42,270 | 55,871 | 36,303 |
| **Intro+Disc 자** | 1,066 | 9,128 | **13,668** | 19,634 | 29,525 | 15,617 |
| **Intro+Disc 어** | 141 | 1,272 | **1,927** | 2,792 | 4,123 | 2,216 |
| Intro 어 | 87 | 416 | 710 | 1,273 | 2,607 | 1,136 |
| Disc 어 | 49 | 349 | 1,006 | 1,527 | 2,092 | 1,080 |
| **보존율 %** | 4 | 29 | **43** | 56 | 78 | 43 |

### 150어 지문 몇 편이 되나

창 정의는 기존 채점자와 같은 대역을 썼다 — **문장 경계를 지키며 124–163어**가 될 때까지 붙이고,
그 대역을 넘기면 버리는 비중첩 그리디. (문장 분리는 `et al.` · `e.g.` · `Fig.` 등 15개 약어 예외 처리.)

| 행당 창 개수 | p10 | p25 | p50 | p75 | p90 | 평균 |
|---|---|---|---|---|---|---|
| 전체 창 | 1 | 9 | **14** | 19 | 28 | 15 |

- 창 **0개**인 행: 42 (판독 성공의 9.0%)
- Intro+Disc 가 400어 미만인 행: 68 (14.5%)
- 총 창 **6,988개** (판독 성공 468행 기준 행당 14.9)

### 이 추출이 얼마나 새는가 — 실측 오차

Intro+Disc 로 뽑은 텍스트에 **Methods 표지**(`were recruited|randomised|incubated|centrifuged|obtained from`,
`informed consent`, `SPSS`, `R version`, `Stata`, `approved by the Institutional/Ethics/Research`)가
남아 있는 행 = **47/468 = 10.0%**. 즉 이 절차의 오염률 하한이 10% 다.

---

## 4. Q3 — 인용 잔재

### 두 세대가 섞여 있다 (예상 못 한 발견)

| | 행 | 비율 |
|---|---|---|
| 숫자 대괄호 `[ 12 ]` 를 가진 행 | 229 | 45.8% |
| **빈 대괄호 `[]` `[,]` `[–]` 를 가진 행** | 266 | **53.2%** |
| 둘 다 | 2 | 0.4% |
| 둘 다 없음 | 7 | 1.4% |

빈도 상위: `[]` 7,725 · `[,]` 2,041 · `[–]` 820 · `[,,]` 326 · `[ 1 ]` 214 · `[ 18 ]` 204 …

두 집합이 **거의 배타적**이다(둘 다 = 2행). 수집 경로가 두 갈래였다는 뜻이다 — 한쪽은 참고문헌 번호가
살아 있고, 다른 쪽은 PLOS 가 앵커 텍스트를 지운 채 **괄호 껍데기만** 보냈다. 정규식을 숫자형만 짜면
절반의 문서에서 인용을 못 본다(실제로 이 조사 1차 통과에서 그랬다).

### 밀도 (Intro+Disc 1,037,079어 기준)

| 형태 | 정규식 | 건수 | 1,000어당 |
|---|---|---|---|
| 숫자 대괄호 | `/\[\s*\d+(?:\s*[,;–—-]\s*\d+)*\s*\]/g` | 9,368 | **9.03** |
| 빈 대괄호 | `/\[[\s,;–—-]*\]/g` | 6,131 | **5.91** |
| 저자-연도 | `/\(\s*[^()]{0,80}?\b(?:19\|20)\d{2}[a-z]?\s*\)/g` | 358 | 0.35 |
| `et al.` | `/\bet\s+al\b\.?/g` | 1,158 | 1.12 |

합계 **1,000어당 14.9개** = 150어 지문 1편당 평균 **2.1개**.

**창의 71.2%(4,977/6,988)가 대괄호 인용을 최소 1개 문다.** (숫자형만 2,937 · 빈괄호만 2,040)
저자-연도는 행의 18.8%, `et al.` 은 행의 42.9%에서 Intro+Disc 안에 살아남는다.

### 기계 제거가 되는가 — 94.1% 는 된다, 5.9% 는 안 된다

제거 규칙:
```js
t.replace(/\[\s*\d+(?:\s*[,;–—-]\s*\d+)*\s*\]/g,'')
 .replace(/\[[\s,;–—-]*\]/g,'')
 .replace(/\(\s*[,;–-]*\s*\)/g,'')
 .replace(/\s+([,.;:])/g,'$1').replace(/\s{2,}/g,' ')
```
제거 후 빈 괄호 잔재 `()` = **0건**. 부가형(문장 끝 근거 표시)은 흔적 없이 사라진다.

**깨지는 경우 = 인용이 문장 성분일 때.** 15,499건 중:

| 유형 | 정규식 | 건수 |
|---|---|---|
| 문두(주어 자리) | `/(?:^\|[.?!]\s+)\[…\]/g` | **710** |
| 전치사 직결 `in/of/from/to/with/see [n]` | `/\b(?:in\|of\|from\|to\|with\|see)\s*\[…\]/g` | 167 |
| 수동태 행위자 `proposed/reported by [n]` | — | 32 |
| `According to [n]` | — | 8 |
| **소계 (제거 불가)** | | **917 = 5.9%** |

여기에 애초에 대괄호가 아니라 **본문 명사구**인 것들이 더 있다:
`Author et al. + 정동사` **397건**(`Hattori et al. showed that…`), `(Author, 2019)` **358건**.
이건 지운다는 개념 자체가 성립하지 않는다.

**문두 인용을 1개 이상 가진 행 = 141/468 = 30.1%.** 실제 파손 예(빈괄호 세대):

```
원문 : … . [] used the SERVQUAL to identify its main factors affecting metro service quality.
제거 : … . used the SERVQUAL to identify its main factors affecting metro service quality.
```
```
원문 : According to [ 5 ] there is a value-based view of software product quality.
제거 : According to there is a value-based view of software product quality.
```

**실패 모드는 "티가 안 난다"는 것이다.** 결과가 여전히 알파벳 문장이라 길이·어휘·문장수 게이트를 전부
통과한다. 주어나 전치사 목적어만 사라진 문장은 **기계로는 검출되지 않고 학습자 화면에서 발견된다.**

---

## 5. Q4 — 나머지 논문 장치

행 단위 존재율. "원문 전체" 대비 "Intro+Disc 로 살아남는" 비율이 핵심이다 (판독 성공 468행).

| 장치 | 정규식(요지) | 원문 전체 | **Intro+Disc** | Intro+Disc 1,000어당 | 창 오염률 |
|---|---|---|---|---|---|
| 그림/표 지시 | `\b(Fig(ure\|s)?\.?\|Table\|Panel\|Scheme\|Supplementary)\s*\.?\s*[A-Z]?\d` | 98.1% | **42.5%** | 1.47 | 12.4% |
| DOI / URL | `\bdoi\s*:\|https?://\|\bwww\.\|\b10\.\d{4,5}/` | 100.0% | **20.9%** | 0.42 | 3.9% |
| 통계 표기 | `p\s*[<>=]\s*0?\.\d\|95\s*%\s*CI\|SD=\|OR=\|r=0\.\d\|n\s*=\s*\d\|χ2\|ANOVA\|t(df)=` | 66.7% | **14.3%** | 0.34 | 1.8% |
| 유전자/화학 표기 | `\b[A-Z]{2,6}[0-9]{1,3}\b\|mRNA\|DNA\|PCR\|ELISA\|CO2\|NaCl\|ATP\|BMI\|IL-\d+\|CD\d+` | 56.4% | **36.5%** | 2.12 | 11.1% |
| 숫자 나열(표 잔해) | `(?:\d[\d.,%]*\s+){3,}` 또는 숫자토큰 비율 >6% | 39.7% | **8.5%** | 0.46 | 19.2% |
| 사사·연구비 | `The funders had no role\|funded by\|grant no\|Funding:\|Competing interests` | 53.8% | **1.1%** | 0.01 | 0.2% |
| 저자기여 | `Conceptualization:\|Data curation:\|Formal analysis:\|Writing – original` | 0.2% | **0.0%** | 0.00 | 0.0% |

**Intro/Discussion 까지 따라 들어오는 것 세 가지:**

1. **그림/표 지시 (창의 12.4%)** — Discussion 은 자기 그림을 계속 되짚는다. `Those simulations are
   displayed in Fig 5 .` 처럼 문장 안에 박혀 있어, 지우면 문장이 남지 않는다.
2. **유전자/화학 표기 (창의 11.1%)** — 밀도가 1,000어당 2.12 로 통계 표기(0.34)의 6배다.
   다만 이 자는 `IUCN`·`SERVQUAL`·`APFD` 같은 **일반 두문자어**도 함께 잡는다(§7 참조).
3. **숫자 나열 (창의 19.2%)** — 줄바꿈이 없는 문서에서 표가 산문에 녹아든 흔적이다.
   `…conduction 45.83% (11) 20.83%(5) 33.33%(8) 0.00%(0) Discussion The National Centre…`

**사사·연구비·저자기여는 사실상 없다.** `cleanBody()` 의 뒤꼬리 절단이 이미 일하고 있다.
"논문 뒤꼬리"는 해결된 문제고, **남은 문제는 본문 자체**다.

---

## 6. Q5 — 1인칭과 자기 연구 지시

| 단위 | 자 | 분모 | 해당 | 비율 |
|---|---|---|---|---|
| 문장 | `\b(We\|we\|Our\|our\|ours)\b` | 42,330 | 5,354 | **12.6%** |
| 문장 | 자기연구 지시 * | 42,330 | 3,925 | **9.3%** |
| 창(124–163어) | `we/our` | 6,988 | 2,753 | **39.4%** |
| 창 | 자기연구 지시 * | 6,988 | 2,551 | **36.5%** |
| 창 | `this study / this paper / the proposed method` 류 | 6,988 | 1,578 | **22.6%** |

\* `/\b(?:[Oo]ur|[Tt]he present|[Tt]his)\s+(?:study|work|paper|research|findings?|results?|analysis|experiments?)\b|\b[Ww]e\s+(?:found|show(?:ed)?|report|observed|investigated|examined|hypothesi[sz]ed|conducted|analy[sz]ed|present|propose|demonstrate[d]?|used|tested|measured|aimed)\b/`

문장 단위 12.6% 가 창 단위 39.4% 로 뛰는 이유는 산술이다 — 창 하나에 평균 6~8문장이 들어가므로
문장 8개 중 하나만 `we` 를 써도 창 전체가 탈락한다. 문단 단위 측정은 **불가능했다**:
45.8%의 행에 줄바꿈이 없어 문단 경계가 존재하지 않는다. 그래서 문장과 창 두 단위로 대신 쟀다.

**1인칭 배제는 창의 약 40%를 지운다.** 여기에 "이 논문/제안 모델" 자기지시(22.6%)가 부분적으로
겹치며 더해진다.

---

## 7. Q6 — 종합 판정

### 사다리 (창 6,988개 · 행 500개)

각 단계는 "무엇까지 허용하는가"만 다르다. 대괄호 인용은 §4의 제거 규칙을 적용한 뒤 판정한다.

| 단계 | 배제 대상 | 통과 창 | 그런 창 ≥1 인 행 |
|---|---|---|---|
| **A 무손질** | 아무것도 안 고치고 위 전부 배제 | 690 (**9.9%**) | 231/500 (**46.2%**) |
| **D 인용·도표만** | 저자-연도 · et al. · 그림/표 · DOI | 5,383 (77.0%) | 425/500 (85.0%) |
| **C 대괄호제거 + 수치·표기 배제** | D + 통계 · 유전자 · 숫자나열 | 4,460 (63.8%) | 412/500 (82.4%) |
| **B C + 1인칭 배제** | C + we/our | 2,732 (39.1%) | 400/500 (80.0%) |
| **E B + 논문 자기지시·눌어붙은 표제 배제** | B + `this study` 류 + `… . Results Women…` | 2,128 (**30.5%**) | 379/500 (**75.8%**) |
| **F E + 되짚기 문두 배제** | E + `However/These/Such/Therefore…` 로 시작 | 1,646 (**23.6%**) | 371/500 (**74.2%**) |

행당 통과 창 개수:

| | p10 | p25 | p50 | p75 | p90 |
|---|---|---|---|---|---|
| E 통과 | 0 | 1 | 3 | 6 | 10 |
| F 통과 | 0 | 1 | 2 | 5 | 8 |

E 통과 창 2,128개 중 **482개(22.7%)** 가 `However`·`These`·`Such` 로 시작한다 — 앞 문맥을 되짚는
문두라 잘라 낸 순간 지시 대상이 사라진다. 그래서 F 를 따로 뒀다.

---

### ── 여기까지가 실측, 여기부터가 추정 ──

**실측(직접 계수)**: §1의 36,337 / 22,373(word_count 결측) — 전수.
§1~§7 의 나머지 모든 백분율 — 표본 500행(전체의 1.38%) 위 정규식 계수.
표본오차: 50% 근방 비율의 95% 신뢰구간 ±4.4%p, 75% 근방 ±3.8%p (유한모집단 보정 무시).

**추정(위 수치로부터의 판단)**:

- F 기준 74.2% 를 전수로 옮기면 **약 26,900편**(95% CI 대략 25,500–28,300)이 "정규식이 트집잡지 못하는
  자족 150어 창"을 최소 1개 낸다. **이 수는 상한이다.**
- 상한을 그대로 믿으면 안 되는 이유는 손으로 20여 개를 읽고 확인했다. 정규식이 못 잡는 잔여 결함:
  - **두문자어 정의가 창의 18.5%** 에 있다 (`(APSC)`, `(VBSE)`, `(SERVQUAL)`). 형태상 결함이 아니라서
    E/F 를 통과하지만 수능 지문으로는 읽을 수 없다.
  - **눌어붙은 표제를 2.7%만 잡았다.** 아래 예시 A 는 F 를 통과했는데 `… cognitive improvement.
    Conclusion Implementing …` 이 그대로 들어 있다.
  - **창 안쪽 조응**(`such security systems`, `these components`)은 문두만 보는 자로는 못 잡는다.
  - **소재**. 통과한 창의 상당수가 소프트웨어 테스트 ROI · 지문 인식 알고리즘 · IUCN 등급이다.
    `topic-gap.mjs` 가 이미 지적한 기술·매체 편중과 같은 문제이며, 이 조사에서는 재지 않았다.
  - **논증 완결성**. 기계 창은 "문장 6개를 이어 붙인 덩어리"일 뿐, 주제문–전개–결론이 한 창 안에서
    닫힌다는 보장이 전혀 없다. 이건 정규식으로 잴 수 있는 성질이 아니다.
- 위 다섯을 감안한 **손 판정 기준 실제 교재 투입 가능 비율 = 대략 15–35%** (약 5,000–13,000편).
  이 구간은 **추정**이다. 20여 개를 읽고 매긴 인상이며, 통계적 근거가 없다. 좁히려면
  무작위 100창을 사람이 5점 척도로 채점하는 별도 작업이 필요하다.

**측정하지 못한 것 (솔직히)**:

1. **문단 구조** — 45.8%의 행에 줄바꿈이 없어 원본 문단 경계를 복원할 수 없었다. 문단 단위 통계는
   이 데이터로는 원리적으로 불가능하다.
2. **전수 확인** — `content ILIKE '%…%'` 류의 전수 스캔은 1.3 GB 라 시도하지 않았다. 표본 1.38%다.
3. **소재 적합** — 재지 않았다. `lib-topic.mjs` 소관이다.
4. **표제 탐지의 오탐률** — `Results`(217건)·`Methods`(122건) 낱말쓰임을 표제와 갈라내는 정확도를
   사람이 대조하지 않았다. Disc 구간이 INTRO 오탐으로 끊긴 66건이 그 증상이다.
5. **문장 분리기 정확도** — 약어 15개만 예외 처리했다. `P. yuma` 같은 종명 약어에서 문장이 쪼개진다.
6. **채점자와의 정합** — 이 조사의 창(124–163어)은 `lib-fit.mjs` 의 대역과 같은 수를 썼지만
   같은 코드를 부르지는 않았다. 창 경계가 완전히 동일하다고 말할 수 없다.

---

## 8. 실물 3편 (verbatim)

### A. 깨끗하게 뽑히는 것 — `plos:10.1371/journal.pone.0293249`

Introduction 첫 창. 인용·수치·1인칭·도표 지시 전부 없음. **무손질(A)로 통과한 690개 중 하나.**

> Various organizations have used the development of information technology to meet their goals. As the organizations have a variety of information on their system, which belongs to different users and business partners, they are responsible for securing the data most effectively. Any organization faces various challenges against the data maintained through threats. The security measures which can be different are enforced to secure the data and handle the problem of illegal access. Access restriction is the most dominant one, which restricts the illegal user from accessing the available data. In this way, different approaches are used, like profile-based access and key-based access restriction methods. However, the performance of such methods is not efficient in meeting the system's security requirements as they can be tampered with easily by various adversaries.

151어. 다만 이 문서의 **다음 창**은 `Using biological features is more effective in enforcing such
security systems.` 로 시작해 `such` 가 앞 창을 가리킨다 — 한 논문이 이런 창을 여러 개 내지는 못한다는
증거다(행당 F 창 p50 = 2).

### B. 못 뽑는 것 — `plos:10.1371/journal.pone.0267840`

Results 가 Discussion 앞에 눌어붙어 `keep` 에 딸려 들어온 구간. 그림 캡션 ID·DOI·수식 기호가 한 창에 다 있다.

> 10.1371/journal.pone.0267840.g005 Fig 5 The figure shows the relative numbers of active cases, infected vaccinated cases, immune population and total cumulative deaths for an alternating reproductive rate, varying sinusoidally between R = 0.4 and R = 2, with the same two initial conditions and nine vaccination scenarios of Fig 2 . Fig 2 shows that when the reproductive rate is low ( R t = 0.7), the number of active cases would fall down quickly under all vaccination schemes, for various efficacies and deployment rate, both in countries that are in the middle or early stages of the spread (upper and lower figures respectively).

여기서 `Fig 5`·`Fig 2`·`R = 0.4`·`10.1371/…g005` 를 다 지우면 **문장이 가리키는 대상이 없어진다.**
지울 것을 지우고 나면 남는 게 지문이 아니라 잔해다.

### C. 경계선 — `plos:10.1371/journal.pone.0351301`

빈 대괄호 세대. 인용 제거는 **흔적 없이** 된다. 남는 문제는 수치 밀도(숫자토큰 비율 6.4%)와 학명이다.

원문:
> The Magdalena–Cauca basin, spanning approximately 273,000 km², is Colombia's most important region in terms of population density (78% of the national population) and economic contribution. It is formed by the Magdalena River (1,538 km) the Cauca River (1,350 km), San Jorge River and Nechi River, together constituting a fluvial system with floodplains extending over 2 million hectares []. Of these, 326,000 hectares are permanent wetlands (ciénagas), varying in size from 1 to 11,000 hectares, which serve as critical spawning and refuge habitats for the basin's ichthyofauna []. … including heavy metals like mercury, lead, and cadmium [,].

제거 후:
> … together constituting a fluvial system with floodplains extending over 2 million hectares. Of these, 326,000 hectares are permanent wetlands (ciénagas), varying in size from 1 to 11,000 hectares, which serve as critical spawning and refuge habitats for the basin's ichthyofauna. … including heavy metals like mercury, lead, and cadmium.

문장은 멀쩡하다. 그러나 150어 안에 `273,000 km²` · `78%` · `1,538 km` · `1,350 km` · `326,000` ·
`11,000` 이 들어 있어 수치 밀도 게이트에 걸린다. **B(대괄호 제거)는 통과하고 C 이상은 탈락**하는 자리다.
이 문서는 이 조사의 사다리에서 `citeEmpty` 를 자에 넣기 전까지 **"무손질 깨끗"으로 잘못 세어졌다** —
빈 대괄호를 안 보면 A 등급이 9.9% 가 아니라 22.7% 로 나온다.

---

## 부록 — 재현 명령

측정 스크립트는 저장소에 남기지 않았다(읽기 전용 조사). 위 §1·§2·§4·§5·§7 의 코드 블록이 전부이며,
다음 순서로 재현된다.

```
1. id 키셋 전수 수집 → 36,337
2. mulberry32(20260905) 셔플 → 앞 500 id 를 .in() 25개씩 적재
3. §2 규칙으로 표제 탐지 → §3 규칙으로 Intro+Disc 절단
4. 124–163어 비중첩 창 생성 (문장 경계 유지, 약어 15종 예외)
5. §4·§5·§6 정규식으로 창마다 플래그 → §7 사다리 집계
```

동일 시드·동일 정규식이면 같은 수가 나온다. 표본이 바뀌면 §0 표의 비율은 ±4%p 안에서 움직인다.
