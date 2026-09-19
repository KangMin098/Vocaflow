// apps/web/src/lib/csat/reflow/reflow.ts
//
// **문제지 한 벌 → 문항마다 발문·지문·선지.** 페이지를 그리지 않고 글자를 다시 흘려 넣기 위한 추출.
//
// ── 왜 이렇게 하나 ───────────────────────────────────────────────────
// 예전 화면(`/csat/overlay`)은 A4 2단 한 쪽을 통째로 캔버스에 그렸다. 휴대폰 폭에서 본문 글자가
// 6px 안팎이 된다 — 문항 하나를 보는 데 쪽 전체가 필요 없었다. 이 모듈은 학습자가 떨어뜨린
// PDF 의 글자 조각을 **학습자 브라우저 안에서** 문항 단위로 묶는다.
//
// ── 경계는 새로 찾지 않는다 ─────────────────────────────────────────
// 문항 번호의 자리(쪽·단·y)는 이미 커밋된 좌표 색인(`anchor-data/<회차>.json`)에 있다. 그 색인은
// 문제지 30개에서 **번호 45/45 · 고아 기호 0** 으로 검증됐다(`scripts/csat/pdf-anchors.mjs`).
// 같은 파일이면(sha256 이 같으면) 같은 좌표이므로, 여기서 번호를 다시 추측하지 않는다.
//
// ── 선지 분리 규칙은 코퍼스 빌드에서 옮겨 왔다 ──────────────────────
// `scripts/csat/lib-passage.mjs` 의 `choiceStart`·`INLINE_SYMBOL_TYPES` 가 두 번 조용히 틀린 끝에
// 얻은 규칙이다(M1809#30 이 첫 `①` 에서 잘렸던 일). 규칙을 새로 짜지 않고 그대로 옮긴다.

import type {
  PageFrags,
  PdfFrag,
  ReflowAnchorItem,
  ReflowAnchors,
  ReflowBox,
  ReflowItem,
  ReflowLine,
} from './types'

/** 추출기 판. 규칙을 바꾸면 올린다 — 기기에 남은 옛 추출을 버리게 한다. */
export const REFLOW_VERSION = 1

const CIRC = '①②③④⑤'

/**
 * ①~⑤ 가 **본문에 박히는** 유형 — 별도 선지 블록이 없다.
 * `scripts/csat/lib-passage.mjs` 의 같은 이름 목록과 **같아야 한다**(회귀가 대조한다).
 * 장문(X-*)·순서(R-ORDER)는 넣지 않는다 — 그쪽의 ①~⑤ 는 진짜 선지 블록이다.
 */
export const INLINE_SYMBOL_TYPES: ReadonlySet<string> = new Set([
  'R-REFER',
  'R-VOCAB',
  'R-GRAMMAR',
  'R-IRRELEVANT',
  'R-INSERT',
  'R-CHART',
])

/** 발문은 덩어리로 끝난다 — 이 표지 뒤부터가 지문이다(`lib-passage.mjs` 와 같은 표지). */
const STEM_END = /(?:것은\s*\??|것을\s*고르시오\s*\.?|고르시오\s*\.?|하시오\s*\.?|답하시오\s*\.?)(?:\s*\[\s*3\s*점\s*\])?/
const HANGUL = /[가-힣]/
const HIGH_SCORE = /\[\s*3\s*점\s*\]/
const SET_HEAD = /^\s*\[\s*(\d{1,2})\s*[~～∼〜–—-]\s*(\d{1,2})\s*\]\s*(.*)$/

/** 종이의 틀 — 문항과 무관한 줄 */
function isChrome(text: string): boolean {
  const t = text.trim()
  return (
    t === '' ||
    /^\d{1,2}$/.test(t) || // 쪽 번호 조각
    /^\d{1,2}\s*\/\s*\d{1,2}$/.test(t) ||
    // ⚠️ 「저작권」 한 낱말로 거르면 안 된다 — M2509#20 선지 ②가 「디지털 창작물의 저작권 보호…」라
    //    선지 하나가 통째로 사라졌다. 바닥글 **문장**으로 거른다.
    /문제지에\s*관한\s*저작권은/.test(t) ||
    /^(홀수형|짝수형)$/.test(t) ||
    /^영어\s*영역$/.test(t) ||
    /^제\s*3\s*교시/.test(t)
  )
}

/**
 * 마지막 쪽 「확인 사항」 상자 — 여기부터 끝까지 문항이 아니다.
 * ⚠️ `※` 만으로 자르면 안 된다 — 안내문 본문에도 `※ All passes include …` 가 있다(2026#28 이
 *    거기서 잘려 선지를 통째로 잃었다). 상자 머리(`※ 확인 사항`)가 본문 줄과 다른 순서로 올 수 있어
 *    본문 줄(`◦ 답안지의 해당란에 … 확인` / `하시오.`)로도 자른다 — 줄 하나만 버리면 꼬리
 *    `하시오.` 가 45번 ⑤ 선지에 붙는다(전 회차 45번 30/30 이 그랬다).
 */
function isAnswerSheetBox(text: string): boolean {
  const t = text.trim()
  return /^※\s*확인\s*사항/.test(t) || /답안지의\s*해당란/.test(t)
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/**
 * 단 경계. 색인의 문항 번호 x 가 단마다 같은 자리에서 시작하므로(왼쪽 여백), 오른 단 여백
 * **바로 왼쪽**이 경계다 — 중간값으로 가르면 왼 단 본문 절반이 넘어간다(`pdf-anchors.mjs` 실측).
 */
export function gutterOf(anchors: ReflowAnchors): number {
  const right = anchors.items.filter((i) => i.col === 1).map((i) => i.x)
  return right.length ? median(right) - 10 : Infinity
}

/** 같은 기준선의 조각을 x 순으로 잇는다. 조각 사이 틈이 있으면 한 칸을 끼운다. */
function joinLine(frags: PdfFrag[]): string {
  const fs = [...frags].sort((a, b) => a.x - b.x)
  let out = ''
  let end = -Infinity
  for (const f of fs) {
    const gap = f.x - end
    const h = f.h || 10
    if (out && gap > h * 0.15 && !/\s$/.test(out) && !/^\s/.test(f.str)) out += ' '
    out += f.str
    end = Math.max(end, f.x + f.w)
  }
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * 쪽들 → 읽기 순서의 줄. 쪽 → 단(왼 → 오) → 위 → 아래.
 * 머리글 띠(색인의 가장 높은 문항 번호보다 위)와 바닥글 띠를 뺀다.
 */
export function readingLines(pages: PageFrags[], anchors: ReflowAnchors): ReflowLine[] {
  const gutter = gutterOf(anchors)
  const topNo = Math.max(...anchors.items.filter((i) => i.no >= 18).map((i) => i.y + i.h))
  const out: ReflowLine[] = []
  for (const pg of pages.slice(0, anchors.form_pages)) {
    const headerCut = Number.isFinite(topNo) ? topNo + 6 : pg.h * 0.87
    const footerCut = pg.h * 0.07
    for (const col of [0, 1]) {
      const fr = pg.frags
        .filter((f) => (f.x < gutter ? 0 : 1) === col && f.y <= headerCut && f.y >= footerCut)
        .sort((a, b) => b.y - a.y)
      const groups: PdfFrag[][] = []
      for (const f of fr) {
        const g = groups[groups.length - 1]
        const tol = Math.max(2.5, 0.3 * Math.max(f.h, g?.[0]?.h ?? 0))
        if (g && Math.abs(g[0].y - f.y) <= tol) g.push(f)
        else groups.push([f])
      }
      for (const g of groups) {
        const text = joinLine(g)
        if (isChrome(text)) continue
        out.push({ p: pg.p, col, y: g[0].y, h: Math.max(...g.map((f) => f.h)), text })
      }
    }
  }
  return out
}

/** 색인 문항의 시작 줄 — 같은 쪽·단에서 기준선이 가깝고 번호로 시작하는 줄 */
function startLineOf(lines: ReflowLine[], a: ReflowAnchorItem): number {
  let best = -1
  let bestDy = Infinity
  const re = new RegExp(`^\\s*${a.no}\\s*[.．]`)
  lines.forEach((l, i) => {
    if (l.p !== a.p || l.col !== a.col) return
    const dy = Math.abs(l.y - a.y)
    if (dy <= Math.max(3, a.h * 0.4) && dy < bestDy && re.test(l.text)) {
      best = i
      bestDy = dy
    }
  })
  return best
}

/**
 * 선지 블록이 시작하는 줄. 없으면 -1.
 * **줄머리 ① 이 있고 그 뒤로 ②③④⑤ 가 차례로 나오는 꼬리**만 선지 블록이다(`lib-passage.mjs`).
 */
export function choiceStart(block: string[]): number {
  for (let i = 0; i < block.length; i += 1) {
    if (!block[i].trim().startsWith(CIRC[0])) continue
    const tail = block.slice(i).join('\n')
    let at = -1
    let ok = true
    for (const c of CIRC) {
      const j = tail.indexOf(c)
      if (j <= at) {
        ok = false
        break
      }
      at = j
    }
    if (ok) return i
  }
  return -1
}

/** 줄들을 한 덩어리 글로. 줄 끝 `글자-` 는 공백 없이 잇는다(`surplus-` + `producing`). */
export function joinLines(ls: string[]): string {
  let out = ''
  for (const raw of ls) {
    const l = raw.trim()
    if (!l) continue
    if (!out) out = l
    else if (/[A-Za-z]-$/.test(out) || /[—–]$/.test(out)) out += l
    else out += ' ' + l
  }
  return out.replace(/\s+/g, ' ').trim()
}

function splitChoices(text: string): string[] {
  const parts = text.split(/[①②③④⑤]/)
  return parts.slice(1).map((s) => s.replace(/\s+/g, ' ').trim())
}

function boxesOf(lines: ReflowLine[]): ReflowBox[] {
  const by = new Map<string, ReflowBox>()
  for (const l of lines) {
    const k = `${l.p}|${l.col}`
    const b = by.get(k)
    const top = l.y + l.h
    const bottom = l.y - l.h * 0.35
    if (!b) by.set(k, { p: l.p, col: l.col, top, bottom })
    else {
      b.top = Math.max(b.top, top)
      b.bottom = Math.min(b.bottom, bottom)
    }
  }
  return [...by.values()]
}

/** 발문을 떼어 낸다. 발문이 없으면(묶음 머리글에서 받는 문항) `stem=null`, 몸은 첫 줄부터. */
function takeStem(lines: string[], no: number): { stem: string | null; body: string[] } {
  const first = lines[0].replace(new RegExp(`^\\s*${no}\\s*[.．]\\s*`), '')
  const rest = lines.slice(1)
  if (!HANGUL.test(first)) return { stem: null, body: [first, ...rest] }

  let acc = first
  for (let k = 0; k <= Math.min(3, rest.length); k += 1) {
    const m = acc.match(STEM_END)
    if (m && m.index !== undefined) {
      let stem = acc.slice(0, m.index + m[0].length).trim()
      let tail = acc.slice(m.index + m[0].length).trim()
      let body = rest.slice(k)
      // 「[3점]」이 다음 줄로 밀려난 경우
      if (!tail && /^\[\s*3\s*점\s*\]$/.test(body[0]?.trim() ?? '')) {
        stem += ' [3점]'
        body = body.slice(1)
      }
      if (/^\[\s*3\s*점\s*\]/.test(tail)) {
        stem += ' [3점]'
        tail = tail.replace(/^\[\s*3\s*점\s*\]\s*/, '')
      }
      return { stem, body: tail ? [tail, ...body] : body }
    }
    if (k < rest.length) {
      if (!HANGUL.test(rest[k])) break
      acc += ' ' + rest[k]
    }
  }
  // 종결 표지를 못 찾았다 — 한글이 섞인 첫 줄은 발문으로, 나머지는 몸으로
  return { stem: first, body: rest }
}

/**
 * 문제지 한 벌 → 문항들.
 *
 * `typeOf` 는 기호 선지 유형인지 가르는 데만 쓴다. 모르면(null) 선지 블록을 찾아본다.
 * `wanted` 를 주면 그 번호만 만든다.
 */
export function reflowExam(
  pages: PageFrags[],
  anchors: ReflowAnchors,
  typeOf: (no: number) => string | null,
  wanted?: number[],
): Map<number, ReflowItem> {
  const lines = readingLines(pages, anchors)
  const items = [...anchors.items].sort((a, b) => a.no - b.no)
  const starts = new Map<number, number>()
  for (const a of items) {
    const s = startLineOf(lines, a)
    if (s >= 0) starts.set(a.no, s)
  }

  // 묶음 머리글 — `[31～34]` 는 발문만, `[41～42]` 부터는 지문까지 묶는다
  // ⚠️ 머리글 발문은 **두 줄에 걸칠 수 있다**(2026 `[38～39] 글의 흐름으로 보아, … 가장` / `적절한 곳을
  //    고르시오.`). 첫 줄만 읽으면 발문이 「가장」에서 끊긴다 — 종결 표지까지 잇는다.
  const heads: { at: number; from: number; to: number; stem: string }[] = []
  lines.forEach((l, i) => {
    const m = l.text.match(SET_HEAD)
    if (!m) return
    let stem = m[3].trim()
    for (let k = i + 1; k < Math.min(lines.length, i + 4) && !STEM_END.test(stem); k += 1) {
      const t = lines[k].text.trim()
      if (!HANGUL.test(t) || /^\s*\d{1,2}\s*[.．]/.test(t)) break
      stem += ' ' + t
    }
    heads.push({ at: i, from: Number(m[1]), to: Number(m[2]), stem })
  })
  const headOf = (no: number) => heads.find((h) => no >= h.from && no <= h.to) ?? null

  /** 문항 영역의 끝(배타) — 다음 문항 시작 또는 그 사이의 묶음 머리글 */
  const regionEnd = (from: number): number => {
    let end = lines.length
    for (const s of starts.values()) if (s > from && s < end) end = s
    for (const h of heads) if (h.at > from && h.at < end) end = h.at
    for (let i = from + 1; i < end; i += 1) if (isAnswerSheetBox(lines[i].text)) return i
    return end
  }

  const out = new Map<number, ReflowItem>()
  for (const a of items) {
    if (wanted && !wanted.includes(a.no)) continue
    const type = typeOf(a.no)
    const inline = type != null && INLINE_SYMBOL_TYPES.has(type)
    const s = starts.get(a.no)
    const empty: ReflowItem = {
      no: a.no,
      stem: '',
      passage: '',
      notes: [],
      choices: [],
      inline,
      ok: false,
      reason: 'no-start-line',
      boxes: [],
    }
    if (s === undefined) {
      out.set(a.no, empty)
      continue
    }
    const region = lines.slice(s, regionEnd(s))
    const head = headOf(a.no)
    const { stem: ownStem, body: rawBody } = takeStem(
      region.map((l) => l.text),
      a.no,
    )
    const stem = ownStem ?? head?.stem ?? ''

    // 장문 묶음(41~) — 지문은 머리글 밑에 한 번 있다
    let setPassage: string[] = []
    let setLines: ReflowLine[] = []
    if (head && head.from >= 41) {
      const first = starts.get(head.from)
      if (first !== undefined && first > head.at) {
        setLines = lines.slice(head.at + 1, first)
        setPassage = setLines.map((l) => l.text)
      }
    }

    const notes: string[] = []
    const keepNotes = (ls: string[]) =>
      ls.filter((l) => {
        if (/^\s*\*/.test(l)) {
          notes.push(l.replace(/^\s*\*\s*/, '').trim())
          return false
        }
        return true
      })
    const body = keepNotes(rawBody)
    const setBody = keepNotes(setPassage)

    let passageLines: string[]
    let choices: string[] = []
    let reason: ReflowItem['reason'] = null
    if (inline) {
      passageLines = body
    } else {
      const c = choiceStart(body)
      if (c < 0) {
        passageLines = body
        reason = 'choice-split'
      } else {
        passageLines = body.slice(0, c)
        choices = splitChoices(joinLines(body.slice(c)))
        if (choices.length !== 5 || choices.some((x) => !x)) {
          reason = 'choice-split'
          choices = []
        }
      }
    }
    // 발문 없이 받은 문항(묶음 머리글)은 「[3점]」이 지문 꼬리에 붙어 온다 — 지문이 아니다
    let high = HIGH_SCORE.test(stem)
    if (passageLines.length) {
      const last = passageLines.length - 1
      const stripped = passageLines[last].replace(/\s*\[\s*3\s*점\s*\]\s*$/, '')
      if (stripped !== passageLines[last]) {
        high = true
        passageLines = [...passageLines.slice(0, last), stripped]
      }
    }
    const own = joinLines(passageLines)
    const shared = joinLines(setBody)
    const passage = shared ? (own ? `${shared}\n\n${own}` : shared) : own

    if (!passage) reason = 'empty-passage'
    out.set(a.no, {
      no: a.no,
      stem: high && !HIGH_SCORE.test(stem) ? `${stem} [3점]` : stem,
      passage,
      notes,
      choices,
      inline,
      ok: reason !== 'empty-passage',
      reason,
      boxes: boxesOf([...setLines, ...region]),
    })
  }
  return out
}
