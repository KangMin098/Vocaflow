// 강의 cue 공개 수준 sidecar 생성 — 원본 대본 JSON 은 읽기만 한다.
// 사용: node sidecar-build.mjs <repo dir> <git ref> <official-answers.txt> <out dir>
//
// 원본은 작업 트리가 아니라 <git ref> 의 blob 에서 읽는다(커밋 결속). 각 cue 는 sha256(cue 원문 JSON) 으로 묶는다.
// 자동 분류는 「제안」 이다 — 최종 수준(final)은 검수 전까지 규칙이 확실한 경우(공식 정답 번호 직접 낭독 · 정답 블록 강조 ·
// 오답 4개 누적 소거)만 채우고, 나머지는 UNKNOWN.
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [repo, ref, answersPath, out] = process.argv.slice(2)
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 })
const DIR = 'apps/web/src/lib/csat/lecture-data'
const commit = git('rev-parse', ref).trim()
const ANSWER = Object.fromEntries(fs.readFileSync(answersPath, 'utf8').trim().split(',').map((p) => { const [k, v] = p.split(':'); return [k, Number(v)] }))

const LEVELS = ['NONE', 'HINT', 'DECISIVE', 'ANSWER']
const rank = (l) => LEVELS.indexOf(l)
const KO = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5 }
const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }
// TTS 대본은 선지 번호를 한글 수사로 쓴다. 「여섯 번째」 같은 서수 · 낱말 속 글자는 뺀다
const NUM = '(?:[①-⑤]|[1-5]\\s*번(?!째)|(?<![가-힣])[일이삼사오]\\s+번(?!째))'
// 독립 검토에서 찾은 누락 반영: 조사 없는 「정답 삼 번」(M2409#45 c4)
const DIRECT = [new RegExp(`(?:정답은|답은|정답이|답이|정답)\\s*[^.?!]{0,12}?(${NUM})`), new RegExp(`(${NUM})(?:이|은)?\\s*(?:정답|답)(?:이|입니다|이에요|이죠|은)`)]
const OPTION = new RegExp(NUM, 'g')
const numOf = (s) => CIRCLED[s] ?? KO[s.trim()[0]] ?? Number(s.replace(/\D/g, ''))
// 답의 성질 · 위치를 말하는 표현(제안 근거 — 확정 아님)
const PROPERTY = /(들어갈 말은|들어갈 자리|자리는|답의|답이 될|결정적|정답|핵심 근거|이 문장이 답)/

const files = git('ls-tree', '--name-only', `${ref}:${DIR}`).trim().split('\n').filter((f) => f.endsWith('.json') && f !== 'index.json').sort()
fs.mkdirSync(out, { recursive: true })
const totals = { files: 0, lectures: 0, cues: 0, final_certain: 0, final_unknown: 0, auto: { NONE: 0, HINT: 0, DECISIVE: 0, ANSWER: 0, UNKNOWN: 0 } }
const manifest = []

for (const f of files) {
  const raw = git('show', `${ref}:${DIR}/${f}`)
  const blob = git('rev-parse', `${ref}:${DIR}/${f}`).trim()
  const d = JSON.parse(raw)
  const lectures = []
  for (const [id, l] of Object.entries(d.lectures)) {
    const answer = ANSWER[id] ?? null
    const rejected = new Set()
    let cumCertain = 'NONE'
    let unknownBefore = false
    const cues = l.cues.map((c, i) => {
      const text = c.segments.map((s) => s.text).join(' ')
      const target = `${c.target.kind}:${c.target.id}`
      const rules = []
      const channels = new Set()
      let certain = null
      let suggest = 'NONE'
      let uncertain = false
      // 정답 번호 직접 낭독 — 번호가 공식 정답일 때만
      for (const re of DIRECT) {
        const m = re.exec(text)
        if (!m) continue
        const n = numOf(m[1])
        if (n === answer) { certain = 'ANSWER'; rules.push('R1_DIRECT_OFFICIAL_NUMBER'); channels.add('speech').add('script') }
        else rules.push(`R1x_DIRECT_PHRASE_OTHER_NUMBER_${n}`)
        break
      }
      if (target === 'analysis:answer') { certain = 'ANSWER'; rules.push('R2_TARGET_ANSWER_BLOCK'); channels.add('highlight') }
      const rej = /^analysis:reject:(\d)$/.exec(target)
      if (rej) {
        rejected.add(Number(rej[1]))
        rules.push('R3_ELIMINATION'); channels.add('elimination').add('highlight').add('speech').add('script')
        if (rank(suggest) < rank('HINT')) suggest = 'HINT'
      }
      const nums = [...new Set([...text.matchAll(OPTION)].map((m) => numOf(m[0])))]
      if (certain !== 'ANSWER' && answer != null && nums.includes(answer) && !rej) {
        rules.push('R4_NAMES_OFFICIAL_NUMBER'); channels.add('speech').add('script'); suggest = 'DECISIVE'; uncertain = true
      } else if (nums.length && !rej && certain !== 'ANSWER') {
        rules.push('R5_NAMES_OTHER_NUMBER'); channels.add('speech').add('script'); if (rank(suggest) < rank('HINT')) suggest = 'HINT'; uncertain = true
      }
      if (certain !== 'ANSWER' && PROPERTY.test(text)) { rules.push('R6_PROPERTY_PHRASE'); channels.add('speech').add('script'); if (rank(suggest) < rank('HINT')) suggest = 'HINT'; uncertain = true }
      if (/^anchor:sentence:/.test(target)) channels.add('highlight')
      if (!rules.length) { rules.push('R0_NO_RULE'); uncertain = true }

      // 누적 — 확실한 규칙만 올린다. 앞에 UNKNOWN 이 있으면 하한값이라고 표시한다
      if (certain === 'ANSWER') cumCertain = 'ANSWER'
      else if (rejected.size >= 4 && rank(cumCertain) < rank('DECISIVE')) { cumCertain = 'DECISIVE'; rules.push('R7_CUMULATIVE_FOUR_ELIMINATED') }
      const local_final = certain ?? (rej && !uncertain ? 'HINT' : 'UNKNOWN')
      if (local_final === 'UNKNOWN' && cumCertain !== 'ANSWER') unknownBefore = true
      const auto_local = certain ?? suggest
      totals.auto[uncertain && !certain ? 'UNKNOWN' : auto_local]++
      totals.cues++
      if (local_final === 'UNKNOWN') totals.final_unknown++; else totals.final_certain++
      return {
        cue_id: c.id,
        order: c.order ?? i + 1,
        index: i,
        role: c.role,
        target,
        source_hash: 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),
        auto: { local_suggestion: auto_local, rules, uncertain: Boolean(uncertain && !certain) },
        channels: [...channels].sort(),
        local_disclosure_level: local_final,
        cumulative_disclosure_level: cumCertain === 'ANSWER' ? 'ANSWER' : unknownBefore || local_final === 'UNKNOWN' ? 'UNKNOWN' : cumCertain,
        cumulative_lower_bound: cumCertain,
        review: { status: certain ? 'auto_certain' : local_final === 'UNKNOWN' ? 'needs_review' : 'auto_certain', reviewers: [], conflict: false },
      }
    })
    const firstAnswer = cues.find((c) => c.cumulative_lower_bound === 'ANSWER')
    const firstDecisive = cues.find((c) => c.cumulative_lower_bound === 'DECISIVE' || c.cumulative_lower_bound === 'ANSWER')
    lectures.push({ lecture_id: id, lecture_version: l.version ?? null, official_answer: answer, cue_count: cues.length, first_certain_answer_index: firstAnswer?.index ?? null, first_certain_decisive_index: firstDecisive?.index ?? null, cues })
    totals.lectures++
  }
  totals.files++
  const side = { schema: 'csat-lecture-disclosure-sidecar/v1', source: { repo_path: `${DIR}/${f}`, commit, blob, file_sha256: 'sha256:' + crypto.createHash('sha256').update(raw).digest('hex') }, official_answers: 'csat_items.answer SELECT 2026-10-24', lectures }
  fs.writeFileSync(path.join(out, f.replace('.json', '.disclosure.json')), JSON.stringify(side, null, 1))
  manifest.push({ file: f, blob, lectures: lectures.length })
}
fs.writeFileSync(path.join(out, 'MANIFEST.json'), JSON.stringify({ commit, built_from: ref, totals, files: manifest }, null, 1))
console.log(JSON.stringify(totals))
