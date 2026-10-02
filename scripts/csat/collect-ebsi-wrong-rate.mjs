// scripts/csat/collect-ebsi-wrong-rate.mjs
//
// EBSi 기출문제의 영어 「오답률 TOP15」를 실제 목록·팝업 요청으로 수집한다.
// 문제·지문·해설은 저장하지 않고 EBSi가 공개한 집계 통계와 출처 식별자만 남긴다.
//
// 실행: node scripts/csat/collect-ebsi-wrong-rate.mjs
// 보고서만 재생성: node scripts/csat/collect-ebsi-wrong-rate.mjs --render-existing
// 검사: node --test scripts/csat/__tests__/collect-ebsi-wrong-rate.test.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')

export const MAIN_URL = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperList.ebs'
export const LIST_URL = 'https://www.ebsi.co.kr/ebs/xip/xipc/previousPaperListAjax.ajax'
export const WRONG_RATE_URL =
  'https://www.ebsi.co.kr/ebs/xip/xipc/previousWrongRatePopupListAjax.ajax'

export const TARGETS = [
  { targetCd: 'D100', grade: 1, pageLabel: '고1' },
  { targetCd: 'D200', grade: 2, pageLabel: '고2' },
  { targetCd: 'D300', grade: 3, pageLabel: '고3' },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const RETRY_MS = [1_000, 2_000, 4_000]
const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

export function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

export function htmlToText(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
}

function matchOne(source, expression, label) {
  const hit = expression.exec(source)
  if (!hit) throw new Error(`${label}을(를) EBSi 응답에서 찾지 못했다`)
  return hit[1]
}

function matches(source, expression) {
  return [...source.matchAll(expression)].map((m) => m[1])
}

function unique(values) {
  return [...new Set(values)]
}

export function parseQuotedArguments(onclick) {
  return [...decodeHtml(onclick).matchAll(/'([^']*)'/g)].map((m) => decodeHtml(m[1]))
}

export function extractSearchConfig(mainHtml, target) {
  const title = htmlToText(matchOne(mainHtml, /<title>([\s\S]*?)<\/title>/i, '페이지 제목'))
  const actualTarget = matchOne(
    mainHtml,
    /<input[^>]+name="targetCd"[^>]+value="([^"]+)"/i,
    'targetCd'
  )
  if (actualTarget !== target.targetCd || !title.includes(target.pageLabel)) {
    throw new Error(`${target.targetCd} 페이지 검증 실패: title=${title}, targetCd=${actualTarget}`)
  }
  const years = unique(matches(mainHtml, /<input[^>]+name="year"[^>]+value="(\d{4})"/gi))
  const months = unique(matches(mainHtml, /<input[^>]+name="month"[^>]+value="(\d{2})"/gi))
  const subjectId = matchOne(
    mainHtml,
    /<input[^>]+name="sFormPartEng"[^>]+value="([^"]+)"/i,
    '영어 과목 ID'
  )
  const areaOrder = matchOne(
    mainHtml,
    /<input[^>]+name="engArOrd"[^>]+value="([^"]+)"/i,
    '영어 영역 순서'
  )
  if (!years.length || !months.length) throw new Error(`${target.targetCd} 연도·월 검색값이 비었다`)
  return { title, years, months, subjectId, areaOrder }
}

export function listRequestBody(targetCd, config, currentPage) {
  return new URLSearchParams({
    targetCd,
    yearList: config.years.join(','),
    monthList: config.months.join(','),
    arOrd: config.areaOrder,
    subjIdList: config.subjectId,
    currentPage: String(currentPage),
    sort: 'recent',
    paperId: '',
    paperNo: '',
    lvl: '',
  })
}

function examSeries(title) {
  if (/예비시행/.test(title)) return 'preliminary'
  if (/학평|학력평가/.test(title)) return 'national_achievement'
  if (/모평|모의평가/.test(title)) return 'kice_mock'
  if (/대학수학능력시험|(?:^|\s)수능(?:\s|$)/.test(title)) return 'suneung'
  return 'other'
}

function subjectVariant(subject, title) {
  const text = `${subject} ${title}`
  if (/영어\s*A|영어A/.test(text)) return 'A'
  if (/영어\s*B|영어B/.test(text)) return 'B'
  if (/외국어/.test(text)) return 'foreign_language'
  return 'english'
}

function academicYearFromGradeCut(args) {
  const m = /^(\d{4})N\d{2}$/.exec(args?.[0] ?? '')
  return m ? Number(m[1]) : null
}

export function canonicalExamIdOf(exam) {
  if (!Number.isInteger(exam.displayedYear) || !Number.isInteger(exam.month)) return null
  if (exam.series === 'national_achievement') {
    if (exam.subjectVariant !== 'english') return null
    return `H${String(exam.displayedYear).slice(2)}${String(exam.month).padStart(2, '0')}G${exam.grade}`
  }
  if (exam.series === 'kice_mock') {
    if (exam.subjectVariant !== 'english') return null
    const schoolYear = exam.academicYear ?? exam.displayedYear + 1
    return `M${String(schoolYear).slice(2)}${String(exam.month).padStart(2, '0')}`
  }
  if (exam.series === 'suneung') {
    const fromTitle = /(\d{4})학년도/.exec(exam.title)?.[1]
    const schoolYear = Number(fromTitle ?? exam.academicYear ?? exam.displayedYear + 1)
    if (!Number.isInteger(schoolYear)) return null
    if (exam.subjectVariant === 'A' || exam.subjectVariant === 'B')
      return `${schoolYear}${exam.subjectVariant}`
    if (exam.subjectVariant === 'foreign_language' || exam.subjectVariant === 'english')
      return String(schoolYear)
  }
  return null
}

function actionMap(block) {
  const out = new Map()
  for (const m of block.matchAll(
    /<button\b[^>]*onclick="([^"]*)"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<\/button>/gi
  )) {
    const label = htmlToText(m[2])
    out.set(label, { onclick: decodeHtml(m[1]), args: parseQuotedArguments(m[1]) })
  }
  return out
}

export function parseExamBlock(block, target, config, page) {
  const year = Number(
    matchOne(block, /flag_subject_col_basic[^>]*>\s*(\d{4})\s*<\/span>/i, '시행연도')
  )
  const flagTexts = matches(block, /flag_subject_col_basic[^>]*>([\s\S]*?)<\/span>/gi).map(
    htmlToText
  )
  const month = Number(/(\d{1,2})월/.exec(flagTexts.join(' '))?.[1] ?? 0)
  const subject = htmlToText(
    matchOne(block, /flag_subject_col_eng[^>]*>([\s\S]*?)<\/span>/i, '과목')
  )
  const title = htmlToText(matchOne(block, /<div class="qus_tit">([\s\S]*?)<\/div>/i, '시험명'))
  if (!/^(영어(?:A|B)?|외국어)$/.test(subject))
    throw new Error(`영어 이외 결과: ${year} ${title} [${subject}]`)

  const actions = actionMap(block)
  const wrong = actions.get('오답률 TOP15') ?? null
  const gradeCut = actions.get('등급컷') ?? null
  const variant = subjectVariant(subject, title)
  const series = examSeries(title)
  const region = /\(([^)]+)\)/.exec(title)?.[1] ?? null
  const exam = {
    targetCd: target.targetCd,
    grade: target.grade,
    displayedYear: year,
    month: month || null,
    title,
    subject,
    subjectId: config.subjectId,
    subjectVariant: variant,
    series,
    region,
    sourcePage: page,
    academicYear: academicYearFromGradeCut(gradeCut?.args),
    gradeCutCode: gradeCut?.args?.[0] ?? null,
    irecord: wrong?.args?.[0] ?? null,
    paperId: wrong?.args?.[1] ?? null,
    wrongRateYear: wrong?.args?.[2] ? Number(wrong.args[2]) : null,
    evenForm: wrong?.args?.[3] === '1',
    hasWrongRateButton: Boolean(wrong),
  }
  return { ...exam, canonicalExamId: canonicalExamIdOf(exam) }
}

export function parseExamBlocks(html, target, config, page) {
  return html
    .split(/<div class="qus_box\s+eng">/i)
    .slice(1)
    .map((block) => parseExamBlock(block, target, config, page))
}

function tableBodies(html) {
  const out = []
  for (const table of html.matchAll(/<table\b[^>]*name="orderWrong"[^>]*>([\s\S]*?)<\/table>/gi)) {
    const body = /<tbody>([\s\S]*?)<\/tbody>/i.exec(table[1])?.[1]
    if (body) out.push(body)
  }
  return out
}

export function responseSubjectIds(html) {
  const body = tableBodies(html).find((candidate) => candidate.includes('ratioByChoice'))
  if (!body) return []
  return unique(matches(body, /class="[^"]*\bsubj_(\d+)\b[^"]*"/gi))
}

function numberCell(value) {
  const n = Number(htmlToText(value))
  return Number.isFinite(n) ? n : null
}

function choiceNumber(value) {
  const text = htmlToText(value)
  return CIRCLED[text] ?? (Number.isInteger(Number(text)) ? Number(text) : null)
}

function round(value, digits = 4) {
  const unit = 10 ** digits
  return Math.round(value * unit) / unit
}

export function parseWrongRateHtml(html, subjectId, exam) {
  const body = tableBodies(html).find((candidate) => candidate.includes('ratioByChoice'))
  if (!body) return []
  const rows = []
  const classNeedle = `subj_${subjectId}`
  for (const tr of body.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    if (!tr[1].includes(classNeedle)) continue
    const cells = [...tr[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1])
    if (cells.length < 12) continue
    const rank = numberCell(cells[0])
    const no = numberCell(cells[1])
    const wrongPercent = numberCell(cells[2])
    const points = numberCell(cells[3])
    const answer = choiceNumber(cells[4])
    const choiceRates = cells
      .slice(7, 12)
      .map((cell) => round((numberCell(cell) ?? Number.NaN) / 100))
    const itemCall = /itemView\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(tr[2])
    const aiCall = /fnAi\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(tr[2])
    if (![rank, no, wrongPercent, points, answer].every(Number.isFinite)) continue
    const wrongRates = choiceRates
      .map((rate, i) => ({ choice: i + 1, rate }))
      .filter((r) => r.choice !== answer)
    wrongRates.sort((a, b) => b.rate - a.rate || a.choice - b.choice)
    const choiceRateSum = round(choiceRates.reduce((a, b) => a + b, 0))
    const reportedWrongChoiceRate = round(
      choiceRates.reduce((sum, rate, i) => sum + (i + 1 === answer ? 0 : rate), 0)
    )
    rows.push({
      canonicalItemId: exam.canonicalExamId ? `${exam.canonicalExamId}#${no}` : null,
      rank,
      no,
      wrongRate: round(wrongPercent / 100),
      points,
      answer,
      correctChoiceRate: choiceRates[answer - 1],
      choiceRates,
      choiceRateSum,
      reportedWrongChoiceRate,
      unreportedChoiceRate: round(Math.max(0, 1 - choiceRateSum)),
      strongestDistractor: wrongRates[0]?.choice ?? null,
      strongestDistractorRate: wrongRates[0]?.rate ?? null,
      strongestDistractorLead: round((wrongRates[0]?.rate ?? 0) - (wrongRates[1]?.rate ?? 0)),
      ebsiItemId: itemCall?.[1] ?? aiCall?.[1] ?? null,
      itemViewType: itemCall ? Number(itemCall[2]) : null,
      ebsiProblemCategoryId: aiCall?.[2] ?? null,
    })
  }
  return rows.sort((a, b) => a.rank - b.rank || a.no - b.no)
}

export function validateWrongRateRows(rows) {
  const errors = []
  if (rows.length !== 15) errors.push(`TOP15 행 수 ${rows.length}`)
  const ranks = new Set()
  const numbers = new Set()
  for (const row of rows) {
    if (!Number.isInteger(row.rank) || row.rank < 1 || row.rank > 15)
      errors.push(`순위 범위 밖: ${row.rank}`)
    if (ranks.has(row.rank)) errors.push(`순위 중복: ${row.rank}`)
    ranks.add(row.rank)
    if (!Number.isInteger(row.no) || row.no < 1 || row.no > 45)
      errors.push(`문항 번호 범위 밖: ${row.no}`)
    if (numbers.has(row.no)) errors.push(`문항 번호 중복: ${row.no}`)
    numbers.add(row.no)
    if (![2, 3].includes(row.points)) errors.push(`${row.no}번 배점 ${row.points}`)
    if (!Number.isInteger(row.answer) || row.answer < 1 || row.answer > 5)
      errors.push(`${row.no}번 정답 ${row.answer}`)
    if (
      row.choiceRates.length !== 5 ||
      row.choiceRates.some((rate) => !Number.isFinite(rate) || rate < 0 || rate > 1)
    ) {
      errors.push(`${row.no}번 선택지 비율 형식`)
      continue
    }
    const sum = row.choiceRates.reduce((a, b) => a + b, 0)
    // 구형 응답은 ①~⑤ 합이 100%보다 작다. EBSi는 빠진 몫의 이름을 응답에 싣지 않으므로
    // 재정규화하지 않고 unreportedChoiceRate 로 보존한다. 100%를 넘는 것만 반올림 허용폭 뒤에서 막는다.
    if (sum > 1.0021) errors.push(`${row.no}번 선택지 비율 합 ${round(sum)} > 1`)
    if (Math.abs(row.wrongRate - (1 - row.correctChoiceRate)) > 0.0021) {
      errors.push(
        `${row.no}번 오답률 ${row.wrongRate} != 1-정답선택률 ${round(1 - row.correctChoiceRate)}`
      )
    }
  }
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i - 1].wrongRate + 0.0001 < rows[i].wrongRate)
      errors.push(`오답률 내림차순 아님: ${rows[i - 1].rank}→${rows[i].rank}`)
  }
  return unique(errors)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchText(url, options = {}, deps = {}) {
  const runFetch = deps.fetch ?? fetch
  const wait = deps.sleep ?? sleep
  let last
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await runFetch(url, {
        redirect: 'follow',
        ...options,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          ...(options.headers ?? {}),
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      return await response.text()
    } catch (error) {
      last = error
      if (attempt < 2) await wait(RETRY_MS[attempt])
    }
  }
  throw last
}

function postHeaders(targetCd) {
  return {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'x-requested-with': 'XMLHttpRequest',
    referer: `${MAIN_URL}?targetCd=${targetCd}`,
  }
}

function deduplicateExams(exams) {
  const out = new Map()
  for (const exam of exams) {
    const key = [
      exam.targetCd,
      exam.irecord ?? '',
      exam.paperId ?? '',
      exam.displayedYear,
      exam.month,
      exam.title,
    ].join('|')
    if (!out.has(key)) out.set(key, exam)
  }
  return [...out.values()]
}

function statusBeforeFetch(exam) {
  if (exam.displayedYear < 2013) return 'unsupported_before_2013'
  if (exam.evenForm) return 'even_form_uses_odd_only'
  if (!exam.hasWrongRateButton || !exam.irecord || !exam.paperId) return 'not_offered'
  return null
}

export async function discoverExams(deps = {}) {
  const fetcher = deps.fetchText ?? fetchText
  const wait = deps.sleep ?? sleep
  const gap = deps.gapMs ?? 300
  const exams = []
  const discovery = []
  for (const target of TARGETS) {
    const mainHtml = await fetcher(`${MAIN_URL}?targetCd=${target.targetCd}`, {
      headers: { referer: 'https://www.ebsi.co.kr/' },
    })
    await wait(gap)
    const config = extractSearchConfig(mainHtml, target)
    const requestPage = async (page) => {
      const html = await fetcher(LIST_URL, {
        method: 'POST',
        headers: postHeaders(target.targetCd),
        body: listRequestBody(target.targetCd, config, page),
      })
      await wait(gap)
      return html
    }
    const first = await requestPage(1)
    const total = Number(
      matchOne(first, /총\s*<em[^>]*class="tot"[^>]*>(\d+)개<\/em>/i, '검색 결과 수')
    )
    const linkedPages = matches(first, /goPage\((\d+)\)/gi).map(Number)
    const pageCount = Math.max(
      Math.ceil(total / 15),
      linkedPages.length ? Math.max(...linkedPages) : 1
    )
    let found = parseExamBlocks(first, target, config, 1)
    for (let page = 2; page <= pageCount; page += 1)
      found.push(...parseExamBlocks(await requestPage(page), target, config, page))
    if (found.length !== total)
      throw new Error(`${target.pageLabel} 페이지네이션: EBSi ${total}, 수집 ${found.length}`)
    console.log(
      `[목록] ${target.pageLabel} ${total}회 · ${pageCount}페이지 · 영어 ${config.subjectId}`
    )
    discovery.push({
      targetCd: target.targetCd,
      grade: target.grade,
      pageTitle: config.title,
      subjectId: config.subjectId,
      years: config.years,
      months: config.months,
      exams: total,
      pages: pageCount,
    })
    exams.push(...found)
  }
  return { discovery, exams: deduplicateExams(exams) }
}

function summaryOf(exams) {
  const count = (predicate) => exams.filter(predicate).length
  const rows = exams.flatMap((exam) => exam.rows ?? [])
  const byGrade = Object.fromEntries(
    [1, 2, 3].map((grade) => [
      grade,
      {
        exams: count((e) => e.grade === grade),
        withData: count((e) => e.grade === grade && e.status === 'ok'),
        rows: exams.filter((e) => e.grade === grade).reduce((n, e) => n + (e.rows?.length ?? 0), 0),
      },
    ])
  )
  const series = unique(exams.map((e) => e.series)).sort()
  const bySeries = Object.fromEntries(
    series.map((name) => [
      name,
      {
        exams: count((e) => e.series === name),
        withData: count((e) => e.series === name && e.status === 'ok'),
        rows: exams.filter((e) => e.series === name).reduce((n, e) => n + (e.rows?.length ?? 0), 0),
      },
    ])
  )
  return {
    examsDiscovered: exams.length,
    examsWithTop15: count((e) => e.status === 'ok'),
    top15Rows: rows.length,
    unsupportedBefore2013: count((e) => e.status === 'unsupported_before_2013'),
    evenFormsSkipped: count((e) => e.status === 'even_form_uses_odd_only'),
    notOffered: count((e) => e.status === 'not_offered' || e.status === 'no_data'),
    invalid: count((e) => e.status === 'invalid'),
    failed: count((e) => e.status === 'failed'),
    mappedCanonicalRows: rows.filter((row) => row.canonicalItemId).length,
    byGrade,
    bySeries,
  }
}

export async function collectSnapshot(options = {}, deps = {}) {
  const now = options.retrievedAt
  if (!now || Number.isNaN(Date.parse(now))) throw new Error('retrievedAt ISO 시각을 주입해야 한다')
  const discovered = await discoverExams({ ...deps, gapMs: options.gapMs ?? 300 })
  const selected = options.onlyExam
    ? discovered.exams.filter((exam) => exam.canonicalExamId === options.onlyExam)
    : discovered.exams
  if (options.onlyExam && !selected.length)
    throw new Error(`회차를 찾지 못했다: ${options.onlyExam}`)
  const fetcher = deps.fetchText ?? fetchText
  const wait = deps.sleep ?? sleep
  const gap = options.gapMs ?? 300
  const fetchable = selected.filter((exam) => statusBeforeFetch(exam) === null)
  let progress = 0
  for (const exam of selected) {
    const early = statusBeforeFetch(exam)
    if (early) {
      exam.status = early
      exam.rows = []
      continue
    }
    progress += 1
    const prefix = `[${String(progress).padStart(3, '0')}/${String(fetchable.length).padStart(3, '0')}]`
    try {
      const body = new URLSearchParams({
        irecord: exam.irecord,
        paperId: exam.paperId,
        year: String(exam.wrongRateYear ?? exam.displayedYear),
        title: exam.title,
      })
      const html = await fetcher(WRONG_RATE_URL, {
        method: 'POST',
        headers: postHeaders(exam.targetCd),
        body,
      })
      await wait(gap)
      const responseSubjects = responseSubjectIds(html)
      const responseSubjectId = responseSubjects.includes(exam.subjectId)
        ? exam.subjectId
        : responseSubjects.length === 1
          ? responseSubjects[0]
          : null
      exam.responseSubjectId = responseSubjectId
      const rows = responseSubjectId ? parseWrongRateHtml(html, responseSubjectId, exam) : []
      const validationErrors = rows.length
        ? validateWrongRateRows(rows)
        : responseSubjects.length > 1
          ? [`응답 과목 ID를 고를 수 없다: ${responseSubjects.join(',')}`]
          : []
      exam.rows = rows
      exam.validationErrors = validationErrors
      exam.status = !rows.length ? 'no_data' : validationErrors.length ? 'invalid' : 'ok'
      console.log(
        `${prefix} ${exam.canonicalExamId ?? exam.title} → ${exam.status.toUpperCase()}${rows.length ? ` (${rows.length})` : ''}`
      )
    } catch (error) {
      exam.status = 'failed'
      exam.rows = []
      exam.failure = error instanceof Error ? error.message : String(error)
      console.error(`${prefix} ${exam.canonicalExamId ?? exam.title} → FAILED (${exam.failure})`)
    }
  }
  const validationErrors = selected.flatMap((exam) =>
    exam.status === 'invalid'
      ? exam.validationErrors.map((message) => `${exam.canonicalExamId ?? exam.title}: ${message}`)
      : exam.status === 'failed'
        ? [`${exam.canonicalExamId ?? exam.title}: ${exam.failure}`]
        : []
  )
  return {
    schemaVersion: 1,
    retrievedAt: now,
    source: {
      provider: 'EBSi',
      listPage: MAIN_URL,
      listEndpoint: LIST_URL,
      wrongRateEndpoint: WRONG_RATE_URL,
      method: 'POST application/x-www-form-urlencoded',
    },
    scope: {
      targets: TARGETS.map(({ targetCd, grade }) => ({ targetCd, grade })),
      subject: '영어',
      ranking: '오답률 TOP15',
      note: 'EBSi 검색 페이지의 전체 연도·전체 월·영어 결과를 마지막 페이지까지 순회',
    },
    semantics: {
      rateUnit: '0..1',
      rowsAreCensored: true,
      censoring: '각 시험의 TOP15만 제공되므로 나머지 문항은 0이나 평균이 아니라 미관측이다.',
      population:
        'EBSi 응답자가 만든 플랫폼 집계로 보이며 응답자 수가 제공되지 않는다. 평가원 공식 또는 전체 수험생 모집단 통계로 간주하지 않는다.',
    },
    discovery: discovered.discovery,
    summary: summaryOf(selected),
    validation: { ok: validationErrors.length === 0, errors: validationErrors },
    exams: selected,
  }
}

function pct(rate) {
  return `${(100 * rate).toFixed(1)}%`
}

function kstTimestamp(iso) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const part = (name) => parts.find((p) => p.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')} KST`
}

function table(rows) {
  return rows.length ? rows.join('\n') : '| — | — |'
}

export function renderReport(snapshot) {
  const ok = snapshot.exams.filter((exam) => exam.status === 'ok')
  const rows = ok.flatMap((exam) => exam.rows.map((row) => ({ exam, row })))
  const byNo = new Map()
  for (const { row } of rows) {
    const cur = byNo.get(row.no) ?? { no: row.no, n: 0, rate: 0, rank: 0 }
    cur.n += 1
    cur.rate += row.wrongRate
    cur.rank += row.rank
    byNo.set(row.no, cur)
  }
  const frequent = [...byNo.values()]
    .sort((a, b) => b.n - a.n || b.rate / b.n - a.rate / a.n || a.no - b.no)
    .slice(0, 15)
  const hardest = [...rows]
    .sort((a, b) => b.row.wrongRate - a.row.wrongRate || a.row.rank - b.row.rank)
    .slice(0, 20)
  const dominant = rows.filter(({ row }) => (row.strongestDistractorRate ?? 0) >= 0.3).length
  const closeDistractors = rows.filter(
    ({ row }) => (row.strongestDistractorLead ?? 1) <= 0.05
  ).length
  const unreportedGt10 = rows.filter(({ row }) => (row.unreportedChoiceRate ?? 0) > 0.1).length
  const maxUnreported = rows.reduce(
    (max, { row }) => Math.max(max, row.unreportedChoiceRate ?? 0),
    0
  )
  const s = snapshot.summary
  return `# EBSi 영어 기출 오답률 TOP15 — 수집 결과

> 생성 시각: ${kstTimestamp(snapshot.retrievedAt)} (${snapshot.retrievedAt}) · 출처: EBSi 「기출문제」 · 단위: 0~1 비율  
> 재현: \`node scripts/csat/collect-ebsi-wrong-rate.mjs\`

## 결과

| 항목 | 값 |
|---|---:|
| 발견한 영어 시험 | ${s.examsDiscovered}회 |
| TOP15 정상 수집 | ${s.examsWithTop15}회 |
| 정규화 행 | ${s.top15Rows}행 |
| Vocaflow 문항 ID 연결 | ${s.mappedCanonicalRows}행 |
| 2013년 이전 미지원 | ${s.unsupportedBefore2013}회 |
| 짝수형 제외 | ${s.evenFormsSkipped}회 |
| EBSi 미제공·빈 응답 | ${s.notOffered}회 |
| 검증 실패 | ${s.invalid}회 |
| 요청 실패 | ${s.failed}회 |

### 학년별

| 학년 | 발견 시험 | TOP15 시험 | 행 |
|---|---:|---:|---:|
${table([1, 2, 3].map((grade) => `| 고${grade} | ${s.byGrade[grade].exams} | ${s.byGrade[grade].withData} | ${s.byGrade[grade].rows} |`))}

### 시험 계열별

| 계열 | 발견 시험 | TOP15 시험 | 행 |
|---|---:|---:|---:|
${table(Object.entries(s.bySeries).map(([name, value]) => `| ${name} | ${value.exams} | ${value.withData} | ${value.rows} |`))}

## 데이터 계약

시험은 \`canonicalExamId\`, 문항은 \`canonicalItemId\`로 현재 Vocaflow ID와 연결한다. 각 TOP15 행은 다음 값을 갖는다.

- \`rank\`, \`no\`, \`wrongRate\`, \`points\`, \`answer\`
- \`choiceRates[5]\`: ①~⑤ 선택률
- \`choiceRateSum\`, \`unreportedChoiceRate\`: EBSi 표에 표시된 선택률 합과 미보고분
- \`correctChoiceRate\`
- \`strongestDistractor\`, \`strongestDistractorRate\`, \`strongestDistractorLead\`
- \`ebsiItemId\`, \`ebsiProblemCategoryId\`: EBSi 내부 연결 식별자

수집기는 모든 행에서 선택률 합이 100%를 넘지 않는지, 오답률이 \`1 - 정답 선택률\`인지, TOP15가 내림차순인지 검증한다. 구형 회차는 ①~⑤ 합이 100%보다 작은 경우가 있어 그 차이를 \`unreportedChoiceRate\`로 남기며, 비율을 임의로 재정규화하지 않는다. 미보고분이 10%p를 넘는 행은 ${unreportedGt10}/${rows.length}, 최대는 ${pct(maxUnreported)}다.

## 학습 지도 설계에 쓸 수 있는 것

1. **시험 안에서 먼저 가르칠 문항**: TOP15 순위는 같은 시험 안에서 우선순위를 정하는 근거다.
2. **가장 강한 오답 유인**: \`strongestDistractor\`와 선택률을 기존 \`choice_analysis\`의 함정 라벨과 결합하면 “어떤 오답이 실제로 많이 선택됐는가”를 검증할 수 있다.
3. **함정의 경쟁 구조**: 최강 오답 선택률이 30% 이상인 행은 ${dominant}/${rows.length}, 상위 두 오답 선택률 차가 5%p 이하인 행은 ${closeDistractors}/${rows.length}이다. 한 오답에 집중된 문항과 여러 오답이 경쟁하는 문항을 다른 지도 방식으로 나눌 수 있다.
4. **진단 난이도 보정의 관측값**: 값이 있는 TOP15에만 \`hasEbsiWrongRate=true\`로 사용하고, 나머지는 반드시 미관측으로 둔다.

### TOP15에 자주 등장한 문항 번호

| 문항 | 등장 | 평균 오답률 | 평균 순위 |
|---:|---:|---:|---:|
${table(frequent.map((r) => `| ${r.no} | ${r.n} | ${pct(r.rate / r.n)} | ${(r.rank / r.n).toFixed(1)} |`))}

### 수집값 상위 20행

| 시험 | 문항 | 순위 | 오답률 | 정답 | 최강 오답(비율) |
|---|---:|---:|---:|---:|---:|
${table(hardest.map(({ exam, row }) => `| ${exam.canonicalExamId ?? exam.title} | ${row.no} | ${row.rank} | ${pct(row.wrongRate)} | ${row.answer} | ${row.strongestDistractor} (${pct(row.strongestDistractorRate)}) |`))}

## 해석 경계

- EBSi는 응답자 수·표집 방식·집계 시점을 응답에 싣지 않는다. 따라서 이 값은 **EBSi 플랫폼 응답 집계**이며 평가원 공식 통계나 전체 수험생 오답률이 아니다.
- TOP15 밖 30문항은 쉬운 문항이라는 뜻이 아니라 **정확한 비율이 관측되지 않은 문항**이다. 0·평균·15위 값으로 채우지 않는다.
- 서로 다른 시험·학년의 응답자 구성이 같다는 보장이 없으므로 소수점 차이로 시험 난도를 서열화하지 않는다.
- 현재 DB의 \`csat_items.official_error_rate\`는 이름이 “공식”을 전제한다. EBSi 값을 넣기 전에는 출처가 붙는 별도 통계 테이블 또는 컬럼 의미 변경이 필요하다.

## 구현 권고

출처와 스냅샷을 잃지 않도록 다음 키를 가진 별도 원장을 권한다.

\`(item_id, provider='ebsi', metric='wrong_rate_top15', retrieved_at)\`

원장에는 \`rate\`, \`rank\`, \`choice_rates\`, \`provider_item_id\`, \`source_exam_key\`를 보존한다. 진단 엔진은 “공식 오답률” 하나를 읽기보다 출처별 통계를 선택하는 정책을 명시해야 한다. 이번 수집은 DB를 변경하지 않는다.
`
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const part = `${file}.part`
  try {
    fs.writeFileSync(part, content)
    fs.renameSync(part, file)
  } finally {
    fs.rmSync(part, { force: true })
  }
}

function argOf(args, name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const output = path.resolve(
    argOf(args, '--output') ?? path.join(HERE, 'data/ebsi-wrong-rate-top15.json')
  )
  const report = path.resolve(
    argOf(args, '--report') ?? path.join(ROOT, 'docs/reports/ebsi-wrong-rate-top15.md')
  )
  if (args.includes('--render-existing')) {
    const snapshot = JSON.parse(fs.readFileSync(output, 'utf8'))
    writeAtomic(report, renderReport(snapshot))
    console.log(`→ ${path.relative(ROOT, report)} (기존 스냅샷 재렌더)`)
    return
  }
  const onlyExam = argOf(args, '--only')
  const gapMs = Number(argOf(args, '--gap-ms') ?? 300)
  if (!Number.isFinite(gapMs) || gapMs < 200) throw new Error('--gap-ms는 200 이상이어야 한다')
  const retrievedAt = process.env.EBSI_RETRIEVED_AT ?? new Date().toISOString()
  const snapshot = await collectSnapshot({ retrievedAt, onlyExam, gapMs })
  writeAtomic(output, JSON.stringify(snapshot, null, 2) + '\n')
  writeAtomic(report, renderReport(snapshot))
  console.log(`\n→ ${path.relative(ROOT, output)} (${snapshot.summary.top15Rows}행)`)
  console.log(`→ ${path.relative(ROOT, report)}`)
  if (!snapshot.validation.ok) {
    console.error(`검증 실패 ${snapshot.validation.errors.length}건`)
    process.exitCode = 1
  }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) await main()
