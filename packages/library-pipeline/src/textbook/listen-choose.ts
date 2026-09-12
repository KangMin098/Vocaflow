// packages/library-pipeline/src/textbook/listen-choose.ts
//
// **듣고 고르기 — 초등 내신의 청취 유형.** 음원을 듣고 알맞은 낱말을 고른다.
//
// ── 왜 이제야 성립하는가 (실측 2026-08-22) ──────────────────────────
// `school-types.ts` 는 이 유형을 "음원이 필요하다. VOA 는 오디오가 있으나 초등 수준이
// 아니다" 로 두고 **미구현**으로 남겨 왔다. 그런데 그 음원의 존재를 **잰 적이 없었다.**
//
// 재 봤더니 있다 — Wikimedia Commons 의 발음 파일은 이름 규약이 문서화돼 있고
// (`File:En-us-<word>.ogg` · `File:En-uk-<word>.ogg`), 교육과정 초등 어휘 808개 중
// 표본 120개에서 **113개(94.2%)** 가 존재했다. 라이선스는 CC BY-SA 3.0 이 대부분(101),
// 나머지가 PD(9) · CC BY 3.0(3) 이다.
//
// ⚠️ **CC BY-SA 는 출처 표기가 의무다.** 파일을 고쳐 쓰지 않고 그대로 재생하므로
//   SA(동일조건)는 걸리지 않지만, BY(표기)는 걸린다 — 교재 지면에 출처를 실어야 한다.
//   그래서 이 모듈은 음원 주소만 받지 않고 **표기 문자열도 함께** 받는다.
//   표기를 못 만들면 문항을 만들지 않는다.
//
// ⚠️ 같이 잰 **그림-낱말 연결은 기각했다.** Openverse 에서 CC0·PD 이미지가 있는 낱말이
//   표본 60개 중 8개(13.3%)뿐이었고, 더 큰 문제는 검색이 낱말-그림 대응이 아니라
//   제목 문자열 매칭이라는 것이다: `age` → "Cuba age" · `because` → "I love you because"
//   · `between` → "Sand-Between-Toes". 추상어는 애초에 그림이 안 되고, 이대로 쓰면
//   **틀린 그림이 정답으로 붙는다.** `scripts/textbook/media-probe.mjs` 참조.
//
// ── 오답을 왜 같은 라임으로 고르는가 ─────────────────────────────────
// 오답이 아무 낱말이면 첫소리만 듣고도 배제된다 — 그러면 듣기가 아니라 눈치다.
// 같은 각운(`rhymeKey`)을 가진 낱말을 오답으로 쓰면 **첫소리를 정확히 들어야** 갈린다
// (cat·hat·bat). 초등 파닉스가 가르치려는 것과 같은 축이다.

import { ELEMENTARY_CHOICES, type ElementaryItem, type ElementaryWord } from './elementary'

const LABELS = ['①', '②', '③', '④'] as const

/** 음원 한 건 — 주소와 **출처 표기**가 짝이다. 표기 없이 쓰면 라이선스 위반이다. */
export interface WordAudio {
  url: string
  /** 교재 지면에 실을 출처 문자열. 예: `Wikimedia Commons · CC BY-SA 3.0`. */
  attribution: string
}

export interface ListenChooseItem extends ElementaryItem {
  kind: 'listen_choose'
  audio: WordAudio
}

/**
 * 듣고 고르기 문항을 만든다. 조건을 못 맞추면 **null**.
 *
 * @param prompt 답이 될 낱말.
 * @param pool 오답을 뽑을 낱말들(같은 밴드).
 * @param audioOf 낱말 → 음원. 없으면 null — 그 낱말로는 문항을 못 만든다.
 *   (모듈을 순수하게 두려고 주입받는다. `elementary.ts` 와 같은 방식이다.)
 */
export function buildListenChoose(
  prompt: ElementaryWord,
  pool: readonly ElementaryWord[],
  audioOf: (word: string) => WordAudio | null,
): ListenChooseItem | null {
  const audio = audioOf(prompt.word)
  // 표기 없는 음원은 쓰지 않는다 — CC BY-SA 의 BY 를 지킬 수 없다.
  if (!audio?.url || !audio.attribution) return null

  // ① 같은 각운 오답이 우선 — 첫소리를 들어야 갈린다.
  const sameRhyme = prompt.rhymeKey
    ? pool.filter(
        (w) =>
          w.word !== prompt.word &&
          w.rhymeKey === prompt.rhymeKey &&
          // 굴절·파생은 소리가 거의 같아 답이 둘처럼 들린다.
          !shareStem(w.word, prompt.word),
      )
    : []

  // ② 모자라면 길이가 비슷한 낱말로 채운다. **겉모습으로 배제되지 않게** 길이를 맞춘다.
  const lo = Math.max(1, prompt.word.length - 2)
  const hi = prompt.word.length + 2
  const filler = pool.filter(
    (w) =>
      w.word !== prompt.word &&
      !sameRhyme.some((r) => r.word === w.word) &&
      !shareStem(w.word, prompt.word) &&
      w.word.length >= lo &&
      w.word.length <= hi,
  )

  const need = ELEMENTARY_CHOICES - 1
  const candidates = [...pickDeterministic(sameRhyme, need, prompt.word)]
  if (candidates.length < need) {
    candidates.push(...pickDeterministic(filler, need - candidates.length, prompt.word))
  }
  if (candidates.length < need) return null

  const texts = rotate([prompt.word, ...candidates.map((c) => c.word)], hash(prompt.word) % ELEMENTARY_CHOICES)

  // ── 만든 다음 스스로 검사한다 ─────────────────────────────────────
  // 보기에 같은 낱말이 두 번 들어가면 정답이 둘이 된다.
  if (new Set(texts).size !== texts.length) return null

  return {
    kind: 'listen_choose',
    promptKo: '음원을 듣고 알맞은 낱말을 고르세요.',
    // 화면에 낱말을 보여 주면 듣기가 아니다 — 제시어 자리는 비운다.
    stem: '',
    choices: texts.map((t, i) => ({ label: LABELS[i]!, text: t })),
    answer: texts.indexOf(prompt.word) + 1,
    answerText: prompt.word,
    audio,
  }
}

/**
 * Commons 발음 파일 주소 — **규약이지 짐작이 아니다.**
 *
 * 파일이 실제로 있는지는 이 함수가 답하지 않는다(순수 함수다). 존재 확인은
 * 호출 쪽이 API 로 하고, 없으면 `audioOf` 가 null 을 주면 된다.
 */
export function commonsAudioTitle(word: string, dialect: 'us' | 'uk' = 'us'): string {
  return `File:En-${dialect}-${word.toLowerCase()}.ogg`
}

/** 굴절·파생으로 이어진 낱말인가 — 한쪽이 다른 쪽을 통째로 품으면 소리가 겹친다. */
function shareStem(a: string, b: string): boolean {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  return l.startsWith(s) || l.endsWith(s)
}

function pickDeterministic<T extends { word: string }>(
  pool: readonly T[],
  n: number,
  seed: string,
): T[] {
  return [...pool]
    .map((w) => ({ w, k: hash(`${seed}#${w.word}`) }))
    .sort((a, b) => a.k - b.k || (a.w.word < b.w.word ? -1 : 1))
    .slice(0, n)
    .map((x) => x.w)
}

function rotate<T>(items: readonly T[], by: number): T[] {
  const k = ((by % items.length) + items.length) % items.length
  return [...items.slice(k), ...items.slice(0, k)]
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
