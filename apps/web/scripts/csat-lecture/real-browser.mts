// apps/web/scripts/csat-lecture/real-browser.mts
//
// **진짜 브라우저를 띄워 Playwright 로 붙는다 — 목소리가 보이는 유일한 길.**
//
// 실측 2026-09-17: Playwright 가 직접 띄운 Chromium·Chrome·Edge 는 headless 든 headed 든
// `speechSynthesis.getVoices()` 가 **0개**다(기본 실행 인자 탓). 같은 Chrome 을 우리가 띄우고
// CDP 로 붙으면 19개(Google 한국의 포함), Edge 는 321개(Natural 음성)가 나온다.
// 그래서 TTS 가 걸린 검사(Gate 0 · Gate 2)는 이 길로만 돈다.

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { chromium, type Browser } from '@playwright/test'

export const BROWSERS = {
  chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
} as const

export type BrowserName = keyof typeof BROWSERS

export async function launchReal(
  name: BrowserName,
  opts: { muted?: boolean; width?: number; height?: number } = {},
): Promise<{ browser: Browser; close: () => Promise<void> }> {
  const exe = BROWSERS[name]
  if (!fs.existsSync(exe)) throw new Error(`${name} 가 없다: ${exe}`)
  const port = 9300 + Math.floor(Math.random() * 600)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vf-${name}-`))
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    '--no-first-run',
    '--no-default-browser-check',
    // 사람의 손 없이 소리를 내야 한다 — 자동재생 정책이 막지 않게
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${opts.width ?? 1280},${opts.height ?? 900}`,
    ...(opts.muted ? ['--mute-audio'] : []),
    'about:blank',
  ]
  const proc: ChildProcess = spawn(exe, args, { stdio: 'ignore' })
  let browser: Browser | null = null
  for (let i = 0; i < 40 && !browser; i += 1) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  if (!browser) {
    proc.kill()
    throw new Error(`${name} 에 붙지 못했다`)
  }
  return {
    browser,
    close: async () => {
      await browser!.close().catch(() => {})
      proc.kill()
      // 브라우저가 파일을 늦게 놓는다(Windows) — 지우기는 최선을 다하되 실패로 치지 않는다
      await new Promise((r) => setTimeout(r, 800))
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 })
      } catch {
        /* 임시 폴더 — OS 가 나중에 치운다 */
      }
    },
  }
}
