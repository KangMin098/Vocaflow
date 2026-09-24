// scripts/csat/lib-plos-sections.mjs
//
// **PLOS 논문 전문에서 서론과 고찰만 잘라 낸다 — 보관 판정용 입력.**
//
// 왜: 앞 800어만 읽힌 판정은 전문 판정이 보관한 17편 중 12편을 버렸다(실측 2026-09-24 · 30편).
// 전문 판정의 근거는 거의 전부 서론·고찰이었다 — 방법·결과 절은 보관 여부를 가르지 않는다.
//
// 절 제목은 마크업 없이 홀로 선 줄로 온다(`Introduction`, `2. Discussion`). 못 찾으면
// 앞 700어 + 참고문헌 앞 뒤쪽 1,200어로 대신하고 `found` 로 밝힌다 — 조용히 비우지 않는다.

const KEEP = /^(introduction|background|discussion|results and discussion|conclusions?|concluding remarks)$/i
const STOP = /^(abstract|author summary|introduction|background|methods?|materials and methods|methods and materials|results|discussion|results and discussion|conclusions?|concluding remarks|acknowledge?ments?|references|supporting information|author contributions|funding|competing interests|data availability|limitations)$/i

const INLINE = /(^|[.!?\])"”]\s+)(Abstract|Introduction|Background|Materials and methods|Methods|Results and discussion|Results|Discussion|Conclusions?|Concluding remarks|Acknowledgments|Acknowledgements|References|Supporting information|Author contributions|Funding)\s+(?=[A-Z])/g

const norm =(line) => line.trim().replace(/^(\d+(\.\d+)*\.?|[IVX]+\.)\s+/, '').replace(/[:.]$/, '')
const words = (s) => s.split(/\s+/).filter(Boolean)

/** @returns {{ text: string, found: string[], words: number }} */
export function plosSections(content, { maxWords = 3000 } = {}) {
  let lines = String(content ?? '').replace(/\r\n?/g, '\n').split('\n')
  // 본문이 한 줄로 접혀 온 것이 있다(`… measured. Discussion Our results …`). 줄 제목이 하나도
  // 없으면 **문장 끝 바로 뒤**에 오는 절 제목 낱말에서 끊어 줄로 되살린다. 문장 안의
  // "discussion" 은 소문자라 걸리지 않고, 앞머리 제목(`Introduction …`)은 ^ 로 잡는다.
  if (!lines.some((l) => { const h = norm(l); return h.length <= 40 && STOP.test(h) })) {
    lines = lines.flatMap((l) => l.replace(INLINE, (m, lead, name) => `${lead}\n${name}\n`).split('\n'))
  }
  const parts = []
  const found = []
  let cur = null
  for (const line of lines) {
    const h = norm(line)
    if (h.length <= 40 && STOP.test(h)) {
      cur = KEEP.test(h) ? { name: h, body: [] } : null
      if (cur) { parts.push(cur); found.push(h) }
      continue
    }
    if (cur && line.trim()) cur.body.push(line.trim())
  }
  let text = parts.map((p) => `## ${p.name}\n\n${p.body.join('\n\n')}`).join('\n\n')
  if (!parts.length || words(text).length < 200) {
    const all = words(String(content ?? '').replace(/\n(References|REFERENCES)\n[\s\S]*$/, ''))
    // 절이 없는 것은 대개 논평·에세이다(실측: 1,500~2,200어). 짧으면 자르지 않고 통째로 준다.
    text = all.length <= maxWords
      ? `## (절 제목 없음 — 전문)\n\n${all.join(' ')}`
      : `## (절 제목 없음 — 앞부분)\n\n${all.slice(0, 700).join(' ')}\n\n## (뒤쪽)\n\n${all.slice(-1200).join(' ')}`
    found.length = 0
  }
  const w = words(text)
  if (w.length > maxWords) text = w.slice(0, maxWords).join(' ') + ' …'
  return { text, found, words: Math.min(w.length, maxWords) }
}
