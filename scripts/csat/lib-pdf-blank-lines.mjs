// scripts/csat/lib-pdf-blank-lines.mjs
// Use drawn underlines only when the space above the rule contains no text.
/** White answer text in some source PDFs is invisible on the printed blank. */
export function visibleBlankText(operatorList, ops, items, { width }) {
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
  let state = { matrix: [1, 0, 0, 1, 0, 0], text: [1, 0, 0, 1, 0, 0], lineText: [1, 0, 0, 1, 0, 0], leading: 0, fill: '#000000', font: 1, scale: 1, char: 0, word: 0 }
  const stack = [], spans = []
  const moveLine = (x, y) => {
    state.lineText[4] += x * state.lineText[0] + y * state.lineText[2]
    state.lineText[5] += x * state.lineText[1] + y * state.lineText[3]
    state.text = [...state.lineText]
  }
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const op = operatorList.fnArray[i], a = operatorList.argsArray[i]
    if (op === ops.save) { stack.push({ ...state, matrix: [...state.matrix], text: [...state.text], lineText: [...state.lineText] }); continue }
    if (op === ops.restore) { state = stack.pop() ?? state; continue }
    if (op === ops.transform) state.matrix = mul(state.matrix, a)
    else if (op === ops.beginText) { state.text = [1, 0, 0, 1, 0, 0]; state.lineText = [...state.text] }
    else if (op === ops.setFillRGBColor) state.fill = a[0]
    else if (op === ops.setFont) state.font = a[1]
    else if (op === ops.setHScale) state.scale = a[0] / 100
    else if (op === ops.setCharSpacing) state.char = a[0]
    else if (op === ops.setWordSpacing) state.word = a[0]
    else if (op === ops.setTextMatrix) { state.text = Array.from(a[0]?.length === 6 ? a[0] : a.length === 6 ? a : Object.values(a[0])); state.lineText = [...state.text] }
    else if (op === ops.moveText) moveLine(a[0], a[1])
    else if (op === ops.setLeadingMoveText) { state.leading = -a[1]; moveLine(a[0], a[1]) }
    else if (op === ops.setLeading) state.leading = a[0]
    else if (op === ops.nextLine) moveLine(0, -state.leading)
    else if (op === ops.showText) {
      const m = mul(state.matrix, state.text)
      let advance = 0, str = ''
      for (const glyph of a[0]) {
        if (typeof glyph === 'number') { advance -= glyph * state.font / 1000; continue }
        str += glyph.unicode ?? ''
        advance += (glyph.width ?? 0) * state.font / 1000 + state.char + (glyph.isSpace ? state.word : 0)
      }
      if (Math.abs(m[1]) < 0.001 && Math.abs(m[2]) < 0.001 && m[0] > 0) spans.push({ str, x: m[4], y: m[5], w: advance * state.scale * m[0], hidden: state.fill === '#ffffff' })
      state.text[4] += advance * state.scale * state.text[0]
      state.text[5] += advance * state.scale * state.text[1]
    }
  }
  const hidden = spans.filter((s) => s.hidden && /[A-Za-z]/.test(s.str) && inBlankQuestion(s, items, width))
  if (!hidden.length) return items
  const affected = (s, h) => Math.abs(s.y - h.y) <= 0.5 && (s.x < width / 2) === (h.x < width / 2)
  // Rebuild only affected rows from the original visible glyph runs, retaining
  // exact coordinates instead of slicing a merged string by estimated widths.
  return [...items.filter((s) => !hidden.some((h) => affected(s, h))), ...spans.filter((s) => !s.hidden && hidden.some((h) => affected(s, h))).map(({ hidden: _, ...s }) => s)]
}

export function blankRuleItems(operatorList, ops, items, { width, height }) {
  let matrix = [1, 0, 0, 1, 0, 0]
  const stack = []
  const candidates = []
  const rules = []
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
  const point = (x, y) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const op = operatorList.fnArray[i]
    const args = operatorList.argsArray[i]
    if (op === ops.save) { stack.push([...matrix]); continue }
    if (op === ops.restore) { matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0]; continue }
    if (op === ops.transform) { matrix = mul(matrix, args); continue }
    if (op !== ops.constructPath || !args?.[2]) continue
    const b = args[2]
    const corners = [point(b[0], b[1]), point(b[0], b[3]), point(b[2], b[1]), point(b[2], b[3])]
    const x = Math.min(...corners.map((p) => p[0]))
    const end = Math.max(...corners.map((p) => p[0]))
    const y = Math.min(...corners.map((p) => p[1]))
    const top = Math.max(...corners.map((p) => p[1]))
    if (top - y > 1.5 || end - x < 2 || end - x > width * 0.45 || y / height < 0.09 || y / height > 0.86) continue
    rules.push({ x, end, y, top })
  }
  // Some PDFs draw a single underline as a dozen adjoining short strokes.
  const merged = []
  for (const rule of rules.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const prior = merged.findLast((r) => Math.abs(r.y - rule.y) <= 0.5 && rule.x <= r.end + 1.5 && rule.end >= r.x - 1.5)
    if (prior) { prior.x = Math.min(prior.x, rule.x); prior.end = Math.max(prior.end, rule.end); prior.top = Math.max(prior.top, rule.top) }
    else merged.push({ ...rule })
  }
  for (const { x, end, top } of merged) {
    if (end - x < 20 || end - x > width * 0.45) continue
    const sameLine = items.filter((t) => t.y >= top - 0.5 && t.y <= top + 5 && (t.x < width / 2) === (x < width / 2))
    const englishAbove = items.some((t) => /[A-Za-z]/.test(t.str) && t.y > top + 5 && t.y <= top + 30 && (t.x < width / 2) === (x < width / 2))
    // Underlined words, option labels, boxes and rules through text are not blanks.
    if (sameLine.some((t) => /[A-Za-z가-힣0-9①②③④⑤_]/.test(t.str) && Math.min(end, t.x + t.w) - Math.max(x, t.x) > 5)) continue
    if (!sameLine.some((t) => /[A-Za-z]/.test(t.str)) && !englishAbove) continue
    const baseline = sameLine[0]?.y ?? top + 2
    if (candidates.some((c) => Math.abs(c.x - x) < 2 && Math.abs(c.y - baseline) < 2)) continue
    candidates.push({ str: ' ______ ', x, y: baseline, w: end - x })
  }
  return candidates
}

/** Limit reconstruction to a question's passage, before its separate choices. */
export function inBlankQuestion(candidate, items, width) {
  const column = items.filter((t) => (t.x < width / 2) === (candidate.x < width / 2))
  const headers = column.map((t) => ({ ...t, no: Number(t.str.match(/^\s*(\d{1,2})\.(?!\d)(?:\s|$)/)?.[1]) }))
    .filter((t) => t.no >= 18 && t.no <= 45 && t.y >= candidate.y - 3).sort((a, b) => a.y - b.y)
  const header = headers[0]
  if (!header || header.no < 31 || header.no > 34) return false
  return !column.some((t) => /^\s*①/.test(t.str) && t.y < header.y && t.y >= candidate.y - 3)
}
