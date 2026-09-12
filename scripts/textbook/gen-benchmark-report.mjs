// scripts/textbook/gen-benchmark-report.mjs
//
// **출판사별 우위 지수 리포트의 수치 블록을 생성한다** — 손으로 고치지 않는다.
//
// ── 왜 필요한가 (실측 2026-09-01) ───────────────────────────────────
// 이 리포트의 숫자를 하루에 **다섯 번** 손으로 고쳤다. 자가 그만큼 자주 고쳐졌기 때문이다:
//
//   3e9cfea6  볼륨 모드가 저장본을 재고 있었다 (결함 넷)
//   60254840  순서 문항 지문이 `presented` 키에 있는데 안 읽었다
//   6dafd10a  창을 그은 자와 창으로 거르는 자의 토큰 규칙이 달랐다
//   9905410c  평가원 수능 기출 추가 — 고3 창 신설
//   4e92f656  영어 선택지 다섯 개를 지문으로 세고 있었다
//
// 매번 커밋한 리포트가 **수십 분 만에 낡았다.** 그 사이 누군가 그 숫자를 근거로 쓰면
// 틀린 판단을 하게 된다. `CLAUDE.md` 가 DB 통계에 대해 이미 같은 규칙을 적어 두었다 —
// "손으로 고치지 말 것. 고쳐도 다음 실행에 덮어써지고, 그 사이에는 틀린 값이 근거로 쓰인다."
//
// 그래서 마커 사이를 **생성물**로 만든다. 서술(왜 이 축인가 · 무엇을 기각했는가)은
// 사람이 쓰고, **수치는 기계가 쓴다.**
//
// 재실행 안전: 같은 JSON 이면 결과가 같다. 마커 밖은 건드리지 않는다.
//
// 실행:
//   node scripts/textbook/gen-benchmark-report.mjs           # 리포트 갱신
//   node scripts/textbook/gen-benchmark-report.mjs --check   # 낡았으면 exit 1 (파일 안 고침)

import fs from 'node:fs'
import path from 'node:path'

const REPORT = path.resolve('docs/reports/textbook-publisher-benchmark.md')
const WAREHOUSE = path.resolve('docs/reports/textbook-publisher-benchmark.json')
const VOLUME = path.resolve('docs/reports/textbook-publisher-benchmark-volume.json')

const START = '<!-- BENCH:START — 이 아래는 gen-benchmark-report.mjs 생성물이다. 손으로 고치지 말 것 -->'
const END = '<!-- BENCH:END -->'

const AXES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']

const num = (x, d = 3) => (x == null ? '—' : Number(x).toFixed(d))
const mark = (i) => (i == null ? '—' : i >= 1.2 ? '✅' : i >= 1.0 ? '△' : '❌')

function table(rep) {
  const out = [
    `| 출판사 | ${AXES.join(' | ')} | 종합 | 천장 | 잰 축 |`,
    `|---|${AXES.map(() => '--:').join('|')}|--:|--:|:--:|`,
  ]
  for (const p of rep.publishers) {
    const cells = AXES.map((id) => {
      const a = p.axes.find((x) => x.id === id)
      return a && a.index != null ? num(a.index) : '—'
    })
    const overall = p.overallIndex == null ? '—' : `**${num(p.overallIndex)}** ${mark(p.overallIndex)}`
    out.push(
      `| ${p.publisher} | ${cells.join(' | ')} | ${overall} | ${num(p.reachableMax)} | ${p.axesMeasured}/${p.axesTotal} |`,
    )
  }
  return out.join('\n')
}

function build() {
  const wh = JSON.parse(fs.readFileSync(WAREHOUSE, 'utf8'))
  const vol = JSON.parse(fs.readFileSync(VOLUME, 'utf8'))

  const names = [...new Set([...wh.publishers, ...vol.publishers].map((p) => p.publisher))]
  const find = (rep, n) => rep.publishers.find((p) => p.publisher === n)

  const summary = [
    `| | ${names.join(' | ')} | 구속점 |`,
    `|---|${names.map(() => '--:').join('|')}|---|`,
    `| 창고 (재고 ${(wh.itemsMeasured ?? 0).toLocaleString()}) | ${names
      .map((n) => {
        const p = find(wh, n)
        return p?.overallIndex == null ? '—' : `${num(p.overallIndex)} ${mark(p.overallIndex)}`
      })
      .join(' | ')} | ${wh.bindingPublisher ?? '—'} ${num(wh.bindingIndex)} |`,
    `| **권 (${(vol.itemsMeasured ?? 0).toLocaleString()}문항)** | ${names
      .map((n) => {
        const p = find(vol, n)
        return p?.overallIndex == null ? '—' : `**${num(p.overallIndex)}** ${mark(p.overallIndex)}`
      })
      .join(' | ')} | **${vol.bindingPublisher ?? '—'} ${num(vol.bindingIndex)}** |`,
  ].join('\n')

  const met = vol.publishers.filter((p) => p.overallIndex != null && p.overallIndex >= 1.2).length
  const scored = vol.publishers.filter((p) => p.overallIndex != null).length

  return [
    START,
    '',
    `<!-- 생성 ${new Date().toISOString().slice(0, 19)}Z · 창고 ${wh.generatedAt?.slice(0, 19)}Z · 권 ${vol.generatedAt?.slice(0, 19)}Z -->`,
    '',
    '### 두 모드 요약',
    '',
    '창고는 **재고 품질**, 권은 **출간물 품질**이다. 아래 두 줄이 그 둘이다.',
    '',
    '⚠️ **학습자가 앱에서 쓰는 것은 이 둘 중 어느 쪽도 아니다.** 연습 경로',
    '(`textbook_practice_items`)는 조판과 다른 길이라 여기서 재지 않는다 — 실측 2026-09-01',
    '규격 적합률 **91.4%**(권은 100%). 게이트를 붙일지는 결정 사항이다:',
    '[연습 경로 규격](./textbook-practice-surface.md).',
    '',
    summary,
    '',
    `**출간물 기준 ${scored}곳 중 ${met}곳이 목표(1.200)에 닿았다.**`,
    '',
    `### 창고 모드 — \`csat_dcp_items\` ${(wh.itemsMeasured ?? 0).toLocaleString()}문항`,
    '',
    table(wh),
    '',
    `### 권 모드 — ${vol.scope ?? ''}`,
    '',
    table(vol),
    '',
    '### 못 잰 축',
    '',
    ...(() => {
      const rows = []
      for (const p of vol.publishers) {
        for (const a of p.axes) {
          if (a.insufficient) rows.push(`- **${p.publisher} ${a.id}** — ${a.insufficient}`)
        }
      }
      return rows.length ? rows : ['- (없음)']
    })(),
    '',
    '### 경쟁자에서 뺀 것',
    '',
    ...(vol.excluded ?? []).map((e) => `- **${e.publisher}** ${e.docs}종 ${e.pages}쪽 — ${e.why}`),
    '',
    END,
  ].join('\n')
}

function main() {
  const md = fs.readFileSync(REPORT, 'utf8')
  const eol = md.includes('\r\n') ? '\r\n' : '\n'
  const flat = md.split(/\r?\n/).join('\n')
  const i0 = flat.indexOf(START)
  const i1 = flat.indexOf(END)
  if (i0 < 0 || i1 < 0) {
    console.error(`마커가 없다 — ${REPORT} 에 다음 두 줄을 넣어라:\n  ${START}\n  ${END}`)
    process.exit(2)
  }

  const block = build()
  const next = flat.slice(0, i0) + block + flat.slice(i1 + END.length)

  // 생성 시각만 다른 것은 "낡음" 이 아니다 — 그 줄을 빼고 견준다.
  const strip = (s) => s.replace(/^<!-- 생성 .*-->$/gm, '')
  const same = strip(next) === strip(flat)

  if (process.argv.includes('--check')) {
    if (same) {
      console.log('리포트가 최신이다.')
      return
    }
    console.error('⚠ 리포트가 낡았다 — node scripts/textbook/gen-benchmark-report.mjs 로 갱신할 것.')
    process.exit(1)
  }

  fs.writeFileSync(REPORT, next.split('\n').join(eol))
  console.log(same ? '변화 없음 (시각만 갱신)' : `갱신됨 → ${REPORT}`)
}

main()
