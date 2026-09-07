// scripts/dict/measure-surface-fixes.mts
//
// **어떤 수정이 표면형 미스를 얼마나 줄이는가** — 고치기 전에 잰다.
// 후보 넷을 누적으로 켜 가며 같은 표본에 대고 잰다:
//   ① spelling_variants (영/미 철자) ② 비교급·최상급 ③ 불규칙 복수 규칙 ④ 셋 다
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/dict/measure-surface-fixes.mts [표본수]
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const N = Number(process.argv[2] ?? 30000)
const t = fs.readFileSync('apps/web/.env.local', 'utf8')
const g = (k: string) => (t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm')) ?? [])[1]?.trim().replace(/^["']|["']$/g, '')
const db = createClient(g('NEXT_PUBLIC_SUPABASE_URL')!, g('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 현행 규칙 (surface-match.ts 복제) */
function basePats(w: string): string[] {
  const e = esc(w)
  const p = [e, `${e}(?:s|es|ed|ing|d)`]
  if (/[^aeiou]y$/i.test(w)) p.push(`${esc(w.slice(0, -1))}(?:ies|ied|ying)`)
  if (/e$/i.test(w)) p.push(`${esc(w.slice(0, -1))}(?:ing|ed|es)`)
  if (/[^aeiou][aeiou][^aeiouwxy]$/i.test(w)) p.push(`${e}${esc(w.slice(-1))}(?:ed|ing)`)
  return p
}
/** ② 비교급·최상급 */
function degreePats(w: string): string[] {
  const p: string[] = []
  if (w.length > 2 && w.length <= 12) {
    p.push(`${esc(w)}(?:er|est)`)
    if (/[^aeiou]y$/i.test(w)) p.push(`${esc(w.slice(0, -1))}i(?:er|est)`)
    if (/e$/i.test(w)) p.push(`${esc(w.slice(0, -1))}(?:er|est)`)
    if (/[^aeiou][aeiou][^aeiouwxy]$/i.test(w)) p.push(`${esc(w)}${esc(w.slice(-1))}(?:er|est)`)
  }
  return p
}
/** ③ 라틴·그리스·-f 복수 */
function pluralPats(w: string): string[] {
  const p: string[] = []
  const add = (s: string) => p.push(esc(s))
  if (/[lr]f$/i.test(w)) add(w.slice(0, -1) + 'ves')
  if (/fe$/i.test(w)) add(w.slice(0, -2) + 'ves')
  if (/sis$/i.test(w)) add(w.slice(0, -2) + 'es')
  if (/[^aeiou]us$/i.test(w)) add(w.slice(0, -2) + 'i')
  if (/um$/i.test(w)) add(w.slice(0, -2) + 'a')
  if (/(ex|ix)$/i.test(w)) add(w.slice(0, -2) + 'ices')
  if (/[^aeiou]a$/i.test(w)) add(w + 'e')
  if (/on$/i.test(w)) add(w.slice(0, -2) + 'a')
  return p
}
/** 매칭된 표면형(없으면 null) — 무엇이 잡혔는지까지 봐야 오탐을 판정할 수 있다 */
/**
 * ⑥ 영/미 철자 변이 — **규칙으로 만든다.**
 *
 * `spelling_variants` 컬럼은 0.6% 만 차 있는데(실측), 미스 표본의 최대 갈래가 이것이다:
 * traveler↔travellers · parlor↔parlour · watercolor↔watercolours · unfavorably↔unfavourably ·
 * glamor↔glamour · monolog↔monologue. 저장소의 표제어는 미국 철자이고 원서(구텐베르크)는
 * 영국 철자가 많아 **체계적으로** 어긋난다. 사람이 채울 것이 아니라 규칙이 만들 것이다.
 */
function spellingPats(w: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => { if (s && s !== w) out.add(s) }
  // -or → -our (color→colour) · 어간 뒤 접미까지 (colors→colours 는 basePats 가 -s 를 붙인다)
  if (/[^aeiou]or$/.test(w)) add(w.slice(0, -2) + 'our')
  if (/[^aeiou]our$/.test(w)) add(w.slice(0, -3) + 'or')
  if (/orous$/.test(w)) add(w.slice(0, -5) + 'ourous')
  if (/orful$/.test(w)) add(w.slice(0, -5) + 'ourful')
  if (/orless$/.test(w)) add(w.slice(0, -6) + 'ourless')
  if (/orably$/.test(w)) add(w.slice(0, -6) + 'ourably')
  if (/orable$/.test(w)) add(w.slice(0, -6) + 'ourable')
  // -ize/-ization → -ise/-isation · -yze → -yse
  if (/iz(e|es|ed|ing|er|ers|ation|ations)$/.test(w)) add(w.replace(/iz/, 'is'))
  if (/yz(e|es|ed|ing)$/.test(w)) add(w.replace(/yz/, 'ys'))
  // -er → -re (center→centre) · -ense → -ence
  if (/[bcdgkpt]er$/.test(w)) add(w.slice(0, -2) + 're')
  if (/[bcdgkpt]re$/.test(w)) add(w.slice(0, -2) + 'er')
  if (/ense$/.test(w)) add(w.slice(0, -4) + 'ence')
  // -og → -ogue (catalog→catalogue · monolog→monologue)
  if (/[aeiou]log$/.test(w)) add(w + 'ue')
  // l 중복 (traveler→traveller · marvelous→marvellous · jewelry→jewellery)
  if (/[aeiou]l(ed|er|ers|ing|ous|ously)$/.test(w)) add(w.replace(/l(?=(ed|er|ers|ing|ous|ously)$)/, 'll'))
  if (/elry$/.test(w)) add(w.slice(0, -3) + 'lery')
  // ae/oe (encyclopedia→encyclopaedia · maneuver→manoeuvre)
  if (/edia$/.test(w)) add(w.slice(0, -4) + 'aedia')
  // -ay → -ey 류는 위험해 넣지 않는다 (gray/grey 는 변이지만 pay/pey 같은 오탐을 만든다)
  if (w === 'gray') add('grey')
  if (w === 'grey') add('gray')
  return [...out].map((s) => `${esc(s)}(?:s|es|ed|ing|d)?`)
}

function hitWhat(sentence: string, lemma: string, literals: string[], extra: string[]): string | null {
  const lits = [...new Set([lemma, ...literals].map((f) => f.trim().toLowerCase()).filter((f) => f.length >= 2))]
    .sort((a, b) => b.length - a.length).map(esc)
  const alts = [...lits, ...basePats(lemma), ...extra]
  try { return new RegExp(`\\b(?:${alts.join('|')})\\b`, 'i').exec(sentence)?.[0] ?? null } catch { return null }
}

/**
 * 일시적 5xx·fetch 실패에 물러섰다 다시 — Supabase 앞단(Cloudflare)이 간헐로 끊는다.
 *
 * ⚠️ supabase-js 는 fetch 실패를 **던지지 않고 `{ error }` 로 돌려준다.** 그래서 try/catch 만
 *    두면 재시도가 한 번도 안 걸리고 그대로 죽는다(실측 2026-09-05). 반환값의 error 도 본다.
 */
async function retry<T extends { error: unknown }>(fn: () => PromiseLike<T>, tries = 5): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fn()
      if (!r.error) return r
      last = r
    } catch (e) {
      last = { error: e } as T
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }
  return last as T
}

async function main() {
  const pairs: Array<{ w: string; s: string }> = []
  let from = 0
  while (pairs.length < N) {
    // ⚠️ **정렬 없이 `range()` 로 넘기면 표본이 매번 달라진다** — PostgreSQL 은 ORDER BY 가 없으면
    //    페이지 사이 행 순서를 보장하지 않는다. 실측 2026-09-05: 같은 스크립트 두 번에
    //    28,475 / 29,107 로 표본이 달라 전후 비교가 성립하지 않았다. id 로 고정한다.
    const { data, error } = await retry(() => db.from('library_book_vocabularies')
      .select('id, word, lemma, first_sentence').not('first_sentence', 'is', null)
      .order('id').range(from, from + 999))
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as any[]
    if (!rows.length) break
    for (const r of rows) {
      const w = String(r.lemma ?? r.word ?? '').toLowerCase()
      if (w.length >= 2 && r.first_sentence) pairs.push({ w, s: r.first_sentence })
    }
    from += 1000
  }
  const words = [...new Set(pairs.map((p) => p.w))]
  const dict = new Map<string, { f: string[]; v: string[]; pos: string }>()
  for (let i = 0; i < words.length; i += 200) {
    const { data, error } = await retry(() => db.from('shared_dictionary')
      .select('word, primary_pos, inflected_forms, spelling_variants, derived_forms').in('word', words.slice(i, i + 200)))
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as any[]) {
      dict.set(r.word.toLowerCase(), { f: r.inflected_forms ?? [], v: r.spelling_variants ?? [], pos: r.primary_pos ?? '(none)' })
    }
  }
  const variants: Array<[string, (d: any, w: string) => { lits: string[]; extra: string[] }]> = [
    ['현행 (inflected_forms만)', (d) => ({ lits: d.f, extra: [] })],
    ['① + spelling_variants', (d) => ({ lits: [...d.f, ...d.v], extra: [] })],
    ['② + 비교급/최상급', (d, w) => ({ lits: d.f, extra: degreePats(w) })],
    ['③ + 불규칙 복수', (d, w) => ({ lits: d.f, extra: pluralPats(w) })],
    ['④ ①+②+③ 전부', (d, w) => ({ lits: [...d.f, ...d.v], extra: [...degreePats(w), ...pluralPats(w)] })],
    // ⑤ 비교급을 **형용사·부사에만** 건다. ② 의 오탐(fib→fiber · make→maker · whit→whiter)은
    //    전부 명사·동사에서 나왔다 — 품사로 잠그면 규칙을 버리지 않고 오탐만 없앤다.
    ['⑤ 비교급(형용사·부사만)+③', (d, w) => ({
      lits: [...d.f, ...d.v],
      extra: [...(d.pos === 'adjective' || d.pos === 'adverb' ? degreePats(w) : []), ...pluralPats(w)],
    })],
    ['⑥ 영/미 철자 규칙만', (d, w) => ({ lits: d.f, extra: spellingPats(w) })],
    ['⑦ ⑤+⑥ (채택안)', (d, w) => ({
      lits: [...d.f, ...d.v],
      extra: [
        ...(d.pos === 'adjective' || d.pos === 'adverb' ? degreePats(w) : []),
        ...pluralPats(w), ...spellingPats(w),
      ],
    })],
  ]
  console.log('')
  // 새로 잡히는 표면형을 **눈으로 본다** — 미스가 줄었다고 옳게 잡힌 것은 아니다.
  // `-er` 은 비교급만이 아니라 행위자 명사(work→worker)도 만든다. 그것을 빈칸으로 뚫으면
  // 학습자에게 **다른 낱말**을 지운 문장을 보여 주는 셈이라, 미스보다 나쁘다.
  const gained = new Map<string, Set<string>>()
  for (const [label, build] of variants) {
    let n = 0, miss = 0
    for (const p of pairs) {
      const d = dict.get(p.w); if (!d) continue
      n += 1
      const { lits, extra } = build(d, p.w)
      const m = hitWhat(p.s, p.w, lits, extra)
      if (!m) miss += 1
      else if (label !== '현행 (inflected_forms만)' && !hitWhat(p.s, p.w, d.f, [])) {
        const k = gained.get(label) ?? new Set<string>()
        if (k.size < 40) k.add(`${p.w} → ${m}`)
        gained.set(label, k)
      }
    }
    console.log(`  ${label.padEnd(26)} 미스 ${String(miss).padStart(5)} / ${n}  ${((miss / n) * 100).toFixed(2)}%`)
  }
  for (const [label, set] of gained) {
    if (label.startsWith('④')) continue
    console.log(`\n  ── ${label} 로 새로 잡힌 표면형 (${set.size}종 표본) ──`)
    console.log('  ' + [...set].join(' · '))
  }
  // ── 남은 미스의 원인 가르기 ────────────────────────────────────────
  //
  // 매칭을 더 손봐야 하는가, 추출을 손봐야 하는가. **문장에 그 낱말의 어간조차 없으면**
  // 규칙을 아무리 늘려도 못 잡는다 — 그건 `first_sentence` 가 엉뚱한 문장이라는 뜻이고,
  // 고칠 곳은 매칭이 아니라 추출이다.
  let stemAbsent = 0, stemPresent = 0
  const absent: string[] = []
  const present: string[] = []
  for (const p of pairs) {
    const d = dict.get(p.w); if (!d) continue
    const extra = [
      ...(d.pos === 'adjective' || d.pos === 'adverb' ? degreePats(p.w) : []),
      ...pluralPats(p.w), ...spellingPats(p.w),
    ]
    if (hitWhat(p.s, p.w, [...d.f, ...d.v], extra)) continue
    const stem = p.w.slice(0, Math.max(3, p.w.length - 3)).toLowerCase()
    if (p.s.toLowerCase().includes(stem)) {
      stemPresent += 1
      if (present.length < 12) present.push(`${p.w} | ${p.s.slice(0, 88)}`)
    } else {
      stemAbsent += 1
      if (absent.length < 8) absent.push(`${p.w} | ${p.s.slice(0, 88)}`)
    }
  }
  const rest = stemAbsent + stemPresent
  console.log(`\n  ── 남은 미스 ${rest} 의 원인 ──`)
  console.log(`  문장에 어간조차 없음 (추출 결함)  ${stemAbsent}  ${((stemAbsent / rest) * 100).toFixed(1)}%`)
  console.log(`  어간은 있는데 못 잡음 (매칭 결함) ${stemPresent}  ${((stemPresent / rest) * 100).toFixed(1)}%`)
  console.log('\n  ── 매칭 결함 표본 ──')
  for (const s of present) console.log('  ' + s)
  console.log('\n  ── 추출 결함 표본 ──')
  for (const s of absent) console.log('  ' + s)

  // 스펠링 변이 보유율
  let hasV = 0
  for (const d of dict.values()) if (d.v?.length) hasV += 1
  console.log(`\n  spelling_variants 보유 낱말 ${hasV} / ${dict.size} (${((hasV / dict.size) * 100).toFixed(1)}%)`)
}
main()
