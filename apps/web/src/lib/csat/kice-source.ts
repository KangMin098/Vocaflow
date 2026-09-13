// apps/web/src/lib/csat/kice-source.ts
//
// **회차 → 평가원 원본이 있는 곳.**
//
// 왜 표로 들고 있나 — 학습자가 「이 문항의 원본을 열어 달라」고 했을 때 우리가 줄 수 있는 것은
// **링크**뿐이다. 파일을 우리 서버로 받아 다시 내보내면(프록시) 그 순간 **우리가 전송하는 것**이
// 되어, `csat_items` 의 RLS 로 그어 둔 경계와 같은 선을 화면이 넘는다.
//
// ── 왜 직접 링크가 한 회차뿐인가 (실측 2026-09-13) ────────────────────
// 평가원 기출문제 게시판(`boardID=1500234`)에는 **가장 최근 수능만** 올라 있다 — 실측 10행
// (2026 수능 8과목 + 2025 2행)이고 페이저 markup 이 없다. 옛 회차 archive 였던
// `old.suneung.re.kr` 은 **DNS 가 안 풀린다**. 그래서 나머지 회차의 직접 파일 URL 은
// 공개 목록에서 기계적으로 얻을 수 없다.
//
// ⚠️ **크롤링으로 메우지 않는다.** `www.suneung.re.kr/robots.txt` 는 `User-agent: * / Disallow: /`
//    다. 사람이 한 번 눌러 여는 것과 우리가 긁어 모으는 것은 다른 행위다. 직접 링크가 없는
//    회차는 **목록 링크**를 주고 사람이 고르게 한다 — 한 걸음 늘지만 우리가 넘을 선이 없다.
//
// 직접 링크를 채우려면: 평가원 그 회차 글에서 `영어영역_문제지.pdf` 의 `fileSeq` 를 복사해
// 아래 표에 한 줄 더한다(크롤링이 아니라 사람이 옮기는 것이다).

/** 기출문제 게시판 — 직접 링크가 없는 회차는 여기로 보낸다 */
export const KICE_ARCHIVE_URL =
  'https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung'

/** 모의평가는 기출문제 게시판이 아니라 학사 일정·자료 쪽에 흩어져 있다 */
export const KICE_MOCK_URL = 'https://www.suneung.re.kr/sub/info.do?m=0201&s=suneung'

/**
 * 회차 → 문제지 PDF 직접 URL.
 *
 * `fileSeq` 는 평가원이 파일마다 붙인 32자 hex 다. 값은 사람이 확인해 옮긴 것이고,
 * 대조 기준은 **해시**다 — `lib/csat/anchor-data/<회차>.json` 의 `sha256` 과 같은 파일이어야
 * 좌표가 맞는다(2026: `788830081bb2a3ad…` · 2026-09-13 에 실제로 내려받아 대조했다).
 */
const PAPER_FILE_SEQ: Record<string, string> = {
  '2026': 'e0431cad0731556faee928fd38c81241',
}

export interface KiceSource {
  /** 그 문제지 PDF 를 바로 여는 링크. 없으면 null */
  paperUrl: string | null
  /** 사람이 찾아 들어갈 목록 — `paperUrl` 이 없을 때의 다음 걸음 */
  listUrl: string
  /** 왜 직접 링크가 없는지 — 화면이 그대로 말할 수 있게 */
  reason: string | null
}

export function kiceSourceOf(examId: string): KiceSource {
  const seq = PAPER_FILE_SEQ[examId]
  if (seq) {
    return {
      paperUrl: `https://www.suneung.re.kr/boardCnts/fileDown.do?fileSeq=${seq}`,
      listUrl: KICE_ARCHIVE_URL,
      reason: null,
    }
  }
  const isMock = examId.startsWith('M')
  return {
    paperUrl: null,
    listUrl: isMock ? KICE_MOCK_URL : KICE_ARCHIVE_URL,
    reason: isMock
      ? '모의평가 문제지는 기출문제 게시판이 아니라 회차별 안내에 흩어져 있어요'
      : '평가원 기출문제 게시판에는 가장 최근 수능만 올라 있어요',
  }
}

/**
 * 브라우저 PDF 뷰어에게 **그 쪽부터 열라**고 말하는 조각.
 *
 * cross-origin iframe 이라 우리가 뷰어 속을 읽을 수는 없지만, **여는 순간의 쪽**은 정할 수 있다.
 * 그래서 「링크로 열기」가 목록 맨 앞이 아니라 **그 문항 자리**에서 시작한다.
 * `zoom=page-width` 는 2단 조판이 좁은 화면에서 글자가 깨지지 않게 한다.
 */
export function pdfFragment(page: number): string {
  return `#page=${page}&zoom=page-width`
}
