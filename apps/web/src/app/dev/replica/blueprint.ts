// apps/web/src/app/dev/replica/blueprint.ts
//
// 복제 화면이 읽는 **측정값 로더**(DD-62 Stage 2).
// 값은 `scripts/design/extract-computed.mjs` · `extract-app.mjs` 가 만든 JSON 에서만 온다 —
// 이 파일에 수치를 적지 않는다. 추출을 다시 돌리면 화면이 따라온다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type BlueprintChild = {
  role: string
  tag: string
  x: number
  y: number
  w: number
  h: number
  textLen: number
  text?: string
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  letterSpacing?: string
  textAlign?: string
  color?: string
  bg?: string
  radius?: string
  border?: string
}

export type Band = {
  index: number
  tag: string
  cls: string
  bg?: string
  top: number
  left: number
  w: number
  h: number
  children: BlueprintChild[]
}

/** `main` 밖의 띠 — 머리·바닥. 띠 목록에 없지만 화면의 큰 몫을 칠한다. */
export type ChromeBand = Band & { part: 'header' | 'footer'; position: string }

export type ViewportBlueprint = {
  viewport: { key: string; width: number; height: number }
  url: string
  scrollHeight: number
  pageBg?: string
  chrome: ChromeBand[]
  blueprint: Band[]
  rhythm: {
    wrapperPath: string
    sectionCount: number
    sectionBoxes: { top: number; bottom: number; h: number; w: number; tag: string; cls: string }[]
    sectionGaps: number[]
    containerWidths: { width: number; count: number }[]
    grids: { columns: number; count: number; samples: { template: string; gap: string }[] }[]
  }
}

// `next dev` 는 apps/web 에서 돈다. 측정값은 저장소 루트의 docs/ 아래에 있다.
const REFS = join(process.cwd(), '..', '..', 'docs', 'design', 'refs', 'tines')

function read<T>(file: string): T {
  return JSON.parse(readFileSync(join(REFS, file), 'utf8')) as T
}

export function computed(): Record<string, ViewportBlueprint> {
  return read<Record<string, ViewportBlueprint>>('computed.json')
}

export function appMeasured() {
  return read<{
    source: Record<string, string>
    caveats: string[]
    viewports: Record<
      string,
      {
        viewport: { key: string; width: number; height: number }
        error?: string
        note?: string
        frame: { width: number; height: number; cls: string }
        derived: {
          topBarHeight: number | null
          canvas: { x: number; y: number; w: number; h: number; bg: string } | null
          leftRailWidth: number | null
          leftRailInset: { x: number; y: number; radius?: string } | null
          leftPanelWidth: number | null
          leftPanelInset: { x: number; y: number; radius?: string } | null
          rightInspectorWidth: number | null
          rightCardWidth: number | null
          rightCardInset: { x: number; gapFromCanvas: number | null } | null
          canvasInset: { top: number; left: number; right: number; bottom: number } | null
        }
        grid?: {
          rect: { x: number; y: number; w: number; h: number }
          backgroundImage: string
          backgroundPosition: string
          tile?: { width: string; height: string; dotRadius: string; fill: string }
        }
        nodes: { x: number; y: number; w: number; h: number; bg?: string | null; radius?: string; border?: string }[]
        boxes: { x: number; y: number; w: number; h: number; bg?: string | null; radius?: string; borderWidth?: number; borderColor?: string }[]
        fontSizes: { size: string; weight: string; count: number }[]
      }
    >
  }>('app-measured.json')
}

// ── 문구 자리 ──────────────────────────────────────────────────────────────
// 글자 수만 같은 lorem 을 넣는다. 우리 문구는 Stage 3 에서 들어온다 — 여기서 쓰면
// 복제 단계에서 이미 "우리 화면" 이 되어 버리고, 구조가 맞는지 따로 볼 수 없게 된다.
const LOREM =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur '

export function lorem(length: number): string {
  if (length <= 0) return ''
  let out = ''
  while (out.length < length) out += LOREM
  return out.slice(0, length)
}
