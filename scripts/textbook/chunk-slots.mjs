// scripts/textbook/chunk-slots.mjs
//
// **드레인 청크의 빈 번호를 고른다.** 순수 함수라 회귀로 잠글 수 있다.
//
// ── 왜 따로 뺐는가 (실측 2026-09-06) ────────────────────────────────
// `item-drain-export.mjs` 는 끝낸 청크(`.out.json` 이 있는 것)의 `.json` 을 지우고,
// 새 몫을 쓸 때 **`chunk-NN.json` 이 있는지만** 보고 빈 번호를 찾았다. 그래서 방금 지운
// 번호가 "비었다" 로 보였고, 그 자리에 새 몫을 썼다 — 남아 있던 `.out.json` 과 **짝이
// 어긋났다**. 실측: `blank-v4/chunk-00.json` 이 새 글 5편으로 덮이고
// `chunk-00.out.json` 에는 옛 글 8편이 그대로 남았다.
//
// 그 상태는 조용히 나쁘다. 임포터는 `.out.json` 을 읽으므로 **새로 쓴 몫은 영영 안 채워지고**,
// 사람이 새 `.json` 을 보고 채워 저장하면 **옛 `.out.json` 이 덮여 사라진다**(그 몫이 아직
// 적재 전이었다면 노동이 통째로 날아간다).
//
// 고침은 지우는 쪽이 아니라 **고르는 쪽**이다. `.out.json` 은 적재 기록이자 재실행 안전의
// 근거라 지우면 안 된다 — 대신 그 번호를 **임자 있는 번호로 친다.**

/** 청크 파일 이름에서 번호를 읽는다. 청크가 아니면 null. */
export function slotOf(filename) {
  const m = /^chunk-(\d+)(?:\.out)?\.json$/.exec(filename)
  return m ? Number(m[1]) : null
}

/**
 * 이미 임자가 있는 번호들. **`.json` 과 `.out.json` 을 모두 센다** — 둘 중 하나만 있어도
 * 그 번호는 남의 자리다.
 *
 * @param files 디렉터리의 파일 이름들
 */
export function takenSlots(files) {
  const taken = new Set()
  for (const f of files) {
    const n = slotOf(f)
    if (n !== null) taken.add(n)
  }
  return taken
}

/**
 * 새 몫 `count` 개가 쓸 번호를 앞에서부터 고른다. 임자 있는 번호는 건너뛴다.
 *
 * @param files 디렉터리의 파일 이름들
 * @param count 필요한 청크 수
 * @returns 두 자리로 채운 번호 문자열 배열 (`['05','06']`)
 */
export function pickFreeSlots(files, count) {
  const taken = takenSlots(files)
  const out = []
  let slot = 0
  while (out.length < count) {
    while (taken.has(slot)) slot++
    out.push(String(slot).padStart(2, '0'))
    taken.add(slot)
    slot++
  }
  return out
}
