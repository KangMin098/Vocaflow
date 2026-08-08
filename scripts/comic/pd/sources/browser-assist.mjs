// scripts/comic/pd/sources/browser-assist.mjs
//
// 브라우저 보조 취득 — **자동 크롤링이 불가능하거나 금지된 소스를 반자동으로 처리한다.**
//
// 왜 이게 필요한가 (실측 2026-08-09):
//   Digital Comic Museum   HTTP 403 (일반 클라이언트 차단) · 무료 계정 로그인 필수
//   Comic Book Plus        robots.txt 가 `ClaudeBot`·`anthropic-ai` 를 **전면 Disallow**,
//                          목록/벌크 엔드포인트도 전부 Disallow
//   Library of Congress    Cloudflare 챌린지 ("Just a moment…")
//   HathiTrust             다운로드 403
//   → 이 소스들에 스크래퍼를 붙이는 것은 운영자가 명시한 거부를 뚫는 일이다. 하지 않는다.
//
// 대신 **사람이 운전한다**. 이 어댑터는 진짜 브라우저 창을 띄우고, 사람이 로그인하고
// 원하는 호를 골라 다운로드를 누르면 그 결과물만 자동으로 받아 정규화한다.
//   · 사이트 규칙 위반 없음 — 요청을 만드는 주체가 사람이다
//   · 그래도 자동화 이득은 남는다 — 저장 위치·압축 해제·페이지 정렬·매니페스트가 자동
//   · 로그인 세션은 프로필 디렉터리에 남아 다음 회차에 다시 로그인하지 않는다
//
// 즉 "수기"에서 자동화할 수 있는 부분(파일 정리·정규화)만 자동화하고,
// 자동화하면 안 되는 부분(사이트 접근 판단)은 사람에게 남긴다.

import fs from 'node:fs'
import path from 'node:path'

import { usPdHint } from './types.mjs'

/**
 * 사람이 자주 가는 출발점. 여기 있는 사이트는 **자동 수집 대상이 아니라 방문 대상**이다.
 * `policy` 는 왜 자동화하지 않는지를 화면에 그대로 보여주기 위한 것 —
 * 근거 없이 "수동"이라고만 하면 다음 사람이 스크래퍼를 붙이려 든다.
 */
export const ASSIST_SITES = [
  {
    key: 'dcm',
    label: 'Digital Comic Museum',
    url: 'https://digitalcomicmuseum.com/',
    policy: '일반 클라이언트에 403 · 무료 계정 로그인 필요. 로그인 후 CBZ 다운로드.',
    unit: 'cbz',
  },
  {
    key: 'cbp',
    label: 'Comic Book Plus',
    url: 'https://comicbookplus.com/',
    policy:
      'robots.txt 가 ClaudeBot·anthropic-ai 를 전면 차단하고 목록 엔드포인트도 Disallow. 자동 수집 금지 — 사람이 직접 내려받는다.',
    unit: 'cbz',
  },
  {
    key: 'loc',
    label: 'Library of Congress',
    url: 'https://www.loc.gov/collections/?q=comic',
    policy: 'Cloudflare 챌린지로 API 접근 차단. 브라우저에서 직접 내려받는다.',
    unit: 'images',
  },
  {
    key: 'hathitrust',
    label: 'HathiTrust',
    url: 'https://babel.hathitrust.org/',
    policy: '다운로드 403 · 기관 로그인 필요. 전체보기(full view) 자료만 해당.',
    unit: 'pdf',
  },
]

export const browserAssist = {
  id: 'browser-assist',
  label: '브라우저 보조 (사람이 로그인·선택)',

  caps: {
    discovery: 'browser',
    auth: 'account',
    // 받아오는 물건이 사이트마다 다르다(CBZ·ZIP·PDF·낱장). 취득 후 정규화가 흡수한다.
    unit: 'archive',
    // **자동 대량 취득 아님.** 사람이 한 건씩 고른다. 검색 API 로 노출되면 안 된다.
    bulk: false,
    ocr: false,
    ocrBoxes: false,
    minDelayMs: 0,
    concurrency: 1,
    /** 이 어댑터만의 표식 — 콘솔이 '검색' 대신 '브라우저 열기'를 보여주는 근거. */
    assisted: true,
  },

  // 원본 스캔이라 IA 처럼 전처리돼 있지 않다 → 풀 복원 + 자체 OCR.
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

  sites: ASSIST_SITES,

  async search() {
    throw new Error(
      '브라우저 보조 소스는 검색으로 찾지 않습니다. ' +
        'Admin 에서 "브라우저 열기"로 세션을 시작하거나 CLI 로 `node scripts/comic/pd/assist.mjs --site <key>` 를 실행하세요.',
    )
  },

  /**
   * 이미 받아둔 취득물의 메타. 사람이 브라우저로 가져온 것이라
   * 제목·연도는 파일명과 사람이 입력한 값에서 온다.
   */
  async metadata(identifier) {
    const dir = path.resolve(identifier)
    const mfPath = path.join(dir, 'assist.manifest.json')
    if (!fs.existsSync(mfPath)) {
      throw new Error(
        `브라우저 보조 취득물이 아닙니다: ${dir}\n` +
          '먼저 `node scripts/comic/pd/assist.mjs` 로 세션을 진행하세요.',
      )
    }
    const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'))
    return {
      sourceId: this.id,
      identifier: dir,
      title: mf.title ?? path.basename(dir),
      publishedYear: mf.publishedYear ?? undefined,
      pageCount: mf.pageCount ?? undefined,
      url: mf.originUrl ?? '',
      raw: mf,
    }
  },

  async pages(identifier) {
    const dir = path.join(path.resolve(identifier), 'pages')
    if (!fs.existsSync(dir)) throw new Error(`페이지 디렉터리 없음: ${dir}`)
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|jp2|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      .map((f, i) => ({
        index: i,
        kind: 'file',
        locator: path.join(dir, f),
        ext: path.extname(f).slice(1),
      }))
  },

  async fetchPage(ref, outFile) {
    fs.copyFileSync(ref.locator, outFile)
    return outFile
  },

  /** 사람이 받은 스캔에 OCR 이 딸려 오는 경우는 없다. */
  async fetchOcr() {
    return null
  },

  pdHint(item) {
    const h = usPdHint(item.publishedYear)
    return {
      basis: h.basis,
      note: `${h.note} · 사람이 직접 취득 — 출처 사이트의 PD 표기를 근거로 남기세요.`,
    }
  },
}
