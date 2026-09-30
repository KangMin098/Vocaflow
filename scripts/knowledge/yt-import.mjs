// scripts/knowledge/yt-import.mjs
// 강사 영상 196편 요약(Codex 2026-09-27) → 학습 원리 등록부 「추출됨」 공부법 항목. 기본은 미리보기(DB 쓰기 없음).
//
// 입력: <폴더>/summary-data-all.json(영상별 재서술 요약) · <폴더>/extraction-manifest.json(영상 신원 검사).
//   자막 원문·발췌(caption-review-selections.json)는 **읽지 않는다** — 재서술 요약과 영상 링크만 쓴다.
// 규칙(Codex 리뷰 2026-10-01 · 수용 기준 6):
//   ① 미리보기 먼저 — 영상 ID · 추출 문장 · 층·분류 · 근거 등급·위치 · 검토 범위 · 제외·보류 사유
//   ② 영상 = 방법론이 아니다 — 학습 절차가 있는 영상만 항목으로, 나머지는 제외·보류 사유를 남긴다
//   ③ 등급은 근거마다 — 검토 범위(전체 열람/발췌)는 별도 칸. 영상 신원 확인 + 주장별 위치 미대조 = B
//   ④ 위치가 확인된 것만 위치로 — 자막 전체 시작·끝 시간이나 문자 위치를 영상 초 위치로 쓰지 않는다(locator 비움)
//   ⑤ 재실행 안전 — 영상 ID 에서 만든 고정 slug. 이미 있는 항목은 덮지 않는다(사람의 판정·수정 보존)
//   ⑥ 원문 없음
// 사용: node scripts/knowledge/yt-import.mjs <추출 폴더> <미리보기 출력 폴더> [--commit]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [srcDir, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const COMMIT = process.argv.includes('--commit')
if (!srcDir || !outDir) {
  console.error('사용: node scripts/knowledge/yt-import.mjs <추출 폴더> <미리보기 출력 폴더> [--commit]')
  process.exit(2)
}

const ACTOR = 'drain:yt-methodology-20260927'
const data = JSON.parse(fs.readFileSync(path.join(srcDir, 'summary-data-all.json'), 'utf8'))
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'extraction-manifest.json'), 'utf8'))
const identity = new Map(manifest.videos.map((v) => [v.videoId, v.verification ?? {}]))

// 주제 → 분류 축 **제안**(DB methodology_taxonomy 실측 id). 확정은 검토 대기에서 사람이 한다.
// 영상별 주제는 114가지로 잘게 나뉘어 있어(실측 2026-10-01) 표가 아니라 핵심어로 옮긴다.
const SKILL_WORDS = [
  [/듣기/, 'skill:listening'], [/발음|조음/, 'skill:pronunciation'], [/어휘|단어/, 'skill:vocabulary'],
  [/독해|구문|읽기/, 'skill:reading'], [/회화|말하기/, 'skill:speaking'], [/문법/, 'skill:grammar'],
  [/쓰기|영작/, 'skill:writing'], [/배경지식|뉴스/, 'skill:background'],
]
const CONDITION_WORDS = [
  [/수능/, 'exam:csat'], [/내신/, 'exam:school'], [/중학/, 'age:middle'], [/어린이|초등/, 'age:primary'], [/성인/, 'age:adult'],
  [/복습|회독/, 'process:review'], [/암기/, 'process:memory'], [/파이널|직전/, 'process:final'], [/선지|문제 해설/, 'process:approach'],
]
const EXCLUDE_WORDS = /타 과목|영어 외|홍보|강좌 안내|한국사|문학/
function classify(topic) {
  const t = String(topic ?? '')
  return {
    skills: [...new Set(SKILL_WORDS.filter(([re]) => re.test(t)).map(([, id]) => id))],
    conditions: [...new Set(CONDITION_WORDS.filter(([re]) => re.test(t)).map(([, id]) => id))],
  }
}
const REVIEW_LABEL = {
  full_available_caption_read: '전체 열람',
  distributed_caption_excerpt_review: '발췌 검토',
}

function slugOf(videoId) {
  // YouTube ID 는 대문자·밑줄을 쓴다 — slug 규칙(^[a-z0-9-]) 에 맞춰 해시로 고정한다(재실행해도 같다)
  return 'yt-' + crypto.createHash('sha1').update(videoId).digest('hex').slice(0, 12)
}

function firstSentence(text, max = 80) {
  const s = String(text ?? '').trim().split(/(?<=[.!?。])\s|\n/)[0] ?? ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

const rows = data.items.map((it) => {
  const id = identity.get(it.videoId) ?? {}
  const review = REVIEW_LABEL[it.review] ?? (String(it.review).startsWith('distributed') ? '발췌 검토' : it.review)
  const base = { videoId: it.videoId, channel: it.channel, title: it.title, url: it.sourceUrl, topic: it.topic, review }
  if (it.unusable) return { ...base, verdict: '보류', reason: '자막 내용 부족(Codex 판정)' }
  if (EXCLUDE_WORDS.test(String(it.topic))) return { ...base, verdict: '제외', reason: `영어 학습 방법이 아님(주제: ${it.topic})` }
  if (id.identityMatches === false) return { ...base, verdict: '보류', reason: '영상·채널 신원 불일치' }
  const procedure = String(it.procedure ?? '').trim()
  // 요지만 있고 절차가 없는 영상은 「방법 없음」이 아니라 「아직 뽑지 않음」 — 제외하지 않고 보류로 남긴다
  if (procedure.length === 0) return { ...base, verdict: '보류', reason: '절차 미추출 — 요지만 있음(재추출 필요)' }
  const map = classify(it.topic)
  return {
    ...base,
    verdict: '항목',
    reason: null,
    item: {
      layer: 'practice',
      slug: slugOf(it.videoId),
      title: firstSentence(it.summary) || firstSentence(procedure),
      statement: procedure.slice(0, 1500),
      skill_ids: map.skills,
      condition_ids: map.conditions,
      topic: it.topic,
      status: 'extracted',
    },
    evidence: {
      grade: 'B',
      gradeWhy: '영상·채널 신원 확인(canonical URL·ID 일치) · 주장별 초 위치 미대조',
      attribution: 'stated',
      url: it.sourceUrl,
      title: `${it.channel} · ${it.title}`.slice(0, 200),
      locator: null,
      note: `검토 범위: ${review} · 위치 미확인${it.caution ? ` · 유의점: ${String(it.caution).trim()}` : ''}`.slice(0, 1000),
    },
  }
})

const count = (v) => rows.filter((r) => r.verdict === v).length
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'yt-import-preview.json'), JSON.stringify({ source: srcDir, generatedFrom: data.date, rows }, null, 2))

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const short = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : String(s ?? ''))
const md = [
  '# 강사 영상 → 학습 원리 가져오기 미리보기',
  '',
  `원천: Codex 요약 ${data.items.length}편(${data.date}) · **DB 쓰기 없음**. 항목 ${count('항목')} · 제외 ${count('제외')} · 보류 ${count('보류')}.`,
  '모든 근거는 B(영상 신원 확인 · 주장별 위치 미대조), 위치 칸은 비움. 분류는 주제에서 옮긴 **제안** — 확정은 검토 대기에서.',
  '',
  '| 영상 ID | 채널 | 판정 | 추출 문장(학습 절차) | 층·분류 제안 | 근거 등급·위치 | 검토 범위 | 제외·보류 사유 |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) =>
    `| [${r.videoId}](${r.url}) | ${esc(r.channel)} | ${r.verdict} | ${esc(short(r.item?.statement, 140))} | ${
      r.item ? `공부법 · ${[...r.item.skill_ids, ...r.item.condition_ids].join(', ') || '(분류 없음)'}` : '—'
    } | ${r.evidence ? `${r.evidence.grade} · 위치 미확인` : '—'} | ${esc(r.review)} | ${esc(r.reason ?? '')} |`
  ),
  '',
].join('\n')
fs.writeFileSync(path.join(outDir, 'yt-import-preview.md'), md)
console.log(`항목 ${count('항목')} · 제외 ${count('제외')} · 보류 ${count('보류')} → ${outDir}`)

if (!COMMIT) {
  console.log('미리보기 끝 — DB 에 쓰려면 검토 후 --commit')
  process.exit(0)
}
console.error('--commit 은 미리보기 검토·승인 뒤 구현한다(이 판에서는 쓰지 않는다)')
process.exit(2)
