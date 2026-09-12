// scripts/csat/pdf-cid-text.mjs
//
// **평가원 정답표 PDF 에서 동그라미 숫자를 뽑는다 — pdftotext 가 못 하는 일.**
//
// 왜 필요한가: 이 저장소의 poppler 빌드에는 `Adobe-Korea1` CMap 이 없어서 한글과
// **동그라미 숫자(①~⑤)가 통째로 사라진다.** 그래서 `pdftotext` 로는 배점 열(평문 2·3)만
// 나오고 **정답 열이 비어** 나온다 — 정답표를 받아 놓고도 정답을 못 읽는 상태가 된다.
// `pdftoppm`(그림으로 렌더링)도 `pdffonts`도 이 환경에 없다.
//
// 그런데 그 PDF 들은 **ToUnicode CMap 을 파일 안에 담고 있다.** 글리프 번호를 유니코드로
// 되돌리는 표가 이미 들어 있으므로, 외부 CMap 없이 **파일 스스로** 해독된다.
// 이 스크립트는 그것만 한다 — 스트림을 풀고, ToUnicode 로 CID→문자를 만들고,
// 텍스트 연산자(`<....>Tj` · `[...]TJ`)를 순서대로 이어 붙인다.
//
// ⚠️ **눈으로 옮겨 적지 않는다.** 정답 45개를 손으로 받아 적으면 한 자리만 틀려도 학습자를
//    반대로 훈련시키고, 틀린 줄 알 방법이 없다. 기계가 읽고 기계가 검산해야 한다.
//
// 실행: node scripts/csat/pdf-cid-text.mjs <파일.pdf>

import fs from 'node:fs'
import zlib from 'node:zlib'

const file = process.argv[2]
if (!file) {
  console.error('사용법: node scripts/csat/pdf-cid-text.mjs <파일.pdf>')
  process.exit(1)
}

const buf = fs.readFileSync(file)
const raw = buf.toString('latin1')

/** 압축 스트림을 전부 풀어 돌려준다 (풀리지 않는 것은 건너뛴다 — 그림·폰트다) */
function streams() {
  const out = []
  const re = /stream\r?\n/g
  let m
  while ((m = re.exec(raw))) {
    const st = m.index + m[0].length
    const end = raw.indexOf('endstream', st)
    if (end < 0) break
    const slice = buf.subarray(st, end)
    try {
      out.push(zlib.inflateSync(slice).toString('latin1'))
    } catch {
      try {
        out.push(slice.toString('latin1'))
      } catch {
        /* 못 읽는 스트림은 버린다 */
      }
    }
  }
  return out
}

/**
 * ToUnicode CMap → CID(16진 4자리) → 문자.
 * `bfchar`(낱개)와 `bfrange`(구간) 두 형식을 다 받는다.
 */
function toUnicodeMap(all) {
  const map = new Map()
  const hex = (h) =>
    String.fromCharCode(...(h.match(/.{4}/g) ?? []).map((x) => parseInt(x, 16)))

  for (const s of all) {
    if (!s.includes('beginbfchar') && !s.includes('beginbfrange')) continue

    for (const blk of s.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
      for (const m of blk.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        map.set(parseInt(m[1], 16), hex(m[2]))
      }
    }
    for (const blk of s.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
      // <lo> <hi> <dst>  — 구간을 한 시작점에서 이어 붙인다
      for (const m of blk.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        const lo = parseInt(m[1], 16)
        const hi = parseInt(m[2], 16)
        const dst = parseInt(m[3], 16)
        for (let i = 0; lo + i <= hi; i += 1) map.set(lo + i, String.fromCharCode(dst + i))
      }
      // <lo> <hi> [<d1> <d2> …] — 구간마다 목적지를 낱개로 적은 형식
      for (const m of blk.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g)) {
        const lo = parseInt(m[1], 16)
        const dsts = [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((d) => hex(d[1]))
        dsts.forEach((ch, i) => map.set(lo + i, ch))
      }
    }
  }
  return map
}

/**
 * 텍스트 연산자를 순서대로 이어 붙인다.
 *
 * 줄바꿈은 PDF 안에 없다 — 좌표 이동(`TD`/`Td`/`Tm`)이 줄을 만든다. 정답표는 표라서
 * **세로 좌표가 바뀔 때 줄을 끊어야** 사람이 읽는 모양이 된다. 그래서 `Tm`/`TD` 의
 * 세로 성분을 좇아 줄을 나눈다.
 */
function extract(all, map) {
  const lines = []
  let cur = ''
  let y = null

  const put = (cid) => {
    const ch = map.get(cid)
    if (ch != null) cur += ch
  }

  for (const s of all) {
    if (!/\bTj\b|\bTJ\b/.test(s)) continue
    const re =
      /([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|([-\d.]+)\s+([-\d.]+)\s+TD|<([0-9a-fA-F]+)>\s*Tj|\[([^\]]*)\]\s*TJ/g
    let m
    while ((m = re.exec(s))) {
      if (m[6] !== undefined) {
        const ny = parseFloat(m[6])
        if (y !== null && Math.abs(ny - y) > 1) {
          lines.push(cur)
          cur = ''
        }
        y = ny
      } else if (m[8] !== undefined) {
        const dy = parseFloat(m[8])
        if (Math.abs(dy) > 1) {
          lines.push(cur)
          cur = ''
          y = (y ?? 0) + dy
        }
      } else if (m[9] !== undefined) {
        for (const h of m[9].match(/.{4}/g) ?? []) put(parseInt(h, 16))
      } else if (m[10] !== undefined) {
        for (const t of m[10].matchAll(/<([0-9a-fA-F]+)>/g)) {
          for (const h of t[1].match(/.{4}/g) ?? []) put(parseInt(h, 16))
        }
        // 큰 음수 조정은 낱말 사이 공백이다
        for (const t of m[10].matchAll(/(-?\d+(?:\.\d+)?)/g)) {
          if (parseFloat(t[1]) < -150) cur += ' '
        }
      }
    }
  }
  lines.push(cur)
  return lines.filter((l) => l.trim())
}

const all = streams()
const map = toUnicodeMap(all)
if (!map.size) {
  console.error('✗ ToUnicode CMap 을 못 찾았다 — 이 PDF 는 스스로 해독되지 않는다')
  process.exit(2)
}
const lines = extract(all, map)
console.error(`  (CID 매핑 ${map.size}개 · 줄 ${lines.length})`)
console.log(lines.join('\n'))
