// packages/library-pipeline/src/textbook/volume-drift.test.ts
//
// **"드레인이 겨냥한 책" 과 "조판된 책" 이 어긋나지 않게 못을 박는다.**
//
// ── 왜 이 회귀가 있나 ────────────────────────────────────────────────
// `render-volume.mjs`(조판)와 `explain-drain-export.mjs`(해설 몫 뽑기)가 각자 풀을 만들었다.
// 주석에는 "같은 조합 규칙을 쓴다" 고 적혀 있었지만 실제로는 셋이 달랐다:
//
//   1. 밴드 거르는 자리 — 조판은 원글 `article_v_level`, 드레인은 문항 `v_level`
//   2. `composeUnits` 두 번째 인자 — 조판은 단원 어휘, 드레인은 `new Map()`
//   3. `display_only` 원글 — 조판만 걸렀다
//
// 결과: 드레인이 62건을 뽑아 **전부 채웠는데도** 책은 78/80 으로 나왔다. 2문항이 어긋난 것이라
// 눈으로는 "거의 다 됐네" 로 보인다 — **작은 드리프트는 티가 안 나서 더 위험하다.**
//
// 그래서 규칙을 `scripts/textbook/volume-pool.mjs` 한 벌로 옮겼고, 여기서 **아무도 자기 풀을
// 다시 만들지 않는지** 감시한다. 이 테스트가 깨지면 드리프트가 되살아난 것이다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SCRIPTS = path.resolve(fileURLToPath(new URL('../../../../scripts/textbook', import.meta.url)))
const read = (f: string) => fs.readFileSync(path.join(SCRIPTS, f), 'utf8')

/** 한 권을 다루는 스크립트 전부. 새 스크립트가 늘면 여기에 더한다. */
const VOLUME_SCRIPTS = ['render-volume.mjs', 'explain-drain-export.mjs']

describe('한 권을 고르는 규칙은 한 벌뿐이다', () => {
  it('`volume-pool.mjs` 가 있고 `loadVolume` 을 내보낸다', () => {
    const src = read('volume-pool.mjs')
    expect(src).toContain('export async function loadVolume')
    expect(src).toContain('export function loadEnv')
  })

  it('조판·드레인 어느 쪽도 `composeUnits` 를 직접 부르지 않는다', () => {
    for (const f of VOLUME_SCRIPTS) {
      const src = read(f)
      // 호출만 금지한다 — 주석에서 이름을 언급하는 것은 괜찮다.
      expect(src, `${f} 가 composeUnits 를 직접 부른다 — loadVolume 을 쓸 것`).not.toMatch(
        /^(?!\s*(\/\/|\*)).*\bcomposeUnits\(/m,
      )
      expect(src, `${f} 가 loadVolume 을 안 쓴다`).toContain('loadVolume(')
    }
  })

  it('밴드는 **원글** 기준으로만 걸러진다 — 문항 `v_level` 로 거르면 조판과 어긋난다', () => {
    const pool = read('volume-pool.mjs')
    expect(pool).toContain("eq('article_v_level', band)")
    // 풀을 만드는 문항 질의에 `v_level` 필터가 붙으면 안 된다.
    expect(pool).not.toMatch(/eq\('v_level'/)
  })

  it('`display_only` 원글은 풀에서 빠진다 — 표시만 허용된 글은 문항으로 실을 수 없다', () => {
    expect(read('volume-pool.mjs')).toContain('display_only')
  })

  it('`composeUnits` 에 단원 어휘를 넘긴다 — 빈 Map 을 넘기면 다른 문항이 뽑힌다', () => {
    const pool = read('volume-pool.mjs')
    expect(pool).toContain('composeUnits(pool, vocabByRef,')
    expect(pool).not.toContain('composeUnits(pool, new Map()')
  })

  it('`.in()` 조회는 전부 페이징을 거친다 — PostgREST 는 1000행에서 자른다', () => {
    // ⚠️ `.limit(20000)` 은 **서버 상한을 못 넘는다.** 실측: Photosynthesis 한 편의 어휘가
    //   1,072행인데 받아온 것은 1,000행이었다.
    //
    //   이걸 모르고 어휘를 5편씩 묶어 물었더니 배치가 1000행에서 잘려 뒤쪽 원글이
    //   "어휘 0" 으로 보였고, 그 허수를 근거로 "어휘 없는 글 52편" 이라는 결론을 냈다.
    //   없는 갭을 메우려 57편을 재분석했고, 재분석이 밴드를 다시 계산해서
    //   **이미 완성한 권의 구성이 흔들렸다.** 측정이 틀리면 고치는 일이 망가뜨리는 일이 된다.
    const pool = read('volume-pool.mjs')
    expect(pool).toContain('export async function fetchAllIn')
    // `.limit(20000)` 같은 "크게 잡으면 되겠지" 를 남겨 두지 않는다.
    // 주석은 이 함정을 설명하느라 그 숫자를 그대로 적으므로 코드 줄만 본다.
    const code = pool
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    expect(code, 'limit 으로 서버 상한을 넘으려는 코드가 남아 있다').not.toMatch(/\.limit\(\s*(?!1000\b)\d{4,}\s*\)/)
    // 세 조회 모두 페이징을 거친다.
    for (const table of ['csat_dcp_items', 'library_article_vocabularies', 'shared_dictionary']) {
      expect(pool, `${table} 조회가 fetchAllIn 을 안 쓴다`).toMatch(
        new RegExp(`fetchAllIn\\([\\s\\S]{0,80}'${table}'`),
      )
    }
  })

  it('드레인 청크 자리가 밴드별로 갈린다 — 밴드를 동시에 돌려도 안 섞인다', () => {
    // 한 디렉터리를 쓰면 나중 export 가 앞 밴드 청크를 지우고,
    // import 는 그 안의 `.out.json` 을 전부 읽어 밴드가 섞인다.
    expect(read('explain-drain-export.mjs')).toContain('explain-drain/v${BAND}')
    expect(read('explain-drain-import.mjs')).toContain('explain-drain/v${BAND}')
  })
})
