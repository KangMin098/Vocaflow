// scripts/comic/pd/sources/types.mjs
//
// 소스 어댑터 계약 — PD 만화 사이트마다 취득 방식이 근본적으로 다르다는 사실을 구조로 흡수한다.
//
// 실측한 차이 (2026-08):
//   Internet Archive  검색 API + 메타 JSON + 페이지 이미지 서비스 + **단어단위 hOCR** 제공
//   Digital Comic Museum  HTTP 403 (봇 차단) · 계정 로그인 필요 · 호 단위 ZIP · OCR 없음
//   Comic Book Plus       HTTP 403 · 계정 필요 · 호 단위 다운로드 · OCR 없음
//   IIIF 계열(도서관·박물관)  표준 manifest + 타일/리전 요청 · 다운로드 개념이 없음
//
// 이 차이는 "취득"에서 끝나지 않는다. IA 는 스캐너가 이미 디스큐/크롭을 해두었고 OCR 도 있으니
// 복원 강도를 낮추고 OCR 단계를 건너뛴다. DCM 원본 스캔은 여백·기울기가 살아 있어 풀 복원이 필요하고
// OCR 을 직접 돌려야 한다. 그래서 어댑터는 **취득 방법**과 **하류 파이프라인 프로파일**을 함께 선언한다.
//
// 설계 원칙: 어댑터가 정규화하고, 정규화 이후 파이프라인(복원→분할→OCR→적재)은 소스를 모른다.

/**
 * @typedef {object} SourceCapabilities
 * @property {'api'|'scrape'|'manual'|'iiif'} discovery  후보 검색 방식
 * @property {'none'|'account'|'apikey'}      auth        인증 요구
 * @property {'page-images'|'archive'|'pdf'|'iiif-tiles'} unit  취득 단위
 * @property {boolean} bulk        다건 자동 취득이 정책상 허용되는가
 * @property {boolean} ocr         소스가 OCR 산출물을 제공하는가
 * @property {boolean} ocrBoxes    OCR 에 단어 단위 좌표가 있는가 (말풍선 매핑 가능)
 * @property {number}  minDelayMs  요청 간 최소 간격 (예의 · 차단 회피)
 * @property {number}  concurrency 동시 요청 상한
 */

/**
 * 하류 파이프라인에 주는 힌트. 소스마다 스캔 품질과 전처리 상태가 달라서
 * 같은 복원 파라미터를 쓰면 어떤 소스는 과보정되고 어떤 소스는 미보정된다.
 *
 * @typedef {object} PipelineProfile
 * @property {boolean} needsCrop     스캔대 여백 제거가 필요한가 (IA 는 이미 크롭됨)
 * @property {boolean} needsDeskew   기울기 보정이 필요한가
 * @property {number}  saturation    복원 채도 기본값
 * @property {number}  upscale       업스케일 배수
 * @property {boolean} denoise       망점 제거 여부
 * @property {number}  segmentAnalysis  컷 분할 분석 해상도
 * @property {number}  segmentDilate    컷 분할 배경 팽창
 * @property {'source-hocr'|'source-text'|'own-ocr'} ocrStrategy
 */

/**
 * 정규화된 아이템 메타 — 어댑터가 사이트별 스키마를 이 형태로 접어 넣는다.
 *
 * @typedef {object} SourceItem
 * @property {string}  sourceId       어댑터 키 (예: 'internet-archive')
 * @property {string}  identifier     소스 내 고유 id
 * @property {string}  title
 * @property {string=} seriesTitle
 * @property {number=} issueNo
 * @property {number=} publishedYear
 * @property {string}  url            사람이 볼 수 있는 원 페이지
 * @property {number=} pageCount
 * @property {object=} raw            원본 메타 (감사용)
 */

/**
 * 페이지 하나를 가리키는 참조. URL 직접 취득일 수도, 아카이브 내부 경로일 수도 있다.
 *
 * @typedef {object} PageRef
 * @property {number} index   0-base 페이지 순번
 * @property {string} kind    'url' | 'archive-entry' | 'iiif-region'
 * @property {string} locator URL 또는 엔트리 경로
 * @property {string=} ext
 */

/**
 * @typedef {object} SourceAdapter
 * @property {string} id
 * @property {string} label
 * @property {SourceCapabilities} caps
 * @property {PipelineProfile} profile
 * @property {(q: string, limit?: number) => Promise<SourceItem[]>} search
 * @property {(identifier: string) => Promise<SourceItem>} metadata
 * @property {(identifier: string) => Promise<PageRef[]>} pages
 * @property {(ref: PageRef, outFile: string) => Promise<string>} fetchPage
 * @property {(identifier: string, outFile: string) => Promise<string|null>} fetchOcr
 * @property {(item: SourceItem) => { basis: string|null, note: string }} pdHint
 */

/** 요청 간 최소 간격 — 어느 소스든 예의를 지킨다(차단·법적 위험 회피). */
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * PD 판정 힌트 — 미국 저작권 기준. **자동 판정이 아니라 사람 검증의 출발점**이다.
 * 최종 판정은 사람이 갱신 기록을 확인해 입력한다(발행 게이트에서 DB 제약으로 강제).
 */
export function usPdHint(year) {
  if (!year) return { basis: null, note: '발행연도 불명 — 수동 확인 필요' }
  if (year <= 1929) return { basis: 'pre-1929', note: `${year}년 발행 — 미국 기준 PD 확정` }
  if (year <= 1963) {
    return {
      basis: null,
      note: `${year}년 발행 — 저작권 **갱신 여부** 확인 필요. 갱신 기록 없으면 PD, 있으면 사용 불가.`,
    }
  }
  return { basis: null, note: `${year}년 발행 — 자동 갱신 대상. 사용 불가로 간주.` }
}
