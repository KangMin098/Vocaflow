// apps/web/src/lib/speech/voice-pick.ts
//
// 브라우저 TTS 음성 고르기 — **어느 음성으로 읽을지의 결정을 한 곳에 둔다.**
//
// 두 가지를 정한다:
//   ① 무엇을 고르나 — en-US 우선, 없으면 아무 en-*. 한국어 시스템에서 영단어를 한국어
//      음성이 읽으면 발음 학습에는 침묵보다 나쁘다.
//   ② **언제 바꾸나** — 이쪽이 더 어렵고, 안 지키면 아래 결함이 난다.
//
// ── 사용자 신고 2026-08-16 (Edge) ─────────────────────────────────────
// 단어를 이어 듣다가 `fundamental` 에서 **갑자기 다른 지역 발음**이 났다.
//
// `voiceschanged` 는 한 번만 오지 않는다. Edge 는 로컬 음성을 먼저 주고 온라인(신경망)
// 음성을 뒤이어 흘려보내며 **여러 번** 발화한다. 그때마다 목록 전체를 다시 훑어 고르면,
// `en-US` 가 잠깐 빠진 중간 상태에서 `en-GB`·`en-AU` 로 갈아타고 **그 뒤 단어부터** 그
// 억양으로 읽힌다. 오류도 로그도 없다 — 학습자 귀에만 잡힌다.
//
// 같은 결함이 두 곳에 있었다: `useSpeech`(단어 듣기)와 `WordfallCadenceGame`(듣기 게임).
// 후자가 더 나쁘다 — 듣고 고르는 게임에서 억양이 도중에 바뀌면 그건 난이도가 아니라 함정이다.

/** 브라우저 간 표기 차이 흡수 — `en-US` / `en_US` 를 같게 본다. */
function norm(lang: string): string {
  return lang.replace('_', '-').toLowerCase()
}

/** `en-US` 계열인가. */
export function isUSEnglish(lang: string): boolean {
  return norm(lang) === 'en-us'
}

/**
 * 영어 음성 후보 중 하나 고르기 — en-US 우선, 없으면 아무 en-*.
 *
 * 영어가 하나도 없으면 `null` — **아무 음성이나 물리지 않는다**. 물리면 한국어 음성이
 * 영단어를 읽는다.
 */
export function pickEnglishVoice<T extends Pick<SpeechSynthesisVoice, 'lang'>>(
  voices: T[]
): T | null {
  if (voices.length === 0) return null
  return (
    voices.find((v) => isUSEnglish(v.lang)) ??
    voices.find((v) => norm(v.lang).startsWith('en')) ??
    null
  )
}

/**
 * 목록이 갱신됐을 때 **음성을 바꿀지 말지**.
 *
 * 규칙: **한 번 잡은 음성은 지킨다.** 바꾸는 경우는 둘뿐이다.
 *   ① 아직 없음 → 고른다
 *   ② 쓰던 게 en-US 가 아닌데 en-US 가 나타남 → **올려준다**
 *
 * 그 외에는 **무조건 유지한다 — 쓰던 음성이 목록에서 사라져도 그렇다.**
 *
 * ⚠️ 처음 고칠 때는 "사라지면 다시 고른다" 는 조항을 뒀는데, **그게 바로 신고된 결함의
 * 경로였다**(자동 재현 2026-08-17, `27-tts-voice-stability`). Edge 는 목록을 *덧붙이는* 게
 * 아니라 **통째로 갈아끼운다** — 로컬 목록이 온라인 목록으로 교체되는 순간 `en-US` 가
 * 잠깐 사라지고, 그때 다시 고르면 `en-GB` 로 내려간다. 재현 로그:
 *   `[{dying, en-US}, {parlour, en-GB}]`
 *
 * 사라진 음성을 계속 물리는 것이 위험해 보이지만, 잃는 것과 얻는 것이 다르다:
 *   · 최악 — 브라우저가 그 음성을 거절하고 `utter.lang`(= 그 음성의 lang)으로 대체 재생.
 *     **여전히 같은 지역 발음**이고, `attachCompletion` 이 큐를 멈추지 않게 막는다.
 *   · 반대로 다시 고르면 **확실하게** 억양이 바뀐다 — 학습자가 듣는 그 결함이다.
 *
 * 동일성은 객체가 아니라 `voiceURI` 로 본다 — `getVoices()` 는 호출마다 새 객체를 줄 수 있다.
 */
export function nextVoice<T extends Pick<SpeechSynthesisVoice, 'lang' | 'voiceURI'>>(
  current: T | null,
  voices: T[]
): T | null {
  if (!current) return pickEnglishVoice(voices)
  if (isUSEnglish(current.lang)) return current // 최선을 이미 쥐고 있다

  // 지역 변종을 쓰는 중 — en-US 가 보이면 그때만 올라간다
  const upgrade = voices.find((v) => isUSEnglish(v.lang))
  if (upgrade) return upgrade

  // 같은 음성이 아직 있으면 그 객체로 갱신(스테일 참조보다 신선한 쪽이 낫다)
  return voices.find((v) => v.voiceURI === current.voiceURI) ?? current
}
