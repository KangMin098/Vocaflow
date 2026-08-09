# PDCP — Public-Domain Comic Pipeline

> 퍼블릭 도메인 스캔 만화를 현대적 학습 콘텐츠로 바꿔 학습자에게 제공하는 **독립 파이프라인**.
> CCP(도서→AI 생성 만화)와 저장·Admin·학습자 면을 **공유하지 않는다**.
> 작성: v07.6 · 실측 소재 `ClassicsIllustrated027TheSpy` (Internet Archive)

---

## 0. CCP 와 왜 분리하는가

초안에서는 `comic_books` 에 `source_kind` 판별 컬럼을 붙여 CCP 를 확장하려 했다. **철회했다.**

| 구분 | CCP (AI 생성) | PDCP (PD 스캔) |
|---|---|---|
| 콘텐츠 단위 | 도서의 **챕터** | 발행 **호(issue)** — 챕터와 무관 |
| 원작 관계 | `library_books` 에 종속 | 독립. 원작은 느슨한 참조 |
| 대사 | 우리가 저작(정본 verbatim) | 이미지에 구워져 있음 → OCR 추출 |
| QC | 프롬프트 준수·정본 일치 | 화질 · 컷 분할 정확도 · OCR 신뢰도 |
| 법적 게이트 | 없음(자체 생성물) | **필수** — 호별 PD 근거 없으면 발행 불가 |
| 실패 모드 | 생성 품질 저하 | **저작권 사고(되돌릴 수 없음)** |
| **현대화 수단** | **GPU 이미지 생성 모델** | **Claude Code 작업 기반** (비전·판단·글) + CPU(ffmpeg) |

> ⚠️ **현대화 2트랙 (콘솔에서 선택 · 2026-08-10 갱신).** 초기 지침은 "GPU 금지, Claude Code 단일"이었으나
> 사용자 결정으로 **선택 트랙**을 추가했다.
>
> **① 작화 보존 (기본, Claude Code/CPU)** — 원작 그림을 **그대로 유지**하고 "제시·포맷"만 현대화:
> ⓐffmpeg 색채·디자인(`page-modern` A/B/C/MAX) ⓑHTML 모던 말풍선(`letter.spec`→`page-html`, `render-check` 검증)
> ⓒ학습 레이어(TTS·단어뜻). $0·로컬·저작권 안전. **발행 기본.**
>
> **② AI 리스타일 (선택, GPU 모델)** — 원작을 **다시 그림**(화풍 변경, 구도·인물 유지). CCP 모델 재사용:
> **Qwen-Image-Edit 2511**(양산·RunPod fp8) / **SDXL+ControlNet Lineart**(파일럿·Kaggle 무료 T4x2). 패널 크롭 단위
> + 레터링 오버레이 폴백(텍스트 뭉개짐 차단). 2단 로켓: Kaggle 검증($0) → 부족 시 RunPod 양산(호당 ~$1.5).
> 스크립트: `scripts/comic/pd/ai-restyle/`. **명시 선택해야 돈다(기본 아님).**
>
> Claude Code 오퍼레이터 루프(평가→기록→조정→반복→QC 게이트)는 두 트랙 공통 주요 기능이며 모든 결정이 모니터링된다.

> **현대화 레시피 (실측 수렴, `webtoon.mjs --modern`)** — "확연히 현대적"으로 판정된 CPU-only 체인:
> ①**무테두리 crop** ②**colorlevels 화이트포인트 정규화**(크림 종이→순백 + 청색채널↑ 황색캐스트 제거) ③**smartblur 디스크린**(halftone 점 제거) ④**eq 강채도(1.5)/대비** ⑤**palette 40색 평면화**(flat vibrant 컬러) ⑥세로 vstack.
> 두 핵심 레버 = **halftone→평면컬러**(옛 인쇄 신호 #1 제거) + **화이트포인트 정규화**(누런 종이→순백). Claude Code 가 스트립 프리뷰를 직접 보고 두 레버를 발견·검증(모니터링: `webtoon.manifest.json` verdict). 원작 인쇄 배경색은 작화 보존 원칙상 유지.

> **레터링(대사) 현대화 — 비파괴 대사 레이어 (`dialogue-below.mjs`)**
> ⛔ **원작 위 덮어쓰기 반려** (`reletter.mjs` 실측): OCR 말풍선 box 좌표가 부정확하고 미검출도 있어 흰 말풍선이 엉뚱한 위치에 찍히며 원문이 잔존 → **작화 훼손**. 래스터/HTML 불문 stamp-over 폐기(`reletter.manifest.json` verdict=반려).
> ✅ **채택**: 모던 컷 **아래**에 클린 sans 대사 바(forest 강조 `#2E7D5A` + `refined` i+1 재작성). **좌표 불필요** → 소스 불문 안정, 작화 100% 보존. 이 대사가 곧 **웹 리더 HTML 대사 레이어**(선택가능 텍스트·TTS·i+1)의 소스. (`dialogue.manifest.json` verdict=채택.)

> **자기발전 타임라인 (`oplog.mjs` → `work/_oplog.jsonl` → 모니터)**
> 오퍼레이터 루프의 "시도 → 단계별 평가 → 평가 기반 자기발전(개선/채택/반려/피벗)"을 한 줄씩 append-only 로그로 쌓는다.
> 각 실험/판정 때 `node oplog.mjs --slug <slug> --phase <p> --action evaluate|improve|adopt|reject|pivot|note --title … --verdict … --next …` 로 기록.
> Admin 모니터 최상단 **자기발전 타임라인** 카드가 콘텐츠별 단계 흐름(액션색 점 미니맵 + 확장 시 전체 스텝)을 **한눈에** 렌더. API=`/api/pdcp/oplog`. 이로써 "지금 뭐가 어떻게 진행·평가·개선되는지"가 UI 에서 보인다.

마지막 줄이 결정적이다. 저작권 게이트를 "판별 컬럼이 `pd-scan` 일 때만" 거는 **조건부 제약**은
그 컬럼 하나만 잘못 들어가도 무너진다. 독립 테이블이면 **그 테이블의 모든 행**에 무조건 걸 수 있다.
게다가 두 소재는 단위(챕터 vs 호)가 달라, 한 테이블에 담으면 모든 쿼리·화면·QC 에 분기가 번진다.

**분리 범위**: 테이블 · Admin 큐 · 학습자 라우트 · 카탈로그 · 발행 게이트.
**공유**: 컷 스크롤 리더 *컴포넌트*(순수 UI 프리미티브) — 제품 통합이 아니라 위젯 재사용.

---

## 1. 소스 레이어 — 사이트마다 취득 방식이 근본적으로 다르다

실측(2026-08):

| 소스 | 발견 | 인증 | 취득 단위 | 대량 | OCR | 간격 |
|---|---|---|---|---|---|---|
| **Internet Archive** | 검색 API | 없음 | 페이지 이미지(임의 폭) | O | **단어 bbox(hOCR)** | 250ms |
| **Digital Comic Museum** | 스크레이프 | **계정** | 호 단위 ZIP | X | 없음 | — |
| **Comic Book Plus** | 스크레이프 | **계정** | 호 단위 다운로드 | X | 없음 | — |
| **IIIF**(도서관·박물관) | manifest | 기관별 | **타일/리전 요청** | O | 기관별 | 400ms |

- IA 만 HTTP 200. **DCM·CBP 는 403** (봇 차단).
- IA 는 `_hocr.html`(1.3MB/호)로 **단어 단위 좌표까지** 준다 → OCR 엔진 불필요.
- IIIF 는 "다운로드"라는 개념이 없다. `{image}/{region}/{size}/{rotation}/{quality}.jpg` 로 **생성 요청**한다.

### 1-1. 어댑터 계약 (`sources/types.mjs`)

각 어댑터는 **취득 방법**과 **하류 파이프라인 프로파일**을 함께 선언한다.
차이가 취득에서 끝나지 않기 때문이다 — IA 는 스캐너가 이미 디스큐/크롭을 했으니 복원을 약하게
걸어야 하고, DCM 원본 스캔은 기울기까지 살아 있어 풀 복원이 필요하다.

```
caps     { discovery, auth, unit, bulk, ocr, ocrBoxes, minDelayMs, concurrency }
profile  { needsCrop, needsDeskew, saturation, upscale, denoise,
           segmentAnalysis, segmentDilate, ocrStrategy }
메서드    search · metadata · pages · fetchPage · fetchOcr · pdHint
```

구현: `internet-archive` (완전 자동) · `local-dir` (수동 취득 정식 경로) · `iiif` (표준 프로토콜)

### 1-2. `local-dir` — 우회 크롤링을 하지 않는 이유

DCM·CBP 는 403 + 계정 로그인 + 호 단위 ZIP 이다. 우회 크롤링은
① 이용약관 위반 ② 차단당하면 파이프라인 전체가 죽음 ③ 법적 위험을 만든다.
그래서 **사람이 브라우저로 정상 다운로드한 파일을 1급 경로로 편입**했다.
`source.json`(출처·PD 근거)을 함께 두면 자동 소스와 완전히 동일하게 하류를 탄다.

### 1-3. 정규화 intake — 설계의 핵심 경계

```
intake/<slug>/
  pages/0001.jpg …        원본 페이지 (소스 무관 동일 규칙)
  ocr/source.hocr         소스가 OCR 을 주면 원본 그대로
  source.manifest.json    출처 · 법적근거 · pipelineProfile · capabilities · 페이지 목록
```

**이 경계 덕분에 사이트가 늘어나도 어댑터 하나만 추가하면 되고, 복원·분할·OCR·적재 코드는
손대지 않는다.** 하류는 자기가 어느 사이트에서 온 소재를 다루는지 모른다.

---

## 2. 법적 검증 (게이트 0)

미국 저작권 기준. **자동 판정이 아니라 사람 검증의 출발점**이다.

1. **1929년 이전** → PD 확정 (`pre-1929`)
2. **1930~1963** → 갱신(renewal) 여부가 갈림. UPenn 갱신 기록을 호별 확인.
   갱신 없음 → PD(`no-renewal`), 갱신 있음 → **사용 불가**
3. **1964 이후** → 자동 갱신 → **사용 불가**
4. Classics Illustrated **Junior** 는 안전한 PD 가 아니다 — 제외
5. IIIF manifest 에 `rights: publicdomain/CC0` 명시 → `explicit-license`

`acquire.mjs` 가 후보마다 힌트를 출력하지만 **최종 판정은 사람이 입력**하고,
DB 제약(`pd_issues_publish_gate`)이 근거 없는 발행을 원천 차단한다.

> ⚠️ 원작(예: Cooper 『The Spy』)의 저작권과 **그 만화 각색본**의 저작권은 별개다. 위 판정은 각색본 기준.

---

## 3. 복원 — `restore.mjs` ✅ 검증됨

의존성은 **ffmpeg 하나**(이 환경에 Python/OpenCV/sharp 없음 — 실측).

| 단계 | 처리 | 근거 |
|---|---|---|
| ① 여백 크롭 | 모서리 색 = 배경으로 보고 콘텐츠 bbox | 스캔대 분홍/회색 테두리 제거 |
| ② 탈황변 | 종이색 **채널별 90분위수** → 채널 게인 | 평균은 잉크에 끌리고 최댓값은 하이라이트에 휘둘림 |
| ③ 디노이즈 | `nlmeans=s=1.6:p=3:r=9` | 망점만 녹이고 선화 보존 |
| ④ 색 복원 | `eq=contrast=1.10:saturation=<profile>` | 바랜 잉크 회복 |
| ⑤ 업스케일·샤픈 | `scale=2x:lanczos` → `unsharp` | 업스케일 **후** 샤픈해야 레터링 에지가 산다 |

채도·업스케일·크롭 여부는 어댑터의 `pipelineProfile` 이 준다(IA 1.22 / local-dir 1.28 / IIIF 1.15).

**실측** (CI #27 p7, 2089×3000): 종이 rgb(250,241,234) → 게인 1.000/1.037/1.068,
분홍 여백 제거, 말풍선 텍스트가 흰 배경 위 선명한 검정으로 복원.

---

## 4. 컷 분할 — `segment.mjs` ⚠️ 부분 검증 (3/4)

1940년대 지면은 A4 인쇄 전제의 조밀한 4~8컷 그리드다. 폰에 그대로 띄우면 레터링이 깨알이 된다.
컷으로 쪼개 **세로 스크롤 한 컷씩** 보여줘야 화면 전체가 한 컷에 할당된다.

**알고리즘 (두 번 갈아엎음)**
1. ~~재귀 XY-cut(거터 투영)~~ — 실패. 위·아래 컷의 프레임선 y 가 어긋나 **전폭 흰 행이 없다**.
2. **배경 플러드필 + 4-연결요소** — 채택.

**실측으로 잡은 두 파라미터**
- `--analysis 1100` — 480px 로 줄이면 2~6px 거터가 1px 미만으로 뭉개져 **전혀** 안 나뉜다.
- `--dilate 2` — 거터가 2px 라 잡티 하나에 통로가 막힌다. 프레임선(3~6px)보다 작게 유지.

**한계**: CI #27 p7(4컷) → 3컷. 캡션 박스가 거터를 가로질러 우측 2컷이 병합.
자동 1차 분할이며 §6 검수에서 사람이 보정한다. 분할 신뢰도를 `qc` 에 싣는다.

---

## 5. 대사 추출 — `ocr.mjs` ⚠️ 구현 · **품질 한계 실측됨**

PD 스캔이 CCP 와 갈리는 결정적 지점: AI 만화는 대사가 이미 데이터지만,
PD 스캔은 **이미지에 구워져** 있어 리더의 대사존·verbatim reveal·vocab 칩이 전부 죽는다.

IA 는 Tesseract hOCR 을 함께 준다(실측 52p / 7,615단어 / 단어별 bbox + `x_wconf`).
그래서 이 단계는 "OCR 을 돌린다"가 아니라 **"이미 있는 좌표를 컷에 배분한다"** 이다.

### 좌표 체인
```
hOCR px(원본 스캔) ─(복원 크롭 빼기)→ ─(업스케일 곱)→ 복원본 px
                   ─(컷 박스 빼고 나누기)→ 컷 기준 0~1 정규화
```
정규화로 끝내는 이유: 컷 이미지는 웹 배포용으로 한 번 더 축소되므로 px 로 두면 깨진다.

### 구현된 것
- hOCR 파싱(정규식 — 1.4MB 를 DOM 에 올리지 않는다)
- **컷 배타 배정** — 컷 박스가 겹칠 때 "중심이 든 컷 전부"가 아니라 겹침 면적 최대 컷 하나에만.
  (중심 기준으로 하니 같은 대사가 두 컷에 중복 출현했다 — 실측 후 수정)
- 라인 → 말풍선 묶기 (세로 근접 + 가로 겹침)
- truecasing — 문장 케이스 · `I`/`I'm` 복원 · 고유명사는 gazetteer 로 되먹임
- 품질 판정 `needsReview` + 사유

### ★ 실측 결과 — hOCR 만으로는 부족하다

`ClassicsIllustrated027TheSpy` 6페이지 / 15컷:

| 지표 | 값 |
|---|---|
| 대사 추출 | 12컷에서 25개 |
| 그대로 사용 가능 | **6개 (24%)** |
| 검수 필요 | 19개 |
| 사유 1위 | **비라틴 문자 12건** |

**뚜렷한 패턴: 캡션 박스(인쇄체)는 거의 완벽하고, 손레터링 말풍선은 깨진다.**

```
✅ "Night was coming on... George washington, in disguise, sought shelter from the storm"
✅ "Our story begins on a stormy evening in the westchester hills of new york, late the year of 1780..."
❌ "my nome is wh rton “му “yt thank yous іп such tul."
❌ "Tu be сай when this war гіз win, though I my sister, not of my opinion."
```

Tesseract 가 단어별로 스크립트를 자동 판별하다 손글씨를 **키릴 문자로 오인**한다(`іп` `сай` `гіз` `му`).

### ★ 검증하고 기각한 가설 — `ocr_caption` 으로 캡션만 자동 채택하기

hOCR 에 `ocr_caption`(186) · `ocr_textfloat`(26) 라인 클래스가 있어,
"이게 인쇄체 내레이션 박스일 테니 그것만 자동 채택하면 품질이 오른다"고 보고 구현·측정했다.

**정반대였다.**

```
ocr_caption 20건의 실제 내용:  "<="  "<"  "2"  "ә"  "E"  "A"  "+"  "р"
```

Tesseract 는 **컷 테두리·말풍선 꼬리 같은 잡선**을 caption 으로 라벨한다. 순수 노이즈다.
포함시키자 통과율이 **24% → 13%** 로 떨어졌다(노이즈 20건 유입, caption 통과율 0/20).

- 내레이션 박스는 그냥 `ocr_line` 으로 들어온다(위 ✅ 두 줄이 그것).
- **결론: `ocr_line` 만 쓴다.** 조사용으로 파싱은 유지하되 기본 제외(`--include-nonline` 로 재현 가능).
- 이 실패를 코드 주석과 여기에 남겨 **같은 시도를 반복하지 않게** 한다.

## 5-B. 컷 직접 OCR — `ocr-local.mjs` ✅ **A안 검증 완료**

hOCR 재활용의 천장(24%)을 넘기 위해 "언어 고정 + 컷 단위 재실행"(A안)을 구현·측정했다.
**가설이 맞았다.**

### 설정 실험 (동일 컷 `0004-c04` · 정답 대조)

| 설정 | conf | 비라틴 | 블록 | 판정 |
|---|---|---|---|---|
| PSM 6 (단일 블록) | 42 | 3 | — | 나쁨 |
| PSM 11 (sparse) + eng | 63 | 0 | 31 | 레이아웃 분석 없음 → 파편화 |
| **PSM 3 (자동 레이아웃) + eng** | **73** | **0** | **3** | **채택** |
| PSM 11 + 대문자 화이트리스트 | 25 | 0 | — | 파괴적 |

마지막 줄이 중요하다. **골든에이지 만화는 캡션 박스만 전대문자이고 말풍선은 혼합 대소문자다**
("My name is Wharton!"). 전대문자 가정은 틀렸고, 화이트리스트는 말풍선을 파괴한다.

PSM 3 은 Tesseract 자체 레이아웃 분석을 돌려 **캡션 박스를 별도 블록으로 정확히 분리**한다
(실측 블록0 conf 82 = 캡션만). 나란한 두 말풍선은 한 블록이 되므로 가로 간격으로 한 번 더 가른다.

### 실측 개선 (동일 15컷)

| 지표 | ① IA hOCR | ② 컷 직접 OCR | 변화 |
|---|---|---|---|
| 추출 대사 | 25 | **63** | ×2.5 |
| 그대로 사용 가능 | 6 | **21** | **×3.5** |
| 통과율 | 24% | **33%** | +9%p |
| **비라틴 오염** | **12** | **1** | **−92%** |

정답 대조 (`WASHINGTON MET THE MASTER OF THE HOUSE...` / `My name is Whorton! My house is
open to strangers in such weather as this!`):

```
① hOCR       Washington met the master of the hous I my nome is wh rton “му “yt thank yous іп such tul.
② 컷 직접     ASHINGTON MET THE MASTER OF THE HOUSE...
             fy name is Wharton My / louse 1s open fo strangers / in such weather as this #
```

②는 단어 수준에서 대부분 정확하다. 남은 오류는 **첫 글자 탈락**(M→fy, h→louse — 장식 드롭캡),
**o/a 혼동**(to→fo, grate→grafe), **문장부호**(!→#). 어휘 태깅에는 충분하고, 문장 그대로
노출하려면 검수가 필요한 수준이다.

### 부수 효과 — 좌표 체인이 사라진다
hOCR 경로는 원본 스캔 px → 복원 크롭·업스케일 → 컷 → 정규화를 되짚어야 했다.
컷 이미지를 직접 읽으면 좌표가 처음부터 컷 기준이라 나눗셈 한 번이면 끝난다.

### 구현 중 잡은 결함
**세로 근접만으로 줄을 묶으면 안 된다** — 컷 안에 말풍선이 좌우로 나란하면 두 풍선의 같은 높이
줄이 병합돼 대사가 지퍼처럼 뒤섞인다(`my name is wharton! My 1, than k I in house such is weat`).
가로 인접성(글자 높이 × 1.6 이내)을 함께 요구해 분리했다.

### 의존성 정책
`tesseract.js` 는 **앱 저장소 의존성에 넣지 않는다**. 파이프라인 도구는 ffmpeg 과 동일하게
외부에 격리하고 `TESSERACTJS_DIR` 로 주입한다(웹 번들에 20MB WASM 이 들어갈 이유가 없다).

### 남은 선택지 (33% → 그 이상)

| 안 | 내용 | 비용 |
|---|---|---|
| B | 멀티모달 모델에 컷 이미지 → 대사 추출 | API 비용 · 정확도 검증 |
| C | 캡션만 자동, 말풍선은 사람 입력 | 인건비 · 품질 최상 |
| E | 컷을 원본 해상도로 재크롭해 OCR (현재는 웹용 1200px) | 처리시간 |
| F | 손글씨 특화 학습 데이터로 Tesseract 파인튜닝 | 큰 투자 |

E 가 가장 싸다 — 지금은 **웹 배포용으로 축소된 1200px 컷**을 OCR 하고 있어 손해를 보고 있다.

### 남은 후처리 (미구현)
레마화 → `shared_dictionary` 매칭 → V-Level → `target_vocab`

---

## 6. Admin — 독립 큐 `/admin/pd-comics`

CCP 의 `/admin/comic` 과 **별도 화면**. 단계가 다르기 때문이다:

```
acquired → restored → segmented → ocr → review → published
```

검수 체크 3종:
- **컷 경계** — 병합/과분할 확인, 잘못된 컷 반려 → 재분할
- **가독성** — 복원 후 레터링이 폰에서 읽히는가
- **법적 근거** — PD 근거·검증자·출처URL. 미기재면 **DB 가 발행을 거부**한다

---

## 7. 학습자 제공 — 독립 면

### 7-1. 라우트 (CCP 와 분리)

| | CCP | PDCP |
|---|---|---|
| 발견 | `/library/books` 히어로 카드 | **`/library/comics`** — 복원 만화 서가 |
| 읽기 | `/text/[id]/comic` (도서 챕터 종속) | **`/comics/[slug]`** (호 단위 독립) |
| 진입 | TextViewer ModePills "만화" | 서가 카드 · 원작 도서 상세의 "이 작품의 복원 만화" |

### 7-2. PD 소재에만 필요한 것

1. **출처·라이선스 표기** — PD 여도 아카이브 출처는 밝히는 게 신뢰의 문제.
   리더 하단에 `원작 · 발행연도 · 아카이브 · PD 근거`.
2. **"복원됨" 배지** — 1945년 원본을 복원했다는 사실은 숨길 게 아니라 **파는 포인트**다.
   동시에 화질 기대치를 정직하게 세팅한다.
3. **원본 보기** — 복원본이 기본, 원본 스캔 링크 제공. 복원의 투명성.

### 7-3. 학습 통합 — PD 소재만의 전략적 이점

Classics Illustrated 는 문학 원작 각색이라 `library_books` 의 원작과 **느슨하게 묶인다**
(`pd_comic_issues.library_book_id`). 학습자는 *만화로 진입 → 원문으로 상승* 하는 계단을 밟는다.

```
복원 만화(L1 진입) → 같은 작품의 원문 TextViewer(L2) → ScriptQuiz(L5) → Dictation(L6)
```

AI 생성 만화는 이미 원작에 종속돼 있어 이 "발견 → 상승" 서사가 없다.
PD 만화는 **독립 콘텐츠로 먼저 매력적이고, 그다음 원작으로 데려간다**. 이게 분리의 제품적 이유다.

---

## 8. 스키마 ✅ dev 적용 완료 (2026-08-09)

`supabase/migrations/20260809020000_pdcp_public_domain_comics.sql` —
`pd_comic_issues` / `pd_comic_panels` 독립 테이블, RLS(발행본만 read), 학습자 RPC 3종,
`updated_at` 트리거(기존 `set_updated_at()` 규약 재사용), 그리고 **발행 게이트 DB 제약**.

### 게이트 실증 — 적용 직후 6종 검증

| 시나리오 | 결과 |
|---|---|
| PD 근거 없이 `status='published'` INSERT | **차단** (check_violation) |
| 근거·검증자·검증시각·출처URL 갖춘 INSERT | 통과 |
| 발행본에서 `pd_basis` 를 NULL 로 UPDATE | **차단** |
| `list_pd_comics()` — 미발행 호 | 0건 |
| `select_pd_comic()` — 미발행 호 | 0건 |
| `select_pd_comic_provenance()` — 미발행 호 | 0건 |

세 번째 줄이 특히 중요하다. 발행 후에 근거만 지우는 경로까지 막아야 게이트가 의미를 갖는다.

**앱 관통 확인**: `/comics/restored` 가 발행본만 노출하고 초안(`review` 상태)은 안 보인다.
리더는 출처 푸터(원작·연도·아카이브 링크·"저작권 만료")까지 정상 렌더.

> ⚠️ 검증에 쓴 시드 행(`gate-test-*`)은 전부 삭제했다 — 현재 `pd_comic_issues` 0행.

---

## 9. 구현 현황

| 단계 | 상태 |
|---|---|
| §1 소스 어댑터 (계약·IA·local-dir·IIIF·레지스트리) | ✅ 구현 |
| §1 `acquire.mjs` 정규화 취득 | ✅ 구현 · IA 실측(52p 인식, 6p 취득, hOCR 1.3MB 확보) |
| §2 법적 검증 힌트 | ✅ 구현 (판정은 사람 + DB 게이트) |
| §3 복원 | ✅ 구현 · 실소재 검증 |
| §4 컷 분할 | ⚠️ 구현 · 스토리 페이지 5/4/3컷 정상 · 캡션이 거터 가로지르면 병합 |
| §5 대사 추출(hOCR) | ⚠️ 구현 · 24% · 천장 확인 |
| §5-B 컷 직접 OCR | ✅ 구현 · **33% · 비라틴 −92%** (A안 검증) |
| §6 Admin 독립 큐 | ✅ /admin/pd-comics (단계 카운트·stepper·근거 경고) |
| §7 학습자 독립 면 | ✅ /comics/restored 서가 + [slug] 리더 (출처 푸터) |
| §8 스키마 | ✅ **dev 적용 완료** · 게이트 6종 실증 |

## 자기발전 (tune.mjs)

파라미터를 손으로 고르지 않는다. `tune.mjs` 가 산출물을 채점하고 래칫한다.

```bash
node scripts/comic/pd/tune.mjs segment --sample work/pdcp/_tune
node scripts/comic/pd/tune.mjs ocr     --sample work/pdcp/_tune
node scripts/comic/pd/tune.mjs report          # 표본별 이력 + 교차 평균
```

### 표본 만들기

`work/pdcp/<이름>/restored/` 에 복원된 페이지를 두고, 같은 폴더에 `truth.json`:

```json
{ "panelsByPage": { "0003": 7, "0005": 8 } }
```

**정답은 사람이 실제 페이지를 보고 센다.** 프록시 지표(컷 개수·커버리지)만으로 최적화하면
과분할이 이긴다 — 첫 규칙이 정답 7컷 페이지에서 9컷을 골랐다.

**만화 지면만 넣는다.** 광고·표지를 섞으면 스윕 승자가 거기 끌려간다(실측).

### 판단 규칙

- **한 표본의 1위를 그대로 믿지 않는다.** 표본마다 최적 고정값이 정반대로 나왔다.
  채택은 `report` 의 **교차 평균**으로 한다.
- 래칫 계열은 `단계:표본` 으로 나뉜다. 다른 표본의 점수끼리는 비교하지 않는다.

### 지금까지의 채택 이력

| 단계 | 이전 | 현재 | 근거 |
|---|---|---|---|
| 컷 분할 | 고정 `dilate 2` | **페이지별 적응형** | 교차 평균 -2.661 → -0.894 |
| 대사 추출 | `psm 3` | **`psm 4`** | 두 표본 모두 1위 (32.84 / 7.95) |

---

## 🚀 사용법 (구성 보존 현대화 — 채택 플로우)

> 사고방식: **스크립트=손(취득·복원·OCR·합성), Claude Code=눈·판단(현대화 판정·좌표·대사)**.
> 도구: `tools/ffmpeg/ffmpeg.exe` · `tools/tess/eng.traineddata` (로컬). Playwright chromium 은 `apps/web`(e2e).

### Phase 1 — 취득·전처리 (자동)
```bash
# (선택) 소스 발굴 → 큐 적재
node scripts/comic/pd/curate.mjs --query "whiz comics" --top 6 [--enqueue]

# 환경 점검 → 계획 → 앞 6쪽 QC → 전권
node scripts/comic/pd/pipeline.mjs --doctor
node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --dry-run
node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --test
node scripts/comic/pd/pipeline.mjs --source internet-archive --id <식별자> --out work/<slug> --record
#   pipeline = acquire → restore(ffmpeg) → segment → ocr(tesseract) → refine intake
#   소스: internet-archive · iiif · local-dir(수기 다운로드) · browser-assist
#   --record 를 붙여야 Admin 모니터에 뜬다(pd_comic_issues.qc.workDir).
```

### Phase 2 — 이미지 현대화 (색채·디자인, 구성 100% 보존)
```bash
node scripts/comic/pd/page-modern.mjs --workdir work/<slug> --level MAX
#   A(클린)<B(밸런스)<C(볼드)<MAX(플랫벡터, 최대 현대). 원작 페이지 구성 그대로.
#   결과: work/<slug>/page-modern/*.jpg + compare_preview.jpg(원작|결과)
```

### Phase 3 — 내용(대사) 현대화
```bash
# 대사 확보: OCR 자동분은 refine, OCR 누락분은 Claude Code 비전 전사
node scripts/comic/pd/refine.mjs --intake work/<slug>   # → refine.intake.json
#   Claude Code 가 refine.output.json 작성(모던 i+1) 후:
node scripts/comic/pd/refine.mjs --ingest work/<slug>   # → bubbles.refined.manifest.json

# 말풍선 좌표+대사 스펙 작성 = Claude Code 가 각 페이지를 보고 직접(OCR 좌표 신뢰 불가)
#   좌표 판독: page-modern 이미지에 10% 그리드 오버레이(ffmpeg)로 보고 비율(0~1) 지정
#   → work/<slug>/letter.spec.json  { "<page>": [{type:'balloon'|'caption', x,y,w,h, text}] }
```

### Phase 4 — 리더 생성·검증 (test → fix → verify)
```bash
node scripts/comic/pd/page-html.mjs --workdir work/<slug>      # → page-html/reader.html
node scripts/comic/pd/render-check.cjs --workdir work/<slug>   # Playwright 렌더 스크린샷
#   Claude Code 가 renders/pNN.png 판정 → 어긋난 좌표는 letter.spec.json 숫자만 수정 → 재실행
#   (이미지 재작업 없이 좌표 수렴 — HTML 오버레이의 핵심 장점)
```

### Phase 5 — 모니터링·자기발전 기록
```bash
node scripts/comic/pd/oplog.mjs --slug <slug> --content "<제목>" \
  --phase page-modern --action improve|adopt|reject|pivot|evaluate|note \
  --title "..." --detail "..." --verdict "..." --next "..."
#   → work/_oplog.jsonl → Admin 모니터 최상단 '자기발전 타임라인'
```
Admin: `/admin/pd-comics` → **테스트·모니터** → 이슈행 **라이브 진행**(원본·복원·컷 + 현대화 산출물)
· **모던 리더 ↗**(발행 전 preview: 이미지+모던 대사+TTS+단어뜻).

### 발행 (학습자)
PD 근거(`pd_basis`) 확정 후 학습자 서가 `/comics/restored/<slug>` 로. 그 전엔 admin preview 까지.

**대안(비채택, 참고)**: `webtoon.mjs`(세로 리플로우—구성 변경) · `dialogue-below.mjs`(컷 아래 대사 바) · `page-letter.mjs`/`reletter.mjs`(원작 위 래스터 레터링—좌표 취약 반려).
