// scripts/csat/rates/fetch-megastudy.mjs
//
// 메가스터디 「정답률」(https://www.megastudy.net/Entinfo/correctRate/main.asp) → 영어 전 문항 원장 JSON.
// 계약(원장 semantics): 메가스터디 응답자 집계 · 평가원/교육청 공식값 아님 · 시험별 전 문항(TOP15 아님) ·
// 문항마다 정답 · 난이도(하~상) · 배점 · 정답률 · 선지 1~5 선택비율. 비율 합의 100% 미달분은 보존(재정규화 안 함).
//
//   node scripts/csat/rates/fetch-megastudy.mjs [--out <path>] [--grades 1,2,3]
//
// 홀수형·짝수형을 모두 받는다(forms[]) — DB 의 수능 일부 회차는 짝수형 정답 키로 들어 있어, 어느 유형인지는 import 가 정답 키로 고른다.
// 유형 구분이 없는 시험(학평·옛 회차)은 form=null 하나만.
// 재실행 안전: 매번 전체를 다시 받아 원장을 통째로 새로 쓴다(DB 는 건드리지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://www.megastudy.net/Entinfo/correctRate'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const OUT = opt('--out', path.join(HERE, 'source', 'megastudy-correct-rate.json'))
const GRADES = opt('--grades', '1,2,3').split(',').map(Number)
const decoder = new TextDecoder('euc-kr')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function post(file, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/${file}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Mozilla/5.0', referer: `${BASE}/main.asp` },
        body: new URLSearchParams(body).toString(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = decoder.decode(await res.arrayBuffer())
      await sleep(300)
      return html
    } catch (e) {
      if (attempt >= 3) throw new Error(`${file} ${JSON.stringify(body)}: ${e.message}`)
      await sleep(2000 * attempt)
    }
  }
}

const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
const pct = (s) => { const m = /^(\d+(?:\.\d+)?)%$/.exec(s); return m ? Number(m[1]) / 100 : null }

/** 시험 목록: 「YYYY.MM.DD 수능|모의평가|학력평가」 */
function parseExamList(html, grade) {
  const out = []
  for (const m of html.matchAll(/fncSelExamSeq\((\d+),'1',\d+\);">([^<]+)</g)) {
    const [, seq, label] = m
    const d = /^(\d{4})\.(\d{2})\.(\d{2})\s+(.+)$/.exec(label.trim())
    if (!d) continue
    const kind = d[4].includes('수능') ? 'suneung' : d[4].includes('모의평가') ? 'mock' : d[4].includes('학력평가') ? 'hakpyeong' : null
    out.push({ seq: Number(seq), grade, date: `${d[1]}-${d[2]}-${d[3]}`, label: d[4], kind })
  }
  return out
}

function parseRateTable(html) {
  const tab = [...html.matchAll(/fncSelExamTab\(\d+,(\d+),\d+\);"[^>]*>([^<]+)</g)].find((m) => m[2].trim() === '영어')
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)
  const rows = []
  if (body) {
    for (const tr of body[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const td = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => strip(x[1]))
      if (td.length < 10) continue
      const choice = td.slice(5, 10).map(pct)
      const sum = choice.reduce((a, b) => a + (b ?? 0), 0)
      rows.push({
        no: Number(td[0]),
        answer: Number(td[1]),
        difficulty: td[2],
        points: Number(td[3]),
        correctRate: pct(td[4]),
        choiceRates: choice,
        unreportedChoiceRate: Math.max(0, Math.round((1 - sum) * 1000) / 1000),
      })
    }
  }
  // 유형 구분이 없는 시험(학평·옛 회차)은 「(홀수형)」 없이 「영어, 45문항」 만 온다
  const title = /<strong>영어<\/strong>,\s*(\d+)문항(?:\s*\(([^)]*)\))?/.exec(html)
  return { tabNo: tab ? Number(tab[1]) : null, title: title ? { count: Number(title[1]), form: title[2] ?? null } : null, rows }
}

const exams = []
for (const g of GRADES) {
  const list = parseExamList(await post('main_examNm_ax.asp', { grdFlg: String(g), examYear: '', examType: '' }), g)
  console.log(`고${g}: 시험 ${list.length}회`)
  exams.push(...list)
}

let ok = 0
const problems = []
for (const e of exams) {
  // 영어 탭 번호는 시험마다 다를 수 있어(과목 구성) 국어 탭 응답에서 찾는다
  const first = await post('main_rate_ax.asp', { examSeq: String(e.seq), tabNo: '1' })
  const tabNo = parseRateTable(first).tabNo
  if (!tabNo) { problems.push({ seq: e.seq, why: 'no-english-tab' }); e.forms = []; continue }
  const oddHtml = await post('main_rate_ax.asp', { examSeq: String(e.seq), tabNo: String(tabNo), selSubCd: '', selExamType: '1' })
  const pages = [parseRateTable(oddHtml)]
  const evenSub = /fncSelSubCd\(\d+,\d+,'(\d+)',2\)/.exec(oddHtml)
  if (evenSub) pages.push(parseRateTable(await post('main_rate_ax.asp', { examSeq: String(e.seq), tabNo: String(tabNo), selSubCd: evenSub[1], selExamType: '2' })))
  e.tabNo = tabNo
  e.forms = pages.map((p, i) => ({ form: evenSub ? (i === 0 ? 'odd' : 'even') : null, label: p.title?.form ?? null, declaredCount: p.title?.count ?? null, rows: p.rows }))
  const why = e.forms.flatMap((p) => {
    const bad = p.rows.filter((r) => !(r.no >= 1 && r.no <= 45 && r.answer >= 1 && r.answer <= 5 && r.correctRate !== null))
    return !p.rows.length || bad.length || p.rows.length !== p.declaredCount ? [`${p.form}: rows=${p.rows.length} declared=${p.declaredCount} bad=${bad.length}`] : []
  })
  if (why.length) problems.push({ seq: e.seq, date: e.date, why: why.join(' · ') })
  else ok++
  process.stdout.write(`\r${ok}/${exams.length}`)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({
  note: '메가스터디 응답자 집계(공식값 아님) · 영어 전 문항(홀수형·짝수형) · 정답률·선지별 선택비율·난이도·배점',
  source: `${BASE}/main.asp`,
  retrievedAt: new Date().toISOString().slice(0, 10),
  exams,
}, null, 1))
console.log(`\n완료 ${ok}/${exams.length} · 문제 ${problems.length} → ${OUT}`)
for (const p of problems) console.log('  ', JSON.stringify(p))
