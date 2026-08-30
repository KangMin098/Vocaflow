// scripts/textbook/batch-lock.mjs
//
// **무거운 배치는 한 번에 하나만 돈다 — 겹치면 전부 실패한다.**
//
// ── 왜 (2026-08-31 실측) ─────────────────────────────────────────────
// 이 워크스페이스는 여러 Claude 세션이 동시에 붙어 있고, 각 세션이 자기 배치를 띄운다.
// 그날 `store-new-types` 가 **넷**이 동시에 돌았고 결과는 이랬다:
//
//   · 원글 조회        `canceling statement due to statement timeout`
//   · 사전 조회        같은 오류로 V6 배치 사망
//   · 유형별 문항 조회  네 번 재시도가 전부 timeout (explain-fill 사망)
//
// 그런데 배치 하나를 멈추자 **같은 조회가 0.2초에 돌아왔다**(payload 포함 500행).
// 즉 코드도 쿼리도 문제가 아니었다 — 한 DB 를 넷이 훑은 것이 문제였다.
// 재시도를 넣어 두면 오히려 나빠진다: 실패한 넷이 동시에 다시 밀어 넣는다.
//
// ── 왜 기다리지 않고 거절하는가 ──────────────────────────────────────
// 기다리면 한 시간을 말없이 서 있게 된다. 거절하고 **누가 무엇을 언제부터 잡고 있는지**
// 말해 주면, 부른 쪽이 다른 일을 하다가 다시 오면 된다.
//
// ⚠️ 죽은 세션의 자물쇠는 스스로 풀린다 — PID 가 살아 있는지 보고, 죽었으면 가져온다.
//   그래도 안 풀리면 안내에 적힌 파일을 지우면 된다(경로를 함께 찍는다).

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/textbook/.locks')

/** 그 PID 가 아직 살아 있나. 시그널 0 은 죽이지 않고 존재만 본다. */
function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM 이면 남의 프로세스지만 살아는 있다.
    return e.code === 'EPERM'
  }
}

/**
 * 자물쇠를 잡는다. 못 잡으면 이유를 찍고 **exit 1** — 조용히 계속하면 겹친다.
 *
 * @param {string} name  자물쇠 이름. 같은 이름끼리만 막는다(밴드별로 나누지 않는다 —
 *                       같은 DB 를 훑는 것은 밴드와 무관하게 무겁다).
 * @returns {() => void} 놓는 함수. 프로세스가 끝날 때 자동으로도 놓는다.
 */
export function acquire(name) {
  fs.mkdirSync(DIR, { recursive: true })
  const file = path.join(DIR, `${name}.lock`)

  if (fs.existsSync(file)) {
    let held = null
    try {
      held = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      // 깨진 자물쇠는 없는 것으로 본다.
    }
    if (held?.pid && alive(held.pid)) {
      const mins = Math.round((Date.now() - new Date(held.startedAt).getTime()) / 60000)
      console.error(
        `\n이미 같은 배치가 돌고 있다 — pid ${held.pid} · ${held.what} · ${mins}분째\n` +
          `  겹쳐 돌리면 둘 다 statement timeout 으로 죽는다(2026-08-31 실측: 넷이 겹쳐 전부 실패,\n` +
          `  하나만 남기자 같은 조회가 0.2초에 끝났다). 끝난 뒤에 다시 부른다.\n` +
          `  정말 죽은 것 같으면: ${path.relative(process.cwd(), file)} 를 지운다.\n`,
      )
      process.exit(1)
    }
    // 죽은 세션이 남긴 것 — 가져온다.
    console.error(`  (죽은 자물쇠를 회수한다 — pid ${held?.pid ?? '?'})`)
  }

  fs.writeFileSync(
    file,
    JSON.stringify(
      { pid: process.pid, what: process.argv.slice(1).join(' ').slice(-90), startedAt: new Date().toISOString() },
      null,
      2,
    ),
    'utf8',
  )

  let released = false
  const release = () => {
    if (released) return
    released = true
    try {
      // 내 것일 때만 지운다 — 회수당한 뒤에 남의 자물쇠를 풀면 안 된다.
      const cur = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (cur.pid === process.pid) fs.unlinkSync(file)
    } catch {
      // 이미 없으면 그만이다.
    }
  }
  process.on('exit', release)
  process.on('SIGINT', () => {
    release()
    process.exit(130)
  })
  return release
}
