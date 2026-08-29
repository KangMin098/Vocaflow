# 시중교재 코퍼스 파이프라인

시중 영어 교재 PDF·HWP·HTML 을 **연령/학년·유형·시리즈로 분류하고 전문을 조회 가능한 형태**로 만든다.
새 미리보기 파일이 계속 추가되는 것을 전제로 설계했다 — 파일 하나를 더 넣으면 그 하나만 처리된다.

## 원문은 저장소에 넣지 않는다

대상은 **저작권이 존속하는 상업 교재**다. 추출한 원문이 git 에 들어가면 그 자체가 배포가 된다.
그래서 저장소에는 **이 파이프라인 코드만** 두고, 매니페스트·본문·DB·md 는 전부
저장소 밖 `store`(기본 `d:/workspace/textbook-corpus`)에 쌓는다.
용도는 **참조 기준**이다 — 학습자에게 내보내는 콘텐츠로 쓰지 않는다.
(관련: memory `reference-commercial-textbooks`)

## 5단계 + 검증

```bash
node scripts/textbook-corpus/scan.mjs       # 1 스캔·zip 전개·분류 → manifest.json
node scripts/textbook-corpus/extract.mjs    # 2 쪽 단위 텍스트     → text/<id>/pages.jsonl
node scripts/textbook-corpus/analyze.mjs    # 3 난이도·어휘 지표    → manifest 에 병합
node scripts/textbook-corpus/build-db.mjs   # 4 SQLite + FTS5     → corpus.db
node scripts/textbook-corpus/build-md.mjs   # 5 문서 카드·색인      → md/ · index/
node scripts/textbook-corpus/verify.mjs     #   목표 대비 자가 검증
```

각 단계는 **재실행 안전**하다. 1~3 은 내용 해시가 같으면 건너뛰고, 4~5 는 정본(manifest +
pages.jsonl)에서 통째로 다시 만든다. 파생물을 증분 갱신하면 정본과 어긋난 채 오래 산다.

| 단계 | 재실행하면 | 다시 하게 만들려면 |
|---|---|---|
| `scan` | 해시가 같은 문서는 손대지 않는다 | `--force` |
| `extract` | `ok`·`scanned` 는 건너뛴다. `failed`·`unsupported` 는 **다시 시도한다**(도구가 생겼을 수 있다) | `--force` · `--only <id>` |
| `analyze` | 해시가 같으면 건너뛴다 | `--force` |
| `build-db` · `build-md` | 통째로 다시 만든다 (항상) | — |

## 파일 구성

| 파일 | 하는 일 |
|---|---|
| `sources.json` | **확장 지점 ①** — 원본 폴더 목록. 새 폴더가 생기면 여기에 한 줄 |
| `taxonomy.mjs` | **분류 정본** — 순서 있는 규칙표. 파일명으로 알 수 있는 것 |
| `overrides.json` | **확장 지점 ②** — 파일명으로 못 알아내는 것을 **근거와 함께** 고정. 규칙보다 세다 |
| `lib.mjs` | 경로·해시·원자적 쓰기 |
| `hwp.mjs` | HWP 5.0 직접 파싱 (CFB + raw deflate + HWPTAG_PARA_TEXT) |
| `query.mjs` | 조회 CLI |
| `verify.mjs` | 목표 6개 자가 검증 (실패 시 종료코드 1) |

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

DB 스키마: `docs` · `pages` · `pages_fts`(FTS5) · `units` · `top_words` · `meta`,
뷰 `v_difficulty` · `v_series` · `v_gaps`.

## 난이도 지표를 어디까지 믿을 것인가

`analyze.mjs` 는 **영문자가 한글의 2배 이상이고 20자 이상인 줄**만 본문으로 보고 잰다.
그래도 머리말·쪽번호·해설 영어가 일부 섞인다. Flesch-Kincaid 는 미국 원어민 학년 척도라
한국 학년과 1:1 이 아니다 — **교재 간 상대 비교**로만 쓴다.

실측 결과 FK 평균은 학년 눈금과 단조 증가한다(초3~4 **3.33** → 고2~고3 **12.28**).
지표가 라벨과 같은 방향으로 움직인다는 뜻이고, 그래서 **라벨이 어긋난 교재를 찾는 데** 쓸 수 있다.

## 아직 못 읽은 것

- **스캔 PDF 3건** — 텍스트 레이어가 없다. 이 환경에 OCR 엔진이 없어 `status='scanned'` 로 대기.
  엔진이 준비되면 `extract.mjs` 에 분기를 더하고 `--force --only <id>` 로 그 문서만 돌린다.
- **출판사 미상 9건** — 미리보기·해설 PDF 뿐이라 판권지가 없다. 사유는 `overrides.json` 의 `unresolved`.

둘 다 `index/06-gaps.md` 와 `node query.mjs gaps` 에 그대로 뜬다.
