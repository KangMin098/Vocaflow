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
 * 규칙: **한 번 잡은 음성은 지킨다.** 바꾸는 경우는 셋뿐이다.
 *   ① 아직 없음 → 고른다
 *   ② 쓰던 음성이 목록에서 사라짐 → 다시 고른다
 *   ③ 쓰던 게 en-US 가 아닌데 en-US 가 새로 나타남 → **올려준다**(내리지는 않는다)
 *
 * 동일성은 객체가 아니라 `voiceURI` 로 본다 — `getVoices()` 는 호출마다 새 객체를 줄 수 있다.
 */
export function nextVoice<T extends Pick<SpeechSynthesisVoice, 'lang' | 'voiceURI'>>(
  current: T | null,
  voices: T[]
): T | null {
  const picked = pickEnglishVoice(voices)
  if (!current) return picked
  const stillThere = voices.some((v) => v.voiceURI === current.voiceURI)
  if (!stillThere) return picked
  // 유일한 교체 사유: 지역 변종 → en-US 승격
  if (!isUSEnglish(current.lang) && picked && isUSEnglish(picked.lang)) return picked
  return current
}
