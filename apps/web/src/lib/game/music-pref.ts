// apps/web/src/lib/game/music-pref.ts
//
// 아케이드 배경음악 선호 — 게임(gamekit)과 허브(아케이드 페이지)가 공유하는 단일 키.
//
// 왜 분리했나:
//   BGM 14곡(17MB)을 붙여놨는데 실제로 듣는 학습자가 없었다. 원인은 재생 로직이 아니라
//   **발견성** — 기본값 OFF 이고, 켜는 길이 게임 HUD 좌하단의 작은 무라벨 아이콘 하나뿐이라
//   존재 자체를 모른다(실측: 게임 진입 시 pref=null → 무음, 토글하면 정상 재생).
//   허브(조용한 맥락)에서도 켤 수 있게 하려면 키를 양쪽이 함께 읽어야 한다.
//
// 기본값은 계속 OFF — 자동 재생은 Calm UI 위반이고 브라우저 정책과도 싸운다.
// 대신 "한 번도 정한 적 없음(null)"을 구분해, 게임 내 버튼을 첫 진입에 한해 눈에 띄게 한다.

'use client'

export const MUSIC_PREF_KEY = 'vocaflow-arcade-music'

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

export function writeMusicPref(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MUSIC_PREF_KEY, on ? '1' : '0')
  } catch {
    /* private mode — 세션 한정으로만 동작 */
  }
}
