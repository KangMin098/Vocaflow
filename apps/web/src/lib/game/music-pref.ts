// apps/web/src/lib/game/music-pref.ts
//
// 아케이드 배경음악 선호 — 게임(gamekit)과 허브(아케이드 페이지)가 공유하는 단일 키.
//
// 왜 분리했나:
//   BGM 을 붙여놨는데 실제로 듣는 학습자가 없었다. 원인은 재생 로직이 아니라
//   **발견성** — 켜는 길이 게임 HUD 좌하단의 작은 무라벨 아이콘 하나뿐이라
//   존재 자체를 몰랐다. 허브(조용한 맥락)에서도 정할 수 있게 키를 양쪽이 함께 읽는다.
//
// 기본값 — v07.6 부터 **ON** (사용자 결정 2026-08-09: "단어 게임은 음악이 중요함").
//   이전에는 OFF 였다. 근거는 Calm UI 였지만, 실측해보니 결과가 Calm 이 아니라
//   **무음**이었다: 토글을 누르기 전에는 트랙을 내려받지도 않아, 시네마틱 BGM 을
//   19곡 붙여놓고도 처음 들어온 학습자는 한 곡도 듣지 못했다.
//   Calm UI 는 "자극을 줄인다"이지 "기능을 숨긴다"가 아니므로 기본값을 뒤집는다.
//
//   자동재생 정책과 싸우지 않는다 — 첫 로드에서 play() 가 거부되면 gamekit 이
//   다음 사용자 제스처(pointerdown / keydown)에 조용히 시작한다. 소리가 먼저
//   튀어나오는 게 아니라, 학습자가 게임을 시작하는 순간 페이드 인으로 들어온다.
//
// null = "한 번도 정한 적 없음". 기본값과 구분해서 보관해야
//   ① 게임 내 버튼을 첫 진입에 한해 라벨과 함께 눈에 띄게 하고
//   ② 나중에 기본값을 또 바꿔도 명시적으로 OFF 를 고른 학습자를 덮어쓰지 않는다.

'use client'

export const MUSIC_PREF_KEY = 'vocaflow-arcade-music'

/** 선호 미설정 시 적용되는 기본값. */
export const DEFAULT_MUSIC_ON = true

/** 사용자가 아직 한 번도 정하지 않았으면 null. */
export function readMusicPref(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(MUSIC_PREF_KEY)
    if (v === '1') return true
    if (v === '0') return false
    return null
  } catch {
    return null // private mode
  }
}

/** 실제 적용될 on/off — 미설정이면 기본값. 재생 판단은 항상 이쪽을 쓴다. */
export function readMusicOn(): boolean {
  return readMusicPref() ?? DEFAULT_MUSIC_ON
}

export function writeMusicPref(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MUSIC_PREF_KEY, on ? '1' : '0')
  } catch {
    /* private mode — 세션 한정으로만 동작 */
  }
}
