// scripts/comic/comfy-auth.mjs
// 자가호스트 ComfyUI 접속 SSoT — URL 해석 + 인증(HTTP Basic · AI-Dock 폼로그인).
//
// 왜 모듈로 뽑았나: RunPod ai-dock 이미지는 **모든 서비스 앞에 폼 로그인**(포트 1111)을 둔다.
// 8188 에 그냥 fetch 하면 로그인 HTML 이 200 으로 돌아와 JSON 파싱에서 죽는다 —
// "GPU 가 도는데 왜 실패하지"로 보이는 가장 비싼 실패다. gen-comfy 는 이 처리를 갖고 있었고
// modernize(PDCP 모델 트랙)는 없었다. 같은 pod 를 두 클라이언트가 쓰는데 인증이 한쪽에만
// 있으면 반드시 어긋난다 → 한 곳에 둔다.
//
//   const comfy = await connectComfy({ base, user, pass })
//   fetch(`${comfy.base}/prompt`, { headers: comfy.headers({ 'Content-Type': 'application/json' }) })

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')

const readMaybe = (p) => {
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch {
    return ''
  }
}

/**
 * ComfyUI URL 해석. 우선순위: 인자 > env COMFY_URL > scripts/comic/.comfy-url > 저장소 루트 .comfy-url
 *
 * ⚠️ 두 경로를 모두 보는 이유: `runpod/pod.mjs` 가 `scripts/comic/.comfy-url` 에 쓰는데
 * 예전 modernize 는 저장소 루트만 읽어서, pod 를 띄워도 "COMFY_URL 이 없습니다"가 났다.
 * 어느 쪽에 있든 찾는다 — 쓰는 곳은 pod.mjs 하나(scripts/comic/)로 유지.
 */
export function resolveComfyUrl(explicit) {
  const u =
    explicit ||
    process.env.COMFY_URL ||
    readMaybe(path.join(HERE, '.comfy-url')) ||
    readMaybe(path.join(REPO, '.comfy-url'))
  return u ? u.trim().replace(/\/+$/, '') : ''
}

/**
 * 자격증명 해석. 우선순위: 인자 > env COMFY_USER/COMFY_PASS > gitignored 파일.
 * ai-dock 기본 계정은 user/password 이지만 **기본값을 코드에 박지 않는다** —
 * 자격증명이 없으면 없다고 말하는 편이 낫다(엉뚱한 계정으로 조용히 401 나는 것보다).
 */
export function resolveComfyCreds({ user, pass } = {}) {
  return {
    user: user || process.env.COMFY_USER || readMaybe(path.join(HERE, '.comfy-user')),
    pass: pass || process.env.COMFY_PASS || readMaybe(path.join(HERE, '.comfy-pass')),
  }
}

/**
 * 접속 + 인증. 반환 객체의 `headers()` 를 모든 요청에 쓰면 된다.
 *
 * 인증 두 갈래:
 *  1) HTTP Basic — 평범한 리버스 프록시 / URL userinfo
 *  2) AI-Dock 폼 로그인 — 8188 이 포털(:1111)의 /login 으로 302 → 토큰 쿠키를 받아 8188 에 실어 보냄
 *     (포트 간 서명키 공유). 프로브 Location 이 http 로 오는 경우가 있어 **https 강제** 필요 —
 *     안 하면 POST 가 인증 전에 301 되어 쿠키를 못 받는다.
 *
 * @returns {{ base:string, headers:(extra?:object)=>object, authed:boolean, mode:string }}
 */
export async function connectComfy({ base, user, pass, cookie, loginUrl, quiet } = {}) {
  let COMFY = resolveComfyUrl(base)
  if (!COMFY) {
    throw new Error(
      'COMFY_URL 이 없습니다.\n' +
        '  RunPod/Kaggle ComfyUI 주소를 COMFY_URL 환경변수, scripts/comic/.comfy-url,\n' +
        '  또는 저장소 루트 .comfy-url 에 두세요. (pod 기동: node scripts/comic/runpod/pod.mjs start)',
    )
  }

  let creds = resolveComfyCreds({ user, pass })
  // URL userinfo(https://user:pass@host) 도 자격증명으로 받아들이고 URL 에서는 떼어낸다.
  try {
    const u = new URL(COMFY)
    if (u.username) {
      creds = {
        user: creds.user || decodeURIComponent(u.username),
        pass: creds.pass || decodeURIComponent(u.password),
      }
      u.username = ''
      u.password = ''
      COMFY = u.toString().replace(/\/$/, '')
    }
  } catch {}

  const basic = creds.user
    ? { Authorization: 'Basic ' + Buffer.from(`${creds.user}:${creds.pass}`).toString('base64') }
    : null
  let COOKIE = cookie || process.env.COMFY_COOKIE || ''
  let mode = basic ? 'basic' : 'none'

  const log = (m) => {
    if (!quiet) console.error(m)
  }

  if (!COOKIE && creds.user) {
    let loginBase = loginUrl || process.env.COMFY_LOGIN_URL || ''
    let needsPortal = true
    try {
      const probe = await fetch(`${COMFY}/system_stats`, {
        redirect: 'manual',
        headers: basic || {},
        signal: AbortSignal.timeout(20000),
      })
      if (probe.status === 200) needsPortal = false // 포털 없음(또는 Basic 으로 이미 통과)
      const loc = probe.headers.get('location') || ''
      if (!loginBase && /\/login/i.test(loc)) loginBase = loc.replace(/\/login.*$/i, '')
    } catch {
      // 프로브 실패는 포털 유무를 말해주지 않는다 — 로그인을 시도해 본다.
    }
    if (needsPortal) {
      if (!loginBase) loginBase = COMFY.replace(/-(\d+)\.proxy\.runpod\.net/i, '-1111.proxy.runpod.net')
      loginBase = loginBase.replace(/^http:/i, 'https:').replace(/\/$/, '')
      try {
        const r = await fetch(`${loginBase}/login`, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ user: creds.user, password: creds.pass }).toString(),
          signal: AbortSignal.timeout(25000),
        })
        const m = (r.headers.get('set-cookie') || '').match(/ai_dock_[a-f0-9]+_token=[^;]+/i)
        if (m) {
          COOKIE = m[0]
          mode = 'ai-dock'
          log(`✓ AI-Dock 로그인 OK (${loginBase.replace(/^https?:\/\//, '')})`)
        } else {
          log(`! AI-Dock 로그인 실패 (status ${r.status}) — --user/--pass 확인`)
        }
      } catch (e) {
        log(`! AI-Dock 로그인 요청 실패: ${e.message}`)
      }
    }
  }

  const headers = (extra) => {
    const h = { ...(extra || {}), ...(basic || {}) }
    if (COOKIE) h.Cookie = COOKIE
    return h
  }
  return { base: COMFY, headers, authed: Boolean(COOKIE || basic), mode }
}

/**
 * 접속 확인 — `/system_stats` 가 JSON 을 주는지 본다.
 * GPU 를 태우기 전에 부르는 용도. **HTML 이 200 으로 오는 경우**(로그인 페이지)를 잡는 게 핵심이라
 * status 만 보지 않고 파싱까지 한다.
 */
export async function checkComfy(comfy) {
  const r = await fetch(`${comfy.base}/system_stats`, {
    headers: comfy.headers(),
    signal: AbortSignal.timeout(25000),
  })
  const txt = await r.text()
  if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` }
  let j
  try {
    j = JSON.parse(txt)
  } catch {
    return {
      ok: false,
      reason: /login|password/i.test(txt)
        ? '로그인 페이지가 돌아왔습니다 — 자격증명(--user/--pass) 필요'
        : 'JSON 이 아닌 응답',
    }
  }
  const dev = j.devices?.[0]
  return {
    ok: true,
    gpu: dev?.name || '?',
    vramGb: dev?.vram_total ? +(dev.vram_total / 1024 ** 3).toFixed(1) : null,
    comfyui: j.system?.comfyui_version || '?',
    torch: j.system?.pytorch_version || '?',
  }
}
