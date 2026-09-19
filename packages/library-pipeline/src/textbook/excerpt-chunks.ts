// packages/library-pipeline/src/textbook/excerpt-chunks.ts
//
// **PD 장문을 비중복 발췌 조각으로 자른다.** `scripts/textbook/harvest-gutenberg-kid.mjs`
// 안에 있던 것을 그대로 꺼내 왔다 — 시험을 붙이기 위해서다.
//
// ── 왜 꺼냈나 (2026-09-15) ──────────────────────────────────────────
// 해설 드레인에서 지문 한 편에 **두 이야기**가 담긴 문항이 나왔다
// (`csat_dcp_items` `16a106d7-…` · 원천 `library_articles` `5fcd1d90-…` =
// Gutenberg #26177 "The Book of Stories for the Story-teller"). 앞 5문장이 Ivan·Koshchei
// 이야기의 끝이고 뒤 5문장이 다른 아이 이야기의 시작인데, 밑줄 다섯이 두 이야기에
// 갈려 있었다. 원본을 받아 그 자리를 보니 경계가 **분명히 표시돼 있었다**:
//
//   ```
//   ...and were very, very happy.
//
//   _Oeyvind and Marit_[20]
//
//   BJOeRNE BJOeRNESON
//
//   Oeyvind was his name. A low, barren cliff overhung the house...
//   ```
//
// 그 두 줄이 어떻게 됐는지 실측했다(`cleanBookText` 를 직접 돌려서):
//
//   | 줄 | 정제 뒤 | `looksLikeHeading` | 본문 조건(80자 초과 + 문장부호) |
//   |---|---|---|---|
//   | `_Oeyvind and Marit_[20]` | `"Oeyvind and Marit"` 남는다 | **false** — 대문자도 로마숫자도 CHAPTER 도 아니다 | 17자라 **탈락** |
//   | `BJOeRNE BJOeRNESON` | 그대로 남는다 | **false** — `Oe` 의 소문자 `e` 때문에 전부 대문자가 아니다 | 18자라 **탈락** |
//
// 즉 **두 줄 다 어느 쪽으로도 안 세어져 조용히 버려졌다.** 버릴 때 경계를 아무 데도
// 적지 않았으므로 다음 문단(`Oeyvind was his name…`)은 `opensChapter: false` 로 남았고,
// 앞 조각이 그것을 그대로 빨아들였다.
//
// **이것이 이 파일이 고치는 두 가지다:**
//   ① 본문도 표제도 아닌 줄은 **버리되 경계로 적는다** — 버려지는 자리가 곧 경계다.
//      (`looksLikeHeading` 을 넓히는 쪽은 택하지 않았다. `BJOeRNE BJOeRNESON` 을 잡으려면
//       「대문자가 많은 짧은 줄」로 풀어야 하는데, 그러면 본문 속 외침·강조가 걸린다.)
//   ② 조각을 모으다 **경계를 만나면 멈춘다.** 고치기 전에는 경계를 `opensChapter` 에
//      적어 두기만 하고 모으는 쪽이 보지 않아서, 적어도 소용이 없었다.
//
// ⚠️ ①은 수율을 깎는다 — 짧은 대사 한 줄(`"Killy-killy-killy-goat!"`)도 경계로 세기
//   때문이다. 깎이는 양은 짐작하지 않고 쟀다: `scripts/textbook/chunk-boundary-measure.mjs`.

/** 한 문단의 정제 결과. `wasDropped` 는 **원문에 있었는데 정제가 통째로 지운** 문단이다. */
export interface ParagraphUnit {
  text: string
  wasDropped: boolean
}

export interface ExcerptChunk {
  text: string
  /** 이 조각이 장·이야기가 시작하는 자리에서 시작하는가. 조각을 고를 때 먼저 쓴다. */
  opensChapter: boolean
}

export interface ChunkBounds {
  min: number
  max: number
}

/** 본문 문단으로 셀 최소 길이. 이보다 짧으면 표제·대사·설명 줄이다. */
const BODY_MIN_CHARS = 80

/**
 * 장 머리(`CHAPTER I` · `IV.` · `THE LOST KEY`)인가.
 *
 * 짧고, 문장 부호로 끝나지 않으며, 대문자·로마숫자가 두드러진다. 본문 문단은 이 셋을
 * 동시에 만족하지 않는다.
 *
 * ⚠️ **이것으로 경계를 다 잡지 못한다** — 위 주석의 두 줄이 산 증거다. 경계의 본줄기는
 *   `disjointChunks` 의 「본문이 아닌 줄 = 경계」 쪽이고, 이 함수는 그중 확실한 것만
 *   먼저 걸러 준다.
 */
export function looksLikeHeading(p: string): boolean {
  const t = p.trim()
  if (!t || t.length > 70) return false
  // ⚠️ **순서가 뜻을 바꾼다.** 꺼내 온 원본은 마침표 검사가 로마숫자 검사보다 앞에
  //   있어서, 문서가 예로 드는 `IV.` 가 **마침표로 끝난다는 이유로 먼저 반려됐다** —
  //   로마숫자 갈래에 닿지도 못했다(2026-09-15 시험이 잡았다). 점 없는 `IV` 만 통했다.
  //   확실한 모양(CHAPTER · 로마숫자)을 먼저 보고, 마침표 검사는 **그 나머지**에만 건다.
  if (/^(?:CHAPTER|BOOK|PART|SECTION)\b/i.test(t)) return true
  if (/^[IVXLC]+\.?$/.test(t)) return true
  if (/[.!?][")\]]?$/.test(t)) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true
  return false
}

/**
 * 문단을 모아 **비중복** 조각을 만든다.
 *
 * ⚠️ **겹치면 안 된다.** probe 가 처음에 문단을 5칸씩 옮기며 창을 만들었는데, 창 하나가
 *   3~8문단이라 이웃 창이 문단을 나눠 가졌다. 그렇게 세면 수율이 부풀고, 그대로 적재하면
 *   **같은 문단이 두 지문에 실린다.** 그래서 조각을 만들면 그 끝 다음에서 다시 시작한다.
 *
 * ⚠️ **경계를 넘으면 안 된다.** 위 파일 주석 참조 — 넘으면 지문 한 편에 두 이야기가 담긴다.
 */
export function disjointChunks(units: ParagraphUnit[], bounds: ChunkBounds): ExcerptChunk[] {
  const paras: string[] = []
  /** **강한 증거** — 정제가 지운 줄이거나 표제 모양인 줄 뒤. 「장이 시작한다」는 뜻. */
  const opensChapter: boolean[] = []
  /** **약한 증거** — 본문이 아닌 줄이면 무엇이든. 「여기서 끊긴다」는 뜻뿐이다. */
  const breaksHere: boolean[] = []
  let strong = false
  let weak = false

  for (const u of units) {
    // **정제가 지운 문단**(장 머리·표제·판권)이 경계다.
    if (u.wasDropped || (u.text && looksLikeHeading(u.text))) {
      strong = true
      weak = true
      continue
    }
    const p = u.text
    if (p && p.length > BODY_MIN_CHARS && /[.!?]/.test(p)) {
      paras.push(p)
      opensChapter.push(strong)
      breaksHere.push(weak)
      strong = false
      weak = false
      continue
    }
    // ── 여기가 2026-09-15 에 고친 자리 ────────────────────────────────
    // 본문도 표제도 아닌 줄. 고치기 전에는 **아무 일도 없이 지나갔다**. 그런데
    // 이야기와 이야기 사이에 있는 것이 바로 이런 줄이다 — 작품 제목, 지은이 이름,
    // 출처 표시. 버리는 것은 맞고, **버렸다는 사실을 적지 않은 것이 틀렸다.**
    //
    // ⚠️ 이것을 `opensChapter` 에 적으면 **안 된다.** 짧은 대사 한 줄
    //   (`"Killy-killy-killy-goat!"`)도 여기로 오는데, 그 뒤가 장의 시작은 아니다.
    //   처음엔 한 깃발에 같이 적었다가 실측에서 들켰다 — 「장머리 조각」이
    //   80 → 814 로 뛰었다. 조각이 좋아진 것이 아니라 **깃발의 뜻이 바뀐 것**이었다.
    //   끊는 데는 약한 증거로 충분하고, 「먼저 쓸 조각」을 고르는 데는 강한 증거라야 한다.
    if (p) weak = true
  }

  const out: ExcerptChunk[] = []
  let i = 0
  while (i < paras.length) {
    let acc = ''
    let end = -1
    for (let j = i; j < paras.length; j++) {
      // ── 두 번째로 고친 자리 ─────────────────────────────────────────
      // 경계에서 멈춘다. 고치기 전에는 경계를 **적어 두기만 하고** 모으는 쪽이
      // 보지 않았다 — 적어도 소용이 없는 기록이었다.
      if (j > i && breaksHere[j]) break
      acc = acc ? `${acc} ${paras[j]}` : paras[j]!
      const w = (acc.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
      if (w < bounds.min) continue
      if (w > bounds.max) break
      end = j
      break
    }
    if (end < 0) {
      i++
      continue
    }
    out.push({ text: acc, opensChapter: opensChapter[i] === true })
    i = end + 1
  }
  return out
}
