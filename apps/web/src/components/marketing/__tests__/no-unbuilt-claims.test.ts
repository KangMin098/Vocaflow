// apps/web/src/components/marketing/__tests__/no-unbuilt-claims.test.ts
//
// **공개 화면은 빌드되지 않은 기능을 팔지 않는다.**
//
// 옆 파일(`no-hardcoded-stats`)은 *수치* 를 막는다. 이 파일은 *기능 주장* 을 막는다 —
// 2026-08-29 진단에서 걸린 것이 후자였다:
//   `/pricing` 이 "음성(TTS) 자연스러운 OpenAI 보이스" 를 Pro 특전으로 걸고,
//   FAQ 가 "GPT-4o-mini 기본 · Pro 는 GPT-4o · TTS 는 OpenAI TTS-1" 이라 답하고 있었다.
//   실측하면 그런 경로가 **하나도 없다** — API 라우트 76개 중 LLM 클라이언트 생성 0건,
//   음성은 브라우저 `speechSynthesis`. 없는 기능을 값 받고 파는 것은 표시광고법 문제다.
//
// 왜 "그 단어를 쓰지 마라" 가 아니라 **조건부**인가:
//   금지어 목록으로 만들면, 나중에 진짜로 OpenAI 를 붙였을 때 이 테스트가 정직한 문구를
//   막아선다. 그래서 막을 것은 단어가 아니라 **불일치** 다 —
//   "런타임에 LLM 을 부르는 코드가 없으면, 마케팅도 LLM 을 판다고 말하지 않는다."
//   실제로 붙이는 날 앞쪽 조건이 저절로 풀리고 테스트는 조용해진다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const MARKETING_ROOTS = [
  join(process.cwd(), 'src', 'app', '(marketing)'),
  join(process.cwd(), 'src', 'components', 'marketing'),
]
const API_ROOT = join(process.cwd(), 'src', 'app', 'api')

/** 런타임에 LLM 을 실제로 부르는 흔적. 있으면 마케팅이 그걸 말해도 된다. */
const RUNTIME_LLM =
  /new\s+OpenAI\s*\(|new\s+Anthropic\s*\(|api\.openai\.com|api\.anthropic\.com|openai\.chat\.|anthropic\.messages\./

/** 유료 음성 합성을 실제로 부르는 흔적 (브라우저 speechSynthesis 는 여기 해당 없음). */
const RUNTIME_PAID_TTS = /audio\/speech|tts-1|elevenlabs|텍스트-음성\s*API/i

/**
 * 공개 화면이 "우리는 이런 외부 모델을 쓴다" 고 말하는 문구.
 *
 * 개인정보처리방침의 **위탁 업체명**(`Anthropic` 처럼 회사 이름만 적는 것)은 일부러 넣지
 * 않았다 — 그건 파는 문구가 아니라 법이 요구하는 고지이고, 오프라인 제작 단계에서 실제로
 * 쓰기 때문에 사실이다. 여기서 잡는 것은 **어떤 모델이 학습 화면에서 돈다** 는 판매 주장이다.
 */
const CLAIMS_LLM = /GPT-?[0-9]|gpt-[0-9]|Claude\s*[0-9]|Gemini|OpenAI/
const CLAIMS_PAID_TTS = /TTS-?1|ElevenLabs|일레븐랩스/i

function walk(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

function safeWalk(dir: string): string[] {
  try {
    return walk(dir)
  } catch {
    return []
  }
}

/** 주석은 이력을 적는 자리다 — 화면에 나가지 않으므로 주장으로 세지 않는다. */
function isComment(line: string): boolean {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

function scan(files: string[], pattern: RegExp, skipComments: boolean): string[] {
  const hits: string[] = []
  for (const f of files) {
    readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (skipComments && isComment(line)) return
        if (!pattern.test(line)) return
        hits.push(`${f.split('src')[1]}:${i + 1}  ${line.trim().slice(0, 90)}`)
      })
  }
  return hits
}

describe('공개 마케팅 화면 — 빌드되지 않은 기능 주장 금지', () => {
  const marketingFiles = MARKETING_ROOTS.flatMap(safeWalk)
  const apiFiles = safeWalk(API_ROOT)

  it('검사 대상이 있다 — 경로가 바뀌면 이 테스트가 조용히 아무것도 안 본다', () => {
    expect(marketingFiles.length).toBeGreaterThan(3)
    expect(apiFiles.length).toBeGreaterThan(10)
  })

  it('런타임 LLM 호출이 없으면 마케팅도 외부 모델을 판다고 말하지 않는다', () => {
    // 주석까지 포함해 찾는다 — 구현 흔적은 주석에 남아 있어도 "붙는 중" 의 신호다.
    const runtime = scan(apiFiles, RUNTIME_LLM, false)
    if (runtime.length > 0) return // 실제로 부른다 → 문구는 사실이다. 통과.

    const claims = scan(marketingFiles, CLAIMS_LLM, true)
    expect(
      claims,
      'API 라우트 어디에서도 LLM 을 부르지 않는데 공개 화면이 외부 모델을 판다고 말한다.\n' +
        '기능을 붙이거나 문구를 내릴 것:\n' +
        claims.join('\n'),
    ).toEqual([])
  })

  it('유료 음성 API 호출이 없으면 마케팅도 그 음성을 판다고 말하지 않는다', () => {
    const runtime = scan(apiFiles, RUNTIME_PAID_TTS, false)
    if (runtime.length > 0) return

    const claims = scan(marketingFiles, CLAIMS_PAID_TTS, true)
    expect(
      claims,
      '유료 음성 합성을 부르는 경로가 없는데 공개 화면이 그 음성을 판다고 말한다.\n' +
        '재생은 브라우저 speechSynthesis 다:\n' +
        claims.join('\n'),
    ).toEqual([])
  })
})
