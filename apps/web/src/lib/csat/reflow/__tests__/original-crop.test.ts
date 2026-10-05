// apps/web/src/lib/csat/reflow/__tests__/original-crop.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cropOf, readPaper } from '../read-paper'

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }))
vi.mock('pdfjs-dist', () => ({ getDocument, GlobalWorkerOptions: {}, OPS: {} }))
const exam = 'H2603G1'
const png = 'data:image/png;base64,iVBORw0KGgo='
function arrange(canRender: boolean, renderRejects = false) {
  const text = [
    ['44.', 88, 1000], ['다른 지시 대상을 고르시오.', 108, 1000],
    ['The reader met (a) her neighbor.', 100, 980],
    ['① (a)', 100, 960], ['② (b)', 100, 940], ['③ (c)', 100, 920],
    ['④ (d)', 100, 900], ['⑤ (e)', 100, 880],
  ]
  const page = {
    getViewport: () => ({ width: 842, height: 1191, transform: [1, 0, 0, 1, 0, 0] }),
    getTextContent: async () => ({ items: text.map(([str, x, y]) => ({
      str, transform: [1, 0, 0, 11, x, y], width: String(str).length * 5, height: 11,
    })) }),
    getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
    render: () => ({ promise: renderRejects ? Promise.reject(new Error('Original render failed')) : Promise.resolve() }),
  }
  getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => page, destroy: async () => {} }) })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, known: true, exam_id: exam,
    anchors: { form_pages: 1, items: [{ no: 44, p: 1, col: 0, x: 88, y: 1000, w: 12, h: 13.5 }] },
  }))))
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
    getContext: () => canRender ? { drawImage: vi.fn() } : null,
    toDataURL: () => png,
  }) })
}
const read = () => readPaper(new File(['%PDF-synthetic'], 'synthetic.pdf'), {
  typeOf: () => 'X-REFER', wanted: () => [44], exams: [exam],
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('실제 readPaper의 원본 영역 보존', () => {
  it('글자가 성공해도 밑줄 유형의 원본을 탭 메모리에 생성한다', async () => {
    arrange(true)
    const result = await read()
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw Error('Expected parsed paper')
    expect(result.failed).toBe(0)
    expect(result.paper.items[0]).toMatchObject({ ok: true, needsOriginal: true })
    expect(cropOf(exam, 44)).toBe(png)
    expect(JSON.stringify(result.paper)).not.toContain('data:image')
  })
  it('원본 렌더링 실패를 세고 이전 파일의 그림을 재사용하지 않는다', async () => {
    arrange(true); await read()
    expect(cropOf(exam, 44)).toBe(png)
    arrange(false)
    const result = await read()
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw Error('Expected parsed paper')
    expect(result.failed).toBe(1)
    expect(result.paper.items[0]).toMatchObject({ ok: true, needsOriginal: true, originalUnavailable: true })
    expect(cropOf(exam, 44)).toBeNull()
  })
  it('원본 렌더 예외가 나도 추출된 문항을 보존하고 실패 수를 기록한다', async () => {
    arrange(true); await read()
    arrange(true, true)
    const result = await read()
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') throw Error('Expected parsed paper')
    expect(result.failed).toBe(1)
    expect(result.paper.items[0]).toMatchObject({ ok: true, needsOriginal: true, originalUnavailable: true })
    expect(result.paper.items[0].passage).toContain('her neighbor')
    expect(cropOf(exam, 44)).toBeNull()
  })
})
