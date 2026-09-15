// scripts/comic/pd/sources/iiif.mjs
//
// IIIF 어댑터 — 도서관·박물관·대학 아카이브 다수가 쓰는 **표준** 프로토콜.
// (Library of Congress · HathiTrust · Europeana · 각국 국립도서관 등)
//
// IA/DCM 과 근본적으로 다른 점:
//   "파일을 내려받는다"는 개념이 없다. manifest 가 canvas 목록을 주고,
//   각 canvas 의 Image API 엔드포인트에 **원하는 리전/크기**를 요청해 이미지를 생성받는다.
//     {image}/{region}/{size}/{rotation}/{quality}.{format}
//     예: .../full/1600,/0/default.jpg
//
// 그래서 이 어댑터는 다른 어댑터와 달리 "폭"을 URL 문법으로 표현한다.
// 한 소스에 하나씩 어댑터를 만들 필요가 없다 — manifest URL 만 주면 어디든 붙는다.
//
// 사용:
//   node acquire.mjs --source iiif --id "https://.../manifest.json" --out intake/<slug>

import fs from 'node:fs'
import path from 'node:path'

import { delay, usPdHint } from './types.mjs'

const UA = 'Vocaflow-PDCP/1.0 (educational)'

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`IIIF ${res.status} ${url}`)
  return res.json()
}

/** Presentation API 2.x 와 3.x 의 canvas 구조가 다르다 — 둘 다 받는다. */
function canvasesOf(manifest) {
  // 3.x
  if (Array.isArray(manifest.items)) {
    return manifest.items
      .filter((c) => c.type === 'Canvas' || c['@type'] === 'sc:Canvas')
      .map((c) => {
        const body = c.items?.[0]?.items?.[0]?.body
        const svc = Array.isArray(body?.service) ? body.service[0] : body?.service
        return { id: svc?.id ?? svc?.['@id'] ?? body?.id, label: c.label }
      })
      .filter((c) => c.id)
  }
  // 2.x
  const seq = manifest.sequences?.[0]?.canvases ?? []
  return seq
    .map((c) => {
      const res = c.images?.[0]?.resource
      const svc = res?.service
      return { id: svc?.['@id'] ?? res?.['@id'], label: c.label }
    })
    .filter((c) => c.id)
}

export const iiif = {
  id: 'iiif',
  label: 'IIIF (도서관·박물관 표준)',

  caps: {
    discovery: 'iiif',
    auth: 'none', // 기관에 따라 apikey 가 필요할 수 있음
    unit: 'iiif-tiles',
    bulk: true,
    ocr: false, // 기관에 따라 별도 ALTO/hOCR 를 제공하기도 한다
    ocrBoxes: false,
    minDelayMs: 400, // 기관 서버는 IA 보다 약하다 — 더 보수적으로
    concurrency: 1,
  },

  // IIIF 는 원본 마스터에서 리전을 잘라주므로 스캔대 여백이 없는 경우가 많고 품질이 높다.
  profile: {
    needsCrop: false,
    needsDeskew: false,
    saturation: 1.15, // 이미 색보정된 마스터가 많다 → 약하게
    upscale: 1, // 원하는 해상도로 직접 요청 → 업스케일 불필요
    denoise: true,
    segmentAnalysis: 1100,
    segmentDilate: 2,
    ocrStrategy: 'own-ocr',
  },

  async search() {
    throw new Error('IIIF 는 통합 검색이 없습니다 — 기관 카탈로그에서 manifest URL 을 찾아 --id 로 주세요.')
  },

  async metadata(manifestUrl) {
    const m = await getJson(manifestUrl)
    const label = m.label?.ko?.[0] ?? m.label?.en?.[0] ?? m.label?.['@value'] ?? m.label ?? manifestUrl
    const meta = {}
    for (const kv of m.metadata ?? []) {
      const k = kv.label?.en?.[0] ?? kv.label?.['@value'] ?? kv.label
      const v = kv.value?.en?.[0] ?? kv.value?.['@value'] ?? kv.value
      if (typeof k === 'string') meta[k] = v
    }
    const year = Number(String(meta.Date ?? meta.date ?? '').match(/\b(1[6-9]\d{2}|20\d{2})\b/)?.[1]) || undefined
    return {
      sourceId: this.id,
      identifier: manifestUrl,
      title: typeof label === 'string' ? label : JSON.stringify(label),
      publishedYear: year,
      url: manifestUrl,
      pageCount: canvasesOf(m).length,
      raw: { metadata: meta, rights: m.rights ?? m.license ?? null },
    }
  },

  async pages(manifestUrl, { width = 1600 } = {}) {
    const m = await getJson(manifestUrl)
    return canvasesOf(m).map((c, i) => ({
      index: i,
      kind: 'url',
      // Image API: {service}/{region}/{size}/{rotation}/{quality}.{format}
      locator: `${c.id.replace(/\/$/, '')}/full/${width},/0/default.jpg`,
      ext: 'jpg',
    }))
  },

  async fetchPage(ref, outFile) {
    await delay(this.caps.minDelayMs)
    const res = await fetch(ref.locator, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!res.ok) throw new Error(`IIIF image ${res.status} ${ref.locator}`)
    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()))
    return outFile
  },

  async fetchOcr() {
    return null
  },

  pdHint(item) {
    // IIIF manifest 의 rights 가 명시돼 있으면 그게 1차 근거다.
    const rights = item.raw?.rights
    if (typeof rights === 'string' && /publicdomain|pdm|cc0/i.test(rights)) {
      return { basis: 'explicit-license', note: `manifest rights: ${rights}` }
    }
    return usPdHint(item.publishedYear)
  },
}
