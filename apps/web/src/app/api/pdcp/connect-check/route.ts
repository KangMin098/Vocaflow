// apps/web/src/app/api/pdcp/connect-check/route.ts
//
// GPU/모델 연결 점검 — AI 리스타일 트랙(선택)이 도는 자가호스트 연결(RunPod·ComfyUI)을
// read-only 로 확인. scripts/comic/connect-check.mjs 를 spawn. dev·admin. 과금 없음.

import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import path from 'node:path'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPO_ROOT = path.resolve(process.cwd(), '..', '..')
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, '')

export async function GET(): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev 전용' }, { status: 404 })

  const output = await new Promise<string>((resolve) => {
    const child = spawn(process.execPath, [path.join(REPO_ROOT, 'scripts', 'comic', 'connect-check.mjs')], { cwd: REPO_ROOT, env: process.env, windowsHide: true })
    let out = ''
    const timer = setTimeout(() => child.kill(), 60_000)
    child.stdout.on('data', (d) => { out += String(d) })
    child.stderr.on('data', (d) => { out += String(d) })
    child.on('error', (e) => { clearTimeout(timer); resolve(out + String(e)) })
    child.on('close', () => { clearTimeout(timer); resolve(out) })
  })

  return NextResponse.json({ output: stripAnsi(output).trim() })
}
