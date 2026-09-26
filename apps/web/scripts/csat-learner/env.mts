// apps/web/scripts/csat-learner/env.mts
//
// 학습자 재설계(`docs/csat-learner-brief.md`) 게이트 스크립트 공통.
// `apps/web` 에서 실행한다(`npx tsx scripts/csat-learner/<이름>.mts`).
//
// ⚠️ 이 스크립트들은 **로컬에 있는 평가원 문제지 원본**을 읽는다. 원문이 담긴 중간 산출물은
//    저장소에 두지 않는다 — 리포트에는 수치와 문항 번호만 쓴다.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type { PageFrags, PdfFrag } from '../../src/lib/csat/reflow/types'

export { arg, flag, readJson, serviceDb, writeJson } from '../csat-lecture/env.mts'

/** 게이트 리포트 — 커밋된다(수치만) */
export const REPORTS = path.resolve('../../docs/csat-learner')

/** 원본 문제지 후보 폴더 — `scripts/csat/build-anchor-data.mjs` 와 같은 목록 */
const DIRS = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
  'C:/Users/Administrator/Documents/영어/모의평가',
].filter((d) => fs.existsSync(d))

/** sha256 → 로컬 파일. 색인의 해시로 찾으므로 파일 이름 규칙에 기대지 않는다. */
export function localPapers(): Map<string, string> {
  const out = new Map<string, string>()
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.pdf') || f.includes('정답표')) continue
      const p = path.join(dir, f)
      const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
      out.set(h, p)
    }
  }
  return out
}

/**
 * 브라우저 쪽(`lib/csat/reflow/pdf-frags.ts`)과 **같은 변환**으로 조각을 뽑는다.
 * Node 에서는 legacy 빌드를 써야 한다(기본 빌드는 브라우저 API 를 건드린다).
 */
export async function pdfPages(file: string): Promise<PageFrags[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { fragsOfContent, hlinesOfOps } = await import('../../src/lib/csat/reflow/pdf-frags')
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // ⚠️ `isEvalSupported: false` 가 여기 있었는데 **pdfjs-dist 6.x 에서 사라진 옵션**이다
  //   (v6 이 eval 경로를 통째로 걷어냈다). 남겨 두면 런타임이 조용히 무시하고, 읽는 사람은
  //   아직 끄고 있다고 믿는다 — 타입체크를 켜자(DD-78) 그것이 드러났다.
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(file)),
    useSystemFonts: false,
    // 글꼴 cMap 경고는 **렌더링** 쪽 문제라 글자 추출에는 영향이 없다(전 회차 텍스트 99.4% 로 확인)
    verbosity: 0,
  }).promise
  const pages: PageFrags[] = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const frags: PdfFrag[] = fragsOfContent(content.items as unknown[])
    const lines = hlinesOfOps((await page.getOperatorList()) as { fnArray: number[]; argsArray: unknown[] }, OPS)
    pages.push({ p, w: vp.width, h: vp.height, frags, lines })
  }
  // ⚠️ 여기는 `if (typeof doc.destroy === 'function') await doc.destroy()` 였다.
  //   pdfjs-dist 6.x 에서 정리 함수가 **문서가 아니라 로딩 작업**으로 옮겨 갔고,
  //   그래서 이 가드는 **늘 거짓**이었다 — 워커가 한 번도 안 내려갔다(회차를 잇달아 읽으면
  //   워커가 쌓인다). `typeof` 가드는 없는 API 를 조용히 건너뛰므로 이런 이동을 숨긴다.
  await doc.loadingTask.destroy()
  return pages
}
