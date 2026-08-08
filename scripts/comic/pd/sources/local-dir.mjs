// scripts/comic/pd/sources/local-dir.mjs
//
// 로컬 디렉터리 어댑터 — **자동 취득이 불가능하거나 허용되지 않는 소스의 정식 경로**.
//
// 왜 필요한가 (실측):
//   Digital Comic Museum · Comic Book Plus 는 둘 다 HTTP 403 으로 봇을 차단하고
//   계정 로그인 뒤 호 단위 ZIP 다운로드만 허용한다. 우회 크롤링은
//   ① 이용약관 위반이고 ② 차단당하면 파이프라인 전체가 죽으며 ③ 법적 위험을 만든다.
//
//   그래서 이 어댑터는 "사람이 브라우저로 정상 다운로드한 파일"을 파이프라인에 넣는
//   **1급 경로**다. 우회를 시도하는 대신, 수동 취득을 설계에 정식 편입한다.
//
// 사용:
//   1) 사람이 소스 사이트에서 호를 내려받아 압축을 푼다
//   2) <dir>/source.json 에 출처·법적 근거를 적는다 (아래 스키마)
//   3) node acquire.mjs --source local-dir --id <dir> --out intake/<slug>
//
// source.json 예:
//   {
//     "sourceArchive": "digital-comic-museum",
//     "identifier": "12345",
//     "url": "https://digitalcomicmuseum.com/index.php?dlid=12345",
//     "title": "Adventures Into Darkness #5",
//     "seriesTitle": "Adventures Into Darkness",
//     "issueNo": 5,
//     "publishedYear": 1952,
//     "pdBasis": "no-renewal",
//     "pdEvidenceUrl": "https://onlinebooks.library.upenn.edu/cce/...",
//     "acquiredBy": "manual-download",
//     "acquiredAt": "2026-08-08"
//   }

import fs from 'node:fs'
import path from 'node:path'

const IMG_RE = /\.(jpe?g|png|tif?f|webp)$/i

function readSidecar(dir) {
  const f = path.join(dir, 'source.json')
  if (!fs.existsSync(f)) {
    throw new Error(
      `source.json 이 없습니다: ${f}\n` +
        '수동 취득 소재는 출처·PD 근거를 반드시 함께 적어야 파이프라인에 들어갈 수 있습니다.',
    )
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'))
}

export const localDir = {
  id: 'local-dir',
  label: '로컬 디렉터리 (수동 취득)',

  caps: {
    discovery: 'manual',
    auth: 'none', // 인증은 사람이 브라우저에서 이미 통과함
    unit: 'page-images',
    bulk: false, // 호 단위 수동
    ocr: false,
    ocrBoxes: false,
    minDelayMs: 0,
    concurrency: 8, // 로컬 파일 복사
  },

  // 원본 스캔 그대로인 경우가 많다 → 복원을 강하게, OCR 은 직접 돌려야 한다.
  profile: {
    needsCrop: true,
    needsDeskew: true,
    saturation: 1.28,
    upscale: 2,
    denoise: true,
    segmentAnalysis: 1100,
    segmentDilate: 2,
    ocrStrategy: 'own-ocr',
  },

  async search() {
    throw new Error('local-dir 는 검색을 지원하지 않습니다 — 디렉터리 경로를 --id 로 지정하세요.')
  },

  async metadata(dir) {
    const s = readSidecar(dir)
    const pages = fs.readdirSync(dir).filter((f) => IMG_RE.test(f))
    return {
      sourceId: this.id,
      identifier: s.identifier ?? path.basename(dir),
      title: s.title ?? path.basename(dir),
      seriesTitle: s.seriesTitle,
      issueNo: s.issueNo,
      publishedYear: s.publishedYear,
      url: s.url ?? '',
      pageCount: pages.length,
      raw: s,
    }
  },

  async pages(dir) {
    return fs
      .readdirSync(dir)
      .filter((f) => IMG_RE.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f, i) => ({ index: i, kind: 'file', locator: path.join(dir, f), ext: path.extname(f).slice(1) }))
  },

  async fetchPage(ref, outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.copyFileSync(ref.locator, outFile)
    return outFile
  },

  async fetchOcr() {
    return null // 소스가 OCR 을 주지 않는다 → ocrStrategy: 'own-ocr'
  },

  pdHint(item) {
    const s = item.raw ?? {}
    if (s.pdBasis) {
      return { basis: s.pdBasis, note: `source.json 에 사람이 기재한 근거 (${s.pdEvidenceUrl ?? '링크 없음'})` }
    }
    return { basis: null, note: 'source.json 에 pdBasis 가 없습니다 — 발행 게이트에서 차단됩니다.' }
  },
}
