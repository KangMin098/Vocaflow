// scripts/csat/lecture-wrapup-scope-audit.mjs
// 강의 정리(wrapup) cue 의 「한 줄 규칙」이 적용 조건·확인 단계 없이 절대 규칙으로 쓰였는지 찾는다.
// 읽기 전용 후보 탐지기 — 강의 원본을 고치지 않는다. 확정은 원문 대조로 한다(대량작업 C 계약).
//   node scripts/csat/lecture-wrapup-scope-audit.mjs [--dir <lecture-data>] [--json]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 「다음에는 첫 십 초에 …」 행동 문장은 규칙이 아니라 습관 안내라 검사에서 뺀다.
const HABIT = /다음에는|첫 십 초/
// 단정 결론: 조건절(~면) 뒤에 답·선택·소거·방향을 못 박는 말, 또는 전칭·한정 부사.
// 「옵니다·온다」는 「가져옵니다·나옵니다」 속 글자를 피하려고 띄어 쓴 낱말로만 센다.
const VERDICT = /(답(입니다|이에요|이다)|고릅니다|고르세요|골라요|지운다|지웁니다|(^|\s)(옵니다|온다)|같은 방향|방향이 같|같아야|분사입니다|이어받습니다|주제입니다|판정하세요)/
// 조건절(~면)·유형 전체를 주어로 삼은 말(「지시어 빈칸은」「평가 선지는」)·관계어 아래(「잇는 말 아래」).
const CONDITIONAL = /([가-힣]면[,\s]|는 [^ ]+ 문항은|[^ ]+ 빈칸[은엔에는]|[^ ]+ 선지는|[^ ]+ 밑줄은|[^ ]+ 뒤의 빈칸엔|대동사는|[^ ]+ 아래)/
const UNIVERSAL = /(항상|반드시|언제나|모든|로만|만으로|뿐)/
// 적용 범위·확인 단계 표지 — 그 문장에 있으면 「조건이 있는 규칙」으로 본다.
// 「긍정이 지문」 속 「이 지문」을 잡지 않도록 지시어는 낱말 경계(문장 처음·공백 뒤)에서만 센다.
// 「무엇일 때만으로 끝나면」처럼 인용된 표지 속 「일 때만」은 범위가 아니다 — 뒤에 쉼표·공백이 올 때만 센다.
const SCOPE = /((^|\s)(이 문항|이번|여기서는|이 글|이 지문)|확인하세요|확인합니다|대 보|맞는지|인지 |는지 |는지,|경우에만[,\s]|일 때만[,\s]|다만|예외|아닐 수|도 있|먼저 보고|함께 보)/

export function ruleSentences(text) {
  return text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s && !HABIT.test(s) && !/^(정리합니다|정리할게요|한 줄 규칙)[.!]?$/.test(s))
}

// 한 cue 의 한국어 대본에서 조건 없는 절대 규칙 문장을 돌려준다.
export function unscopedRules(text) {
  const out = []
  for (const s of ruleSentences(text)) {
    const absolute = (CONDITIONAL.test(s) && VERDICT.test(s)) || (UNIVERSAL.test(s) && VERDICT.test(s))
    // 뒤 문장의 「확인하세요」는 답을 검산하는 말이지 규칙의 적용 범위가 아니다 — 문장 단위로만 본다.
    if (absolute && !SCOPE.test(s)) out.push(s)
  }
  return out
}

export function koText(cue) {
  return (cue.segments ?? []).filter(s => s.lang === 'ko-KR').map(s => s.text).join(' ')
}

export function auditLectures(lectures) {
  const flags = []
  for (const [itemId, lecture] of Object.entries(lectures)) {
    for (const cue of lecture.cues ?? []) {
      if (cue.role !== 'wrapup') continue
      const hits = unscopedRules(koText(cue))
      if (hits.length) flags.push({ item_id: itemId, version: lecture.version, cue_id: cue.id, rules: hits })
    }
  }
  return flags
}

export function loadLectures(dir) {
  const all = {}
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json') && x !== 'index.json').sort()) {
    Object.assign(all, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).lectures)
  }
  return all
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--dir')
  const dir = at >= 0 ? args[at + 1] : 'apps/web/src/lib/csat/lecture-data'
  const lectures = loadLectures(dir)
  const flags = auditLectures(lectures)
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ lectures: Object.keys(lectures).length, flagged: flags.length, flags }, null, 1) + '\n')
  } else {
    console.log(`강의 ${Object.keys(lectures).length} · 조건 없는 정리 규칙 후보 ${flags.length}`)
    for (const f of flags) console.log(`${f.item_id} ${f.cue_id} | ${f.rules.join(' / ')}`)
  }
}
