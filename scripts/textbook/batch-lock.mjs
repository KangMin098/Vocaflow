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

/**
 * 이보다 오래 잡힌 자물쇠는 **눈에 띄게** 경고한다.
 *
 * 2시간으로 잡은 근거: 이 저장소에서 가장 긴 정상 배치가 그 안에 끝난다
 * (조판 181초 · 해설 적재 · 유형 생성 모두). 넘으면 정상이 아닐 **가능성**을 알리는 것이지
 * 죽었다고 단정하지 않는다 — 판단은 CPU 와 산출 둘을 보고 사람이 한다.
 */
const STALE_MINUTES = 120

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
      // ⚠️ **살아 있다고 일하고 있는 것은 아니다** (실측 2026-09-01).
      //   `store-new-types.mjs --band 6` 가 **28시간**을 잡고 있었다. PID 는 살아 있어 위
      //   생존 검사를 통과했는데, **마지막 DB 산출이 24시간 전**이었고 그동안 CPU 를 **99%**
      //   로 태우고 있었다(20초 표본에서 19.9초 증가). 무한 루프였다.
      //   그 28시간 동안 `explain-fill` 과 `irrelevant` 작업이 통째로 막혔고, 경고는
      //   "1677분째" 라는 한 조각 숫자뿐이라 **아무도 이상하다고 읽지 않았다.**
      //   그래서 오래 잡힌 자물쇠는 **눈에 띄게** 만들고, 살았는지가 아니라
      //   **일하고 있는지**를 확인하는 법을 함께 찍는다.
      if (mins >= STALE_MINUTES) {
        const hrs = (mins / 60).toFixed(1)
        console.error(
          `⚠️  이 자물쇠는 ${hrs}시간째다 — 정상 배치보다 길다. 살아 있는 것과 일하는 것은 다르다.\n` +
            `   멈춘 배치인지 이렇게 가른다 (둘 다 보라):\n` +
            `     ① CPU 가 도는가  PowerShell: $a=(Get-Process -Id ${held.pid}).CPU; sleep 20;\n` +
            `                                  (Get-Process -Id ${held.pid}).CPU - $a\n` +
            `        → 20초에 ~20 이면 100% 스핀. I/O 대기면 0 에 가깝다.\n` +
            `     ② 진행이 느는가  **그 배치의 출력**을 본다 — "문항 생성 N/M편" 같은 줄이 늘면 살아 있다.\n` +
            `        ⚠️ **DB 에 쓴 행으로 판정하지 마라.** 여러 배치가 다 만든 뒤 **끝에 한 번** 적재한다\n` +
            `           (store-new-types 의 타이밍 표: 적재 0.2s). 끝나기 전에는 DB 산출이 언제나 0 이라,\n` +
            `           그 판정을 쓰면 **정상 실행이 무한 루프로 보인다.** 실제로 2026-09-06 에\n` +
            `           --band 6 을 25분째에 그렇게 끊었다 — V4 656편이 생성에만 257초였으니\n` +
            `           V6 13,041편이면 몇 시간이 정상이었다. 이튿날 --band 5 는 기다렸더니\n` +
            `           문항 24,814건을 쓰고 끝났다.\n` +
            `        CPU 는 타는데 **진행 줄도 안 늘면** 무한 루프다 — 그때만 끊는다:\n` +
            `          PowerShell: Stop-Process -Id ${held.pid} -Force\n` +
            `          그 뒤: ${path.relative(process.cwd(), file)} 를 지운다.\n` +
            `   ⚠️ 둘 다 확인하기 전에는 끊지 않는다. 남의 세션이 20시간 돌린 일이 날아간다.\n`,
        )
      }
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
