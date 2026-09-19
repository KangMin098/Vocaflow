// scripts/lib/claim-chunks.mjs
//
// 팬아웃 드레인의 청크 잡기 — 워크스페이스를 여러 세션이 공유하기 때문에 필요하다.
//
// 왜 있나: 2026-08-26 pending_words 3차 물결에서 두 서브에이전트가 "내 청크에 이미
// 다른 판정본이 있었다" 고 보고했다. DB 큐는 FOR UPDATE SKIP LOCKED 로 막혀 있는데
// 청크 폴더에는 그런 장치가 없어서, 두 세션이 같은 청크를 동시에 판정하고 있었다.
// 낭비된 것은 판정 노동이고, 위험한 것은 서로 다른 판정본이 덮어쓰는 경합이다.
//
// 네 개의 팬아웃 명령(pending-words-drain · vcb-batch-enrich · vcb-curate-compare ·
// vcb-seed-validate)이 이 하나를 부른다. bash 를 네 곳에 복사하면 반드시 갈린다.
//
// 사용:
//   node scripts/lib/claim-chunks.mjs --dir <청크폴더> --in 'chunk-*.json' \
//        --done '.json:.out.json' [--done-dir <산출폴더>] [--max N] [--ttl 1800] [--force]
//   node scripts/lib/claim-chunks.mjs --release <파일...>      # 끝났거나 실패했을 때
//
// 출력은 한 줄에 하나: "CLAIM <경로>" · "SKIP <경로> <사유>". 마지막 줄은 요약.

import { readdirSync, statSync, existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join, dirname, basename, resolve } from 'node:path'

const DEFAULT_TTL_SEC = 1800 // 30분 — compose 큐의 회수 시간과 같은 값으로 맞춘다

function parse(argv) {
  const o = { done: [], release: [], ttl: DEFAULT_TTL_SEC, max: Infinity, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir') o.dir = argv[++i]
    else if (a === '--in') o.in = argv[++i]
    else if (a === '--done') o.done.push(argv[++i])
    else if (a === '--done-dir') o.doneDir = argv[++i]
    else if (a === '--max') o.max = Number(argv[++i])
    else if (a === '--ttl') o.ttl = Number(argv[++i])
    else if (a === '--force') o.force = true
    else if (a === '--release') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.release.push(argv[++i]) }
    else if (a === '--') continue
    else if (a.startsWith('--')) throw new Error(`모르는 인자: ${a}`)
    else o.release.push(a)
  }
  return o
}

// 글롭 → 정규식. 이 저장소의 셸이 백슬래시를 삼킨 적이 있어(2026-08-26) 문자별로 짠다.
const RE_SPECIAL = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']'])
const globToRe = (g) => {
  let out = '^'
  for (const ch of g) {
    if (ch === '*') out += '.*'
    else if (ch === '?') out += '.'
    else if (RE_SPECIAL.has(ch)) out += String.fromCharCode(92) + ch
    else out += ch
  }
  return new RegExp(out + '$')
}

// --done 'from:to' 를 순서대로 basename 에 적용해 산출물 경로를 만든다.
function donePath(file, o) {
  let name = basename(file)
  for (const rule of o.done) {
    const idx = rule.indexOf(':')
    if (idx < 0) throw new Error(`--done 은 from:to 형식이어야 한다: ${rule}`)
    const from = rule.slice(0, idx)
    const to = rule.slice(idx + 1)
    if (!name.includes(from)) return null // 이 규칙이 안 맞으면 산출물 이름을 알 수 없다
    name = name.replace(from, to)
  }
  return join(o.doneDir ? resolve(o.doneDir) : dirname(file), name)
}

function looksLikeOutput(name, dir, o) {
  if (!o.done.length) return false
  let back = name
  for (let i = o.done.length - 1; i >= 0; i--) {
    const rule = o.done[i]
    const idx = rule.indexOf(':')
    const from = rule.slice(0, idx)
    const to = rule.slice(idx + 1)
    if (!back.includes(to)) return false
    back = back.replace(to, from)
  }
  return back !== name && existsSync(join(dir, back))
}

const main = () => {
  const o = parse(process.argv.slice(2))

  if (o.release.length) {
    let n = 0
    for (const f of o.release) {
      const c = f.endsWith('.claim') ? f : `${f}.claim`
      if (existsSync(c)) { unlinkSync(c); n++; console.log(`RELEASE ${c}`) }
      else console.log(`RELEASE(없음) ${c}`)
    }
    console.log(`풀어 준 claim ${n}개`)
    return
  }

  if (!o.dir || !o.in) throw new Error('--dir 과 --in 은 필수다 (또는 --release)')
  const dir = resolve(o.dir)
  if (!existsSync(dir)) throw new Error(`폴더가 없다: ${dir}`)
  if (o.doneDir) mkdirSync(resolve(o.doneDir), { recursive: true })

  const re = globToRe(o.in)
  const now = Date.now()
  const picked = []
  let doneN = 0
  let claimedN = 0

  for (const name of readdirSync(dir).sort()) {
    if (name.endsWith('.claim')) continue
    if (!re.test(name)) continue
    const file = join(dir, name)
    if (!statSync(file).isFile()) continue

    // 산출물이 입력 글롭에 걸리는 함정 — 'chunk-*.json' 은 'chunk-00.out.json' 도 잡는다.
    // 규칙을 거꾸로 적용해 나온 이름이 실제로 있으면, 이 파일은 입력이 아니라 산출물이다.
    // (실측 2026-08-26: 이 검사가 없어 이미 판정한 청크 6개를 다시 잡았다.)
    if (looksLikeOutput(name, dir, o)) continue

    if (!o.force) {
      const out = donePath(file, o)
      if (out && existsSync(out) && statSync(out).size > 0) {
        doneN++
        console.log(`SKIP ${file} 이미-완료`)
        continue
      }
    }

    const claim = `${file}.claim`
    if (existsSync(claim)) {
      const ageSec = Math.round((now - statSync(claim).mtimeMs) / 1000)
      if (ageSec < o.ttl) {
        claimedN++
        console.log(`SKIP ${file} 남이-잡음(${ageSec}초)`)
        continue
      }
      // TTL 이 지난 claim 은 죽은 세션의 것으로 보고 가져간다.
      console.log(`STALE ${file} ${ageSec}초 — 회수`)
    }

    if (picked.length >= o.max) continue
    writeFileSync(claim, `${process.pid} ${new Date().toISOString()}\n`)
    picked.push(file)
    console.log(`CLAIM ${file}`)
  }

  console.log(`잡음 ${picked.length} · 이미-완료 ${doneN} · 남이-잡음 ${claimedN}`)
  if (picked.length === 0) console.log('잡은 청크가 0개다 — "완료" 로 보고하지 말 것.')
}

try { main() } catch (e) { console.error(`claim 실패: ${e.message}`); process.exit(1) }
