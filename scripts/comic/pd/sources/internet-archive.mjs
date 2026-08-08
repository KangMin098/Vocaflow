// scripts/comic/pd/sources/internet-archive.mjs
//
// Internet Archive 어댑터 — PD 만화 소스 중 **유일하게 완전 자동화가 가능한** 곳.
//
// 실측(2026-08):
//   · 검색   advancedsearch.php?output=json  → 인증 없이 다건 조회
//   · 메타   /metadata/<id>                  → 파일 목록·서버·디렉터리 전부 노출
//   · 페이지 /download/<id>/page/nN_w1200.jpg → 임의 폭 JPEG 즉시 생성(302 → 이미지)
//   · OCR    <base>_hocr.html                → **단어 단위 bbox** 포함 (1.3MB/호)
//
// hOCR 이 있다는 게 결정적이다. 다른 소스는 OCR 엔진을 붙여야 하지만 IA 는 좌표까지 딸린
// 텍스트를 그냥 받아온다 → 컷 bbox 와 교집합만 내면 말풍선 텍스트가 바로 나온다.
//
// 예의: IA 는 공개 API 를 관대하게 열어두지만 무제한은 아니다. 동시 2, 간격 250ms 로 제한한다.

import fs from 'node:fs'
import path from 'node:path'

import { buildQuery, PD_YEAR_CUTOFF, rankByPdRisk, sortParam, yearFromTitle } from './discovery.mjs'
import { delay, usPdHint } from './types.mjs'

const UA = 'Vocaflow-PDCP/1.0 (educational; contact via repo)'

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`IA ${res.status} ${url}`)
  return res.json()
}

/** IA 는 파일이 나뉘어 있어 "본문 이미지 묶음"의 베이스 이름을 찾아야 한다. */
function findBase(files) {
  const jp2 = files.find((f) => /_jp2\.zip$/.test(f.name))
  if (jp2) return jp2.name.replace(/_jp2\.zip$/, '')
  const pdf = files.find((f) => /\.pdf$/i.test(f.name) && !/_text\.pdf$/i.test(f.name))
  return pdf ? pdf.name.replace(/\.pdf$/i, '') : null
}

export const internetArchive = {
  id: 'internet-archive',
  label: 'Internet Archive',

  caps: {
    discovery: 'api',
    auth: 'none',
    unit: 'page-images',
    bulk: true,
    ocr: true,
    ocrBoxes: true, // hOCR — 단어 단위 좌표
    minDelayMs: 250,
    concurrency: 2,
  },

  // IA 스캐너가 이미 디스큐·크롭을 해둔다 → 복원을 약하게. OCR 은 소스 것을 쓴다.
  profile: {
    needsCrop: true, // 그래도 분홍/회색 스캔대 여백이 남는 경우가 있어 켜둔다(실측)
    needsDeskew: false,
    saturation: 1.22,
    upscale: 2,
    denoise: true,
    segmentAnalysis: 1100,
    segmentDilate: 2,
    ocrStrategy: 'source-hocr',
  },

  /**
   * 한 번에 훑을 만한 출발점. 자유 검색은 관련 없는 도서를 끌고 오므로
   * **PD 확률이 높은 컬렉션**을 미리 세어두고 클릭 한 번으로 들어가게 한다.
   * `count` 는 실측값(2026-08-09) — 표시용이며 실제 건수는 검색 때 다시 센다.
   */
  presets: [
    {
      key: 'fawcett',
      label: 'Fawcett Comics (큐레이션)',
      note: 'Captain Marvel 계열. 사서 큐레이션 컬렉션 — PD 확률 높음',
      filters: { collection: 'fawcett-comics' },
      count: 813,
    },
    {
      key: 'classics-illustrated',
      label: 'Classics Illustrated',
      note: '고전 각색 만화 — 학습 소재 적합도가 가장 높다',
      query: 'classics illustrated',
      filters: { sort: 'year-asc' },
      count: 29,
    },
    {
      key: 'golden-age-pd',
      label: '골든에이지 PD 확정 구간',
      note: `${PD_YEAR_CUTOFF}년 이하 — 미국 기준 저작권 소멸 확정`,
      filters: { yearTo: PD_YEAR_CUTOFF, sort: 'downloads' },
    },
  ],

  /**
   * @param {string} q
   * @param {number} limit
   * @param {import('./discovery.mjs').DiscoveryFilters=} filters
   *
   * 정교화 항목(초기 한 줄 질의 대비):
   *   · 제목 우선 질의 — 전문 검색이 만화책 OCR 본문에 걸려 엉뚱한 도서를 올리던 문제
   *   · 컬렉션/연도 필터 · 정렬 · 페이지네이션
   *   · **PD 위험도 판정 후 재정렬** — 저작권 살아 있는 자료가 상단에 오지 않게
   *   · 표지 1장짜리 잡항목 제거(minPages)
   */
  async search(q, limit = 20, filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1)
    const params = new URLSearchParams({
      q: buildQuery(q, filters),
      rows: String(limit),
      page: String(page),
      output: 'json',
    })
    const sort = sortParam(filters.sort)
    if (sort) params.set('sort[]', sort)
    const url =
      'https://archive.org/advancedsearch.php?' +
      params +
      '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=date&fl%5B%5D=imagecount' +
      '&fl%5B%5D=collection&fl%5B%5D=creator&fl%5B%5D=downloads'
    const j = await getJson(url)

    let items = (j.response?.docs ?? []).map((d) => ({
      sourceId: this.id,
      identifier: d.identifier,
      title: d.title ?? d.identifier,
      // 셋 다 없으면 PD 판정이 '불명'으로 떨어져 운영자가 원본을 열어야 한다 → 제목까지 훑는다
      publishedYear:
        Number(d.year) ||
        Number(String(d.date ?? '').slice(0, 4)) ||
        yearFromTitle(d.title) ||
        undefined,
      pageCount: Number(d.imagecount) || undefined,
      url: `https://archive.org/details/${d.identifier}`,
      raw: d,
    }))

    // imagecount 가 있는데 표지 몇 장뿐인 항목은 만화 한 호가 아니다.
    // (없으면 거르지 않는다 — 이 컬렉션은 imagecount 가 비는 경우가 흔하다)
    const minPages = Number(filters.minPages) || 0
    if (minPages > 0) {
      items = items.filter((it) => it.pageCount == null || it.pageCount >= minPages)
    }

    const ranked = rankByPdRisk(items)
    ranked.totalFound = Number(j.response?.numFound) || ranked.length
    ranked.page = page
    return ranked
  },

  /**
   * jp2.zip 내부 목록으로 페이지 수를 센다.
   * IA 는 zip 경로 끝에 `/` 를 붙이면 내부 엔트리를 HTML 로 나열해준다 —
   * 40MB zip 을 받지 않고도 페이지 수를 알 수 있는 유일한 안정 경로다.
   * (metadata 의 imagecount 는 이 컬렉션에서 비어 있는 경우가 많다 — 실측)
   */
  async countPagesInZip(identifier, base) {
    const url = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(`${base}_jp2.zip`)}/`
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!res.ok) return undefined
    const html = await res.text()
    // 같은 엔트리가 링크 href·링크 텍스트에 여러 번, 그리고 **URL 인코딩된 형태로도** 나온다.
    // 실측 함정: `%2F` 를 그대로 두고 파일명만 뽑으면 `2FFoo_0000.jp2` 와 `Foo_0000.jp2` 가
    // 서로 다른 이름으로 잡혀 52장이 104장이 된다. 먼저 인코딩을 풀고 basename 으로 유니크화한다.
    const decoded = html.replace(/%2F/gi, '/')
    const names = new Set(
      (decoded.match(/[^/"'<>\s]+\.jp2/g) ?? []).map((s) => s.split('/').pop()),
    )
    return names.size > 0 ? names.size : undefined
  },

  async metadata(identifier) {
    const j = await getJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`)
    const m = j.metadata ?? {}
    const files = j.files ?? []
    const year = Number(String(m.year ?? m.date ?? '').slice(0, 4)) || undefined
    // "Classics Illustrated -027- The Spy" 같은 제목에서 호수를 뽑는다
    const issueNo = Number(String(m.title ?? '').match(/-0*(\d{1,3})-/)?.[1]) || undefined
    const base = findBase(files)
    // 주의: 파일 목록에는 `__ia_thumb.jpg` 같은 아이템 타일이 섞여 있다.
    // 이걸 페이지로 세면 "1페이지짜리 호"가 되어 취득이 조용히 1장만 하고 끝난다(실측 버그).
    // 낱장 이미지가 3장 미만이면 페이지 세트가 아니라고 보고 zip 목록으로 넘어간다.
    const looseImages = files.filter(
      (f) => /\.(jpe?g|jp2)$/i.test(f.name) && !f.name.startsWith('__'),
    ).length
    const imgCount =
      Number(m.imagecount) ||
      (looseImages >= 3 ? looseImages : undefined) ||
      (base ? await this.countPagesInZip(identifier, base) : undefined) ||
      undefined
    return {
      sourceId: this.id,
      identifier,
      title: m.title ?? identifier,
      seriesTitle: String(m.title ?? '').split('-')[0].trim() || undefined,
      issueNo,
      publishedYear: year,
      pageCount: imgCount,
      url: `https://archive.org/details/${identifier}`,
      raw: { metadata: m, base, fileCount: files.length },
    }
  },

  /**
   * 페이지 참조 — IA 의 `/page/nN_w<width>.jpg` 서비스를 쓴다.
   * jp2.zip 전체(40MB+)를 받아 풀 필요가 없고, 원하는 폭으로 바로 받는다.
   */
  async pages(identifier, { width = 1600, count } = {}) {
    const meta = await this.metadata(identifier)
    const n = count ?? meta.pageCount
    if (!n) throw new Error(`페이지 수를 알 수 없습니다: ${identifier}`)
    return Array.from({ length: n }, (_, i) => ({
      index: i,
      kind: 'url',
      locator: `https://archive.org/download/${encodeURIComponent(identifier)}/page/n${i}_w${width}.jpg`,
      ext: 'jpg',
    }))
  },

  async fetchPage(ref, outFile) {
    await delay(this.caps.minDelayMs)
    const res = await fetch(ref.locator, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!res.ok) throw new Error(`IA page ${res.status} ${ref.locator}`)
    const buf = Buffer.from(await res.arrayBuffer())
    // IA 는 없는 페이지에도 200 + 안내 이미지를 주는 경우가 있어 최소 크기로 거른다
    if (buf.length < 8 * 1024) throw new Error(`페이지가 비정상적으로 작습니다(${buf.length}B): ${ref.locator}`)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, buf)
    return outFile
  },

  /** hOCR 원본을 받아둔다 — 단어 좌표 파싱은 하류(ocr 단계)에서. */
  async fetchOcr(identifier, outFile) {
    const j = await getJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`)
    const base = findBase(j.files ?? [])
    if (!base) return null
    const url = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(`${base}_hocr.html`)}`
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!res.ok) return null
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()))
    return outFile
  },

  pdHint(item) {
    // IA 는 PD 만 모아둔 곳이 아니다 — 컬렉션에 있다는 사실이 PD 를 뜻하지 않는다.
    return usPdHint(item.publishedYear)
  },
}
