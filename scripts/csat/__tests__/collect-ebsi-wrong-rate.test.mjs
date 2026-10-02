// scripts/csat/__tests__/collect-ebsi-wrong-rate.test.mjs

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalExamIdOf,
  extractSearchConfig,
  parseExamBlocks,
  parseWrongRateHtml,
  renderReport,
  responseSubjectIds,
  validateWrongRateRows,
} from '../collect-ebsi-wrong-rate.mjs'

const TARGET = { targetCd: 'D300', grade: 3, pageLabel: '고3' }
const CONFIG = { subjectId: '80003', areaOrder: '3', years: ['2026'], months: ['03'] }

test('실제 페이지의 학년·영어 과목·연도·월을 읽는다', () => {
  const html = `
    <html><head><title>EBSi | 고3·N수</title></head><body>
      <input name="targetCd" value="D300">
      <input name="year" value="2026"><input name="year" value="2025">
      <input name="month" value="03"><input name="month" value="09">
      <input name="engArOrd" value="3">
      <input name="sFormPartEng" value="80003">
    </body></html>`
  assert.deepEqual(extractSearchConfig(html, TARGET), {
    title: 'EBSi | 고3·N수',
    years: ['2026', '2025'],
    months: ['03', '09'],
    subjectId: '80003',
    areaOrder: '3',
  })
})

test('목록 버튼의 실제 인자를 학평 회차 ID와 출처 식별자로 바꾼다', () => {
  const html = `
    <div class="qus_box eng">
      <span class="flag_subject_col_basic">2026</span>
      <span class="flag_subject_col_basic">3월</span>
      <span class="flag_subject_col_eng">영어</span>
      <div class="qus_tit">고3 3월 학평(서울)&nbsp;영어&nbsp;</div>
      <button onclick="showGrdCutPopup('2027N03', '3103', '3', '2026', '고3 3월 학평(서울)', '영어');"><span>등급컷</span></button>
      <button onclick="showWrongRatePopup('202603243', '26600955', '2026', '0', '고3 3월 학평(서울)');"><span>오답률 TOP15</span></button>
    </div>`
  const [exam] = parseExamBlocks(html, TARGET, CONFIG, 1)
  assert.deepEqual(exam, {
    targetCd: 'D300',
    grade: 3,
    displayedYear: 2026,
    month: 3,
    title: '고3 3월 학평(서울) 영어',
    subject: '영어',
    subjectId: '80003',
    subjectVariant: 'english',
    series: 'national_achievement',
    region: '서울',
    sourcePage: 1,
    academicYear: 2027,
    gradeCutCode: '2027N03',
    irecord: '202603243',
    paperId: '26600955',
    wrongRateYear: 2026,
    evenForm: false,
    hasWrongRateButton: true,
    canonicalExamId: 'H2603G3',
  })
})

test('평가원 모평은 시행연도보다 한 해 큰 학년도 ID를 쓴다', () => {
  assert.equal(
    canonicalExamIdOf({
      displayedYear: 2026,
      month: 6,
      grade: 3,
      series: 'kice_mock',
      subjectVariant: 'english',
      academicYear: 2027,
      title: '고3 6월 모평(평가원)',
    }),
    'M2706'
  )
})

function wrongRow(rank) {
  const wrong = 80 - rank
  const correct = 100 - wrong
  const last = wrong - 55
  return `<tr class="resultArea subj_80003 on" name="orderWrong">
    <td>${rank}</td><td>${15 + rank}</td><td name="ratioByChoice">${wrong.toFixed(1)}</td>
    <td>3</td><td>②</td><td>-</td><td>-</td>
    <td name="ratioByChoice">10.0</td><td name="ratioByChoice">${correct.toFixed(1)}</td>
    <td name="ratioByChoice">25.0</td><td name="ratioByChoice">20.0</td>
    <td name="ratioByChoice">${last.toFixed(1)}</td>
    <td><a onclick="itemView(${21000000 + rank}, 2)">보기</a></td>
    <td><a onclick="fnVodSelect(26600955, ${21000000 + rank})">보기</a></td>
    <td><a onclick="fnAi(${21000000 + rank}, ${2000000 + rank})">보기</a></td>
  </tr>`
}

test('TOP15 표에서 비율·정답·최강 오답과 EBSi ID를 정규화한다', () => {
  const html = `<table name="orderWrong"><tbody><tr><td>1</td><td>16</td></tr></tbody></table>
    <div class="table_scroll_body"><table name="orderWrong"><tbody>
      ${Array.from({ length: 15 }, (_, i) => wrongRow(i + 1)).join('\n')}
    </tbody></table></div>`
  const exam = { canonicalExamId: 'H2603G3' }
  const rows = parseWrongRateHtml(html, '80003', exam)
  assert.equal(rows.length, 15)
  assert.deepEqual(rows[0], {
    canonicalItemId: 'H2603G3#16',
    rank: 1,
    no: 16,
    wrongRate: 0.79,
    points: 3,
    answer: 2,
    correctChoiceRate: 0.21,
    choiceRates: [0.1, 0.21, 0.25, 0.2, 0.24],
    choiceRateSum: 1,
    reportedWrongChoiceRate: 0.79,
    unreportedChoiceRate: 0,
    strongestDistractor: 3,
    strongestDistractorRate: 0.25,
    strongestDistractorLead: 0.01,
    ebsiItemId: '21000001',
    itemViewType: 2,
    ebsiProblemCategoryId: '2000001',
  })
  assert.deepEqual(validateWrongRateRows(rows), [])
})

test('선택률 미보고분은 허용하지만 100% 초과와 오답률 등식 위반은 막는다', () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({
    rank: i + 1,
    no: i + 1,
    wrongRate: 0.8 - i / 100,
    points: 2,
    answer: 1,
    correctChoiceRate: 0.1,
    choiceRates: [0.1, 0.25, 0.25, 0.25, 0.25],
  }))
  const errors = validateWrongRateRows(rows)
  assert.ok(errors.some((e) => e.includes('선택지 비율 합') && e.includes('> 1')))
  assert.ok(errors.some((e) => e.includes('오답률')))
})

test('과거 A/B형 응답의 당시 과목 ID를 표 클래스에서 발견한다', () => {
  const html = `<div class="table_scroll_body"><table name="orderWrong"><tbody>
    <tr class="resultArea subj_17026 on" name="orderWrong"><td>1</td><td>30</td><td name="ratioByChoice">70.0</td></tr>
  </tbody></table></div>`
  assert.deepEqual(responseSubjectIds(html), ['17026'])
})

test('보고서는 TOP15 밖을 미관측으로 명시한다', () => {
  const snapshot = {
    retrievedAt: '2026-10-02T00:00:00.000Z',
    summary: {
      examsDiscovered: 1,
      examsWithTop15: 1,
      top15Rows: 1,
      mappedCanonicalRows: 1,
      unsupportedBefore2013: 0,
      evenFormsSkipped: 0,
      notOffered: 0,
      invalid: 0,
      failed: 0,
      byGrade: {
        1: { exams: 0, withData: 0, rows: 0 },
        2: { exams: 0, withData: 0, rows: 0 },
        3: { exams: 1, withData: 1, rows: 1 },
      },
      bySeries: { national_achievement: { exams: 1, withData: 1, rows: 1 } },
    },
    exams: [
      {
        canonicalExamId: 'H2603G3',
        title: '고3 3월 학평',
        grade: 3,
        series: 'national_achievement',
        status: 'ok',
        rows: [
          {
            no: 30,
            rank: 1,
            wrongRate: 0.8,
            answer: 2,
            strongestDistractor: 4,
            strongestDistractorRate: 0.38,
            strongestDistractorLead: 0.09,
          },
        ],
      },
    ],
  }
  const report = renderReport(snapshot)
  assert.match(report, /TOP15 밖 30문항/)
  assert.match(report, /평가원 공식 통계나 전체 수험생 오답률이 아니다/)
  assert.match(report, /이번 수집은 DB를 변경하지 않는다/)
})
