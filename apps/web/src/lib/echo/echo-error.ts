// apps/web/src/lib/echo/echo-error.ts
//
// EchoMatch 실패 사유의 정본.
//
// 예전에는 문자열 상태 하나를 넷이 공유했고(모델 로드 · 재생 · 비교 · 미지원),
// 표시부는 그 값이 무엇이든 「음성 모델 로드 실패」라는 제목을 붙였다. 그래서
//   · 녹음 비교가 깨져도 학습자는 "모델이 문제구나" 로 읽었고,
//   · 붙어 있던 [다시 시도] 는 17MB 음성 모델 재초기화를 돌려 **고장 난 것과 무관한**
//     조치를 했다.
// 사유마다 제목·설명·복구 동작이 다르므로 종류를 값으로 만든다(M7).
//
// 마이크 권한 거부는 특히 나빴다(M6) — 브라우저의 영어 원문(`Permission denied`,
// `The request is not allowed by the user agent...`)이 붉은 상자에 그대로 떴고,
// 버튼을 다시 눌러도 브라우저가 프롬프트를 더 띄우지 않아 같은 영어만 반복됐다.
// 되돌리는 법(주소창 자물쇠)을 화면이 말해 주지 않으면 학습자는 그 화면에서 끝난다.

export type EchoErrorKind = 'mic' | 'model' | 'playback' | 'compare' | 'unsupported'

export interface EchoError {
  kind: EchoErrorKind
  /** 무엇이 고장 났는지 — 상자의 제목 */
  title: string
  /** 왜 그런지 + 다음 한 걸음 */
  message: string
}

/** 원문 메시지는 콘솔로만 남긴다 — 화면에는 한국어 안내만 낸다. */
function logRaw(scope: string, e: unknown): void {
  console.error(`[EchoMatch] ${scope}:`, e)
}

/**
 * `getUserMedia` 실패를 `DOMException.name` 으로 갈라 한국어 안내로 바꾼다.
 * name 을 못 읽는 비표준 오류에도 반드시 한국어를 돌려준다.
 */
export function micError(e: unknown): EchoError {
  logRaw('mic access failed', e)
  const name =
    typeof DOMException !== 'undefined' && e instanceof DOMException
      ? e.name
      : ((e as { name?: string } | null)?.name ?? '')
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        kind: 'mic',
        title: '마이크 사용이 차단돼 있어요',
        message:
          '주소창 왼쪽 자물쇠 → 마이크 → 「허용」으로 바꾼 뒤 이 페이지를 새로고침해 주세요. 한 번 차단하면 브라우저가 더 묻지 않아, 아래 버튼을 다시 눌러도 열리지 않아요.',
      }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        kind: 'mic',
        title: '마이크를 찾지 못했어요',
        message:
          '이 기기에 연결된 마이크가 없어요. 헤드셋이나 외장 마이크를 연결한 뒤 다시 시도해 주세요. 마이크 없이도 본문 읽기와 받아쓰기는 그대로 쓸 수 있어요.',
      }
    case 'NotReadableError':
    case 'AbortError':
      return {
        kind: 'mic',
        title: '다른 앱이 마이크를 쓰고 있어요',
        message:
          '화상회의·녹음 앱을 닫은 뒤 다시 시도해 주세요. 기기에 따라 마이크를 쓰는 탭을 하나만 열어 두어야 할 수도 있어요.',
      }
    default:
      return {
        kind: 'mic',
        title: '마이크를 열지 못했어요',
        message:
          '잠시 뒤 다시 시도해 주세요. 계속 같으면 페이지를 새로고침하거나 다른 브라우저에서 열어 보세요.',
      }
  }
}

export function modelError(e: unknown): EchoError {
  logRaw('Piper init failed', e)
  return {
    kind: 'model',
    title: '음성 모델을 내려받지 못했어요',
    message:
      '원어민 음성을 만드는 17MB 모델을 받는 중 연결이 끊겼어요. 네트워크를 확인하고 다시 시도해 주세요 — 한 번 받아 두면 다음부터는 즉시 시작합니다.',
  }
}

export function playbackError(e: unknown): EchoError {
  logRaw('playback failed', e)
  return {
    kind: 'playback',
    title: '이 문장의 음성을 재생하지 못했어요',
    message:
      '음성을 만들거나 재생하는 데 실패했어요. 같은 문장을 다시 시도하거나, 계속 같으면 다음 문장으로 넘어가 주세요.',
  }
}

export function compareError(e: unknown): EchoError {
  logRaw('compare failed', e)
  return {
    kind: 'compare',
    title: '녹음을 비교하지 못했어요',
    message:
      '방금 녹음은 채점되지 않았고 기록에도 남지 않았어요. 조용한 곳에서 한 번 더 읽어 볼까요?',
  }
}

export const unsupportedError: EchoError = {
  kind: 'unsupported',
  title: '이 브라우저에서는 따라읽기를 쓸 수 없어요',
  message:
    '원어민 음성 합성에 필요한 WASM 을 이 브라우저가 지원하지 않아요. 최신 Chrome·Edge·Safari 에서 열면 바로 됩니다. 그동안은 받아쓰기로 같은 문장을 연습할 수 있어요.',
}
