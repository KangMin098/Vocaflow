# 시중교재 코퍼스 파이프라인

시중 영어 교재 PDF·HWP·HTML 을 **연령/학년·유형·시리즈로 분류하고 전문을 조회 가능한 형태**로 만든다.
새 미리보기 파일이 계속 추가되는 것을 전제로 설계했다 — 파일 하나를 더 넣으면 그 하나만 처리된다.

## 원문은 저장소에 넣지 않는다

대상은 **저작권이 존속하는 상업 교재**다. 추출한 원문이 git 에 들어가면 그 자체가 배포가 된다.
그래서 저장소에는 **이 파이프라인 코드만** 두고, 매니페스트·본문·DB·md 는 전부
저장소 밖 `store`(기본 `d:/workspace/textbook-corpus`)에 쌓는다.
용도는 **참조 기준**이다 — 학습자에게 내보내는 콘텐츠로 쓰지 않는다.
(관련: memory `reference-commercial-textbooks`)

## 6단계 + 검증

```bash
node scripts/textbook-corpus/scan.mjs       # 1 스캔·zip 전개·분류 → manifest.json
node scripts/textbook-corpus/extract.mjs    # 2 쪽 단위 텍스트     → text/<id>/pages.jsonl
node scripts/textbook-corpus/analyze.mjs    # 3 난이도·어휘 지표    → manifest 에 병합
node scripts/textbook-corpus/overlap.mjs    # 4a 사본 관계        → overlap.json
node scripts/textbook-corpus/build-db.mjs   # 4b SQLite + FTS5    → corpus.db
node scripts/textbook-corpus/build-md.mjs   # 5 문서 카드·색인      → md/ · index/
node scripts/textbook-corpus/verify.mjs     #   목표 대비 자가 검증
```

각 단계는 **재실행 안전**하다. 1~3 은 내용 해시가 같으면 건너뛰고, 4~5 는 정본(manifest +
pages.jsonl)에서 통째로 다시 만든다. 파생물을 증분 갱신하면 정본과 어긋난 채 오래 산다.

| 단계 | 재실행하면 | 다시 하게 만들려면 |
|---|---|---|
| `scan` | 해시가 같은 문서는 손대지 않는다 | `--force` |
| `extract` | `ok`·`ocr` 는 건너뛴다. `failed`·`unsupported`·(`--ocr` 일 때) `scanned` 는 **다시 시도한다** | `--force` · `--only <id>` · `--ocr` |
| `analyze` | 원본 해시와 **추출 시각**이 둘 다 같을 때만 건너뛴다 (추출이 좋아지면 다시 잰다) | `--force` |
| `overlap` | 항상 다시 계산한다 (문서 59개 × 쌍 비교, 1초 미만) | — |
| `build-db` · `build-md` | 통째로 다시 만든다 (항상) | — |

## 파일 구성

| 파일 | 하는 일 |
|---|---|
| `sources.json` | **확장 지점 ①** — 원본 폴더 목록. 새 폴더가 생기면 여기에 한 줄 |
| `taxonomy.mjs` | **분류 정본** — 순서 있는 규칙표. 파일명으로 알 수 있는 것 |
| `overrides.json` | **확장 지점 ②** — 파일명으로 못 알아내는 것을 **근거와 함께** 고정. 규칙보다 세다 |
| `lib.mjs` | 경로·해시·원자적 쓰기 |
| `hwp.mjs` | HWP 5.0 직접 파싱 (CFB + raw deflate + HWPTAG_PARA_TEXT) |
| `ocr-win.ps1` · `ocr.mjs` | 스캔 PDF 를 Windows 내장 OCR 로 읽고 코퍼스 자체 어휘로 교정 |
| `overlap.mjs` | 8낱말 연속열 해시로 사본·부분본 판정 |
| `query.mjs` | 조회 CLI |
| `verify.mjs` | 목표 7개 자가 검증 (실패 시 종료코드 1) |

## 분류 6축

| 축 | 값 |
|---|---|
| `school` | 초등 · 중등 · 고등 · 초등~중등 · 중등~고등 · 공통 |
| `grade_band` | `초3~초4` 같은 라벨 + `grade_min`/`grade_max` 눈금 (초1=1 … 고3=12) |
| `category` | 독해 · 어휘 · 구문 · 내신 · 기출 · 문법 · 듣기 |
| `role` | 본책 · 본문 · 미리보기 · 정답해설 · 워크북 · 단어장 · 빠른정답 |
| `publisher` | NE능률 · 쎄듀 · EBS · 수경출판사 · 미상 … |
| `series` | 리딩튜터 스타터/주니어/챌린저 · 빠른독해 바른독해 · 달곰한 Literacy … |

**빈 값을 두지 않는다.** 모르면 `미상`·`공통` 이라는 **명시값**을 넣고 `low_confidence` 에 축 이름을 적는다.
빈 값을 남기면 다음 실행이 "완료" 로 세어 구멍이 영영 남는다.

## 새 교재를 추가하려면

1. 파일을 `sources.json` 의 `roots` 안 아무 곳에 넣는다 (하위 폴더 구조는 자유 — 경로에서 학년을 읽는다).
2. `node scan.mjs` → 신규 1건만 잡힌다.
3. `node extract.mjs && node analyze.mjs && node build-db.mjs && node build-md.mjs`
4. `node verify.mjs` — 분류가 안 잡히면 `G3b` 에 뜬다.
   - 파일명으로 판단 가능 → `taxonomy.mjs` 의 `SERIES_RULES` 에 규칙 추가 (구체적인 것을 위에)
   - 원문 판권지를 봐야 안다 → `overrides.json` 에 **근거 문자열과 함께** 추가

새 원본 폴더가 생겼으면 `sources.json` 의 `roots` 에 한 줄 더한다. zip 은 자동으로 전개된다.

## 조회

```bash
node query.mjs stats
node query.mjs search "artificial intelligence" --school 고등 --limit 10
node query.mjs difficulty                 # 학년 눈금 순 난이도 표
node query.mjs series 리딩튜터              # 권별 본책/미리보기/해설 갖춤 여부
node query.mjs word climate               # 어느 학년대 교재의 빈출어인지
node query.mjs doc <doc_id> --from 3 --to 5
node query.mjs sql "SELECT ..."
```

DB 스키마: `docs` · `pages` · `pages_fts`(FTS5) · `units` · `top_words` · `overlap` · `meta`,
뷰 `v_difficulty` · `v_series` · `v_overlap` · `v_gaps`.

## 산출물 크기 (실측 2026-08-30)

| 산출물 | 크기 | 쓰임 |
|---|---:|---|
| `corpus.db` | 51.9 MB | 전문 조회·교차 질의 (**정본 질의면**) |
| `text/` (pages.jsonl 79) | 21 MB | 쪽 단위 원문 (DB 의 원료) |
| `md/` 문서 카드 79장 | 676 KB | **사람이 훑는 면** |
| `index/` 색인 9장 | 173 KB | 축별 비교표 |
| `full/` 원문 전량 md | 20 MB | `--full` 로만 생성. 열어 읽을 일이 있을 때 |

md 만으로 다 담으려 하면 20 MB 짜리 파일 더미가 되어 열리지도 검색되지도 않는다.
그래서 **DB 가 정본 질의면이고 md 는 판단면**이다 — 문서 카드에는 원문 대신
분류 축·측정 지표·단원 목차·빈출 어휘·대표 발췌·조회용 SQL 한 줄을 넣는다.

## 스캔 PDF — Windows 내장 OCR

이 환경에는 tesseract 도 한글오피스도 없다. 대신 Windows 11 의 `Windows.Data.Pdf`(렌더러) +
`Windows.Media.Ocr`(인식기, 설치 언어 `ko`)을 PowerShell 로 부른다. 한국어 인식기는 라틴 문자도 읽는다.

```bash
node extract.mjs --ocr        # status='scanned' 인 것만 OCR (느리다: 쪽당 1.5~2초)
```

- 배율은 재서 골랐다 — 2.0/2.5/3.0/**3.5** 를 5쪽에 돌려 라틴 토큰 오염률을 비교(4.0/4.7/4.8/**3.6%**).
- 인식기에는 최대 이미지 변 **10,000px** 이 있다. 큰 판형을 그대로 확대하면 그 문서 **전체가 실패**하므로 쪽마다 배율을 눌러 준다.
- 오인식 교정은 **외부 사전 없이** 한다: 깨끗하게 추출된 76개 문서에서 3회 이상 나온 낱말 **13,506개**를 사전 삼아,
  `0f`→`of` · `t0`→`to` 처럼 숫자가 섞인 토큰의 후보를 만들어 **사전에 있는 형태로 바뀔 때만** 적용한다.
  실측 교정률 **462/807 (57%)**. 권 표기(`L2`·`B1`)는 오인식이 아니므로 손대지 않는다.
- 결과 상태는 `ok` 가 아니라 **`ocr`** 다. 인식 오류가 남은 텍스트를 깨끗한 추출과 같은 칸에 넣으면
  나중에 그 차이를 아무도 알 수 없게 된다.

영어 정확도를 더 올리려면 en-US 인식기를 넣으면 된다(현재 `NotPresent`):
`Add-WindowsCapability -Online -Name "Language.OCR~~~en-US~0.0.1.0"` — 시스템 변경이라 사용자 판단이 필요하다.

## 사본 관계

같은 책이 여러 본 들어 있다. 모르고 세면 "교재 N종을 비교했다" 가 거짓이 된다.
8낱말 연속열을 해시해 1/64 만 남기고 **포함률**(작은 쪽이 큰 쪽에 얼마나 들어 있나)을 잰다 —
자카드는 20쪽 미리보기와 207쪽 본책을 남남으로 만들어 이 물음에 못 쓴다.

실측 24쌍: **같은 책 3 · 부분본 5 · 지문 일부 공유 16**. 예를 들어
`빠른독해 바른독해 구문독해.pdf` 는 `2.빠른독해 바른독해_구문독해.pdf` 안에 **100%** 들어 있다.
`index/08-overlap.md` · `node query.mjs sql "SELECT * FROM v_overlap"`.

## 난이도 지표를 어디까지 믿을 것인가

`analyze.mjs` 는 **영문자가 한글의 2배 이상이고 20자 이상인 줄**만 본문으로 보고 잰다.
그래도 머리말·쪽번호·해설 영어가 일부 섞인다. Flesch-Kincaid 는 미국 원어민 학년 척도라
한국 학년과 1:1 이 아니다 — **교재 간 상대 비교**로만 쓴다.

실측 결과 FK 평균은 학년 눈금과 단조 증가한다(초3~4 **3.33** → 고2~고3 **12.28**).
지표가 라벨과 같은 방향으로 움직인다는 뜻이고, 그래서 **라벨이 어긋난 교재를 찾는 데** 쓸 수 있다.

## 아직 남은 것

- **출판사 미상 9건** (중학 수능 딥독 6 · 내신백신 2 · AST Reading Key 1) — 가진 파일이
  미리보기·해설·부록뿐이라 **판권지가 파일 안에 없다.** 본책 표지를 봐야 확정된다.
  찾아본 결과는 `overrides.json` 의 `unresolved` 에 적어 뒀다 — 다음 사람이 같은 검색을 반복하지 않도록.
- **OCR 텍스트 3건** — 본문은 확보했지만 인식 오류가 남아 있다(`status='ocr'`).
  같은 책의 깨끗한 사본이 있는 경우가 있으니 `index/08-overlap.md` 를 먼저 본다.

`index/06-gaps.md` 와 `node query.mjs gaps` 에 그대로 뜬다.

## 검증 (verify.mjs)

| | 재는 것 | 실측 |
|---|---|---|
| G1 | 원본 파일이 전부 등재됐나 | 79/79 |
| G2 | 조용한 실패 0 · 본문 확보율 | ok 76 · ocr 3 · **79/79 (100%)** |
| G3 | 6축에 빈 값 0 | 79 × 6 |
| G4 | FTS·뷰가 실제로 답하나 | pages 5,214 · v_difficulty 74 |
| G5 | 파일 1개 추가 → 1개만 처리 | 임시 루트를 만들어 **실제로 실행해** 확인 |
| G6 | 두 번 돌려 같은 결과 | DB·md 지문 일치 |
| G7 | 사본 탐지가 동작하나 | 24쌍 · 동일 사본 검출 |

하나라도 실패하면 종료코드 1. `--quick` 으로 느린 G5·G6 을 뺄 수 있다.
