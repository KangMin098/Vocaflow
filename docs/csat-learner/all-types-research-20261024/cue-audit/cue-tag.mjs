// 강의 cue 공개 수준 결정적 태깅 — 읽기 전용. 원본 대본은 바꾸지 않는다.
// 사용: node cue-tag.mjs <lecture-data dir> <out dir>
import fs from 'node:fs'
import path from 'node:path'

const [dir, out] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })

const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }
const KO = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5 }
// TTS 대본은 선지 번호를 한글 수사로 쓴다(「이 번」 「삼 번」). 「여섯 번째」 같은 서수는 빼고, 낱말 안의 글자(「다시 번」 등)도 뺀다
const DIRECT = /(정답은|답은|정답이|답이)\s*[^.?!]{0,12}?([①-⑤]|[1-5]\s*번(?!째)|(?<![가-힣])[일이삼사오]\s+번(?!째))/
const OPTION = /[①-⑤]|(?<![0-9])[1-5]\s*번(?!째)|(?<![가-힣])[일이삼사오]\s+번(?!째)/g
const optsIn = (t) => [...t.matchAll(OPTION)].map((m) => CIRCLED[m[0]] ?? KO[m[0][0]] ?? Number(m[0].replace(/\D/g, '')))

// 공식 정답(DB csat_items.answer 를 2026-10-24 SELECT 로 받은 목록) — 「정답은 N 번」 의 N 이 공식 정답일 때만 직접 공개로 센다
// (오답 소거 문장의 「…답이 … 오 번」 을 공개로 잘못 세던 오탐 정정)
const ANSWER = Object.fromEntries(fs.readFileSync(process.argv[4], 'utf8').trim().split(',').map((p) => { const [k, v] = p.split(':'); return [k, Number(v)] }))

const lectures = []
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'index.json').sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  for (const [id, l] of Object.entries(d.lectures)) {
    const answer = ANSWER[id] ?? null
    const rejected = new Set()
    let directAt = null
    let derivableAt = null
    const cues = l.cues.map((c, i) => {
      const text = c.segments.map((s) => s.text).join(' ')
      const tags = []
      if (c.target.kind === 'analysis' && c.target.id === 'answer') tags.push('target_answer')
      // 역순(「사 번이 정답」 「이 번이 답입니다」)도 직접 공개다
      const dm = DIRECT.exec(text) ?? /([①-⑤]|[1-5]\s*번(?!째)|(?<![가-힣])[일이삼사오]\s+번(?!째))(이|은|이야말로)?\s*(정답|답)(이|입니다|이에요|이죠)/.exec(text)
      if (dm) {
        const n = optsIn(dm[0])[0]
        tags.push(n === answer ? 'direct_answer' : `direct_phrase_other_${n}`)
      }
      const rej = c.target.kind === 'analysis' && /^reject:(\d)$/.exec(String(c.target.id))
      if (rej) {
        rejected.add(Number(rej[1]))
        tags.push(`reject_${rej[1]}`)
      }
      const opts = [...new Set(optsIn(text))]
      if (opts.length && !tags.includes('direct_answer')) tags.push(`mentions_${opts.join('_')}`)
      if (!tags.includes('direct_answer') && answer != null && opts.includes(answer) && !rej) tags.push('mentions_answer_number')
      if ((tags.includes('direct_answer') || tags.includes('target_answer')) && directAt == null) directAt = i
      if (rejected.size >= 4 && derivableAt == null) derivableAt = i
      return { i, id: c.id, role: c.role, target: `${c.target.kind}:${c.target.id}`, tags }
    })
    lectures.push({
      id,
      answer,
      exam: d.exam_id,
      type: l.type ?? null,
      cues: cues.length,
      direct_at: directAt,
      elimination_derivable_at: derivableAt,
      first_disclosure_at: [directAt, derivableAt].filter((x) => x != null).sort((a, b) => a - b)[0] ?? null,
      pre_disclosure_option_mentions: cues.filter((c) => (directAt == null || c.i < directAt) && c.tags.some((t) => t.startsWith('mentions_'))).length,
      detail: cues,
    })
  }
}

const sum = {
  lectures: lectures.length,
  cues: lectures.reduce((a, l) => a + l.cues, 0),
  with_direct: lectures.filter((l) => l.direct_at != null).length,
  with_elimination_derivable: lectures.filter((l) => l.elimination_derivable_at != null).length,
  derivable_before_direct: lectures.filter((l) => l.elimination_derivable_at != null && (l.direct_at == null || l.elimination_derivable_at < l.direct_at)).length,
  no_disclosure_detected: lectures.filter((l) => l.first_disclosure_at == null).length,
  no_official_answer: lectures.filter((l) => l.answer == null).length,
  direct_at_role: lectures.filter((l) => l.direct_at != null).reduce((a, l) => ((a[l.detail[l.direct_at].role] = (a[l.detail[l.direct_at].role] ?? 0) + 1), a), {}),
  answer_number_named_before_direct: lectures.filter((l) => l.detail.some((c) => (l.direct_at == null || c.i < l.direct_at) && c.tags.includes('mentions_answer_number'))).length,
  direct_phrase_with_other_number: lectures.filter((l) => l.detail.some((c) => c.tags.some((t) => t.startsWith('direct_phrase_other_')))).length,
  with_pre_disclosure_option_mentions: lectures.filter((l) => l.pre_disclosure_option_mentions > 0).length,
}
fs.writeFileSync(path.join(out, 'deterministic.json'), JSON.stringify({ generated: 'cue-tag.mjs', summary: sum, lectures }, null, 1))
console.log(JSON.stringify(sum, null, 1))
