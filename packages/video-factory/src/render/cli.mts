// packages/video-factory/src/render/cli.mts
//
// **공장 조작반.**
//
//   pnpm video list                    설계도 목록과 길이
//   pnpm video check                   설계도 품질 검사만 (렌더 안 함)
//   pnpm video voice [<id|kind> …]     Edge TTS 로 나레이션 굽기 (재실행 안전)
//   pnpm video render <id> [--format]  한 편 찍기
//   pnpm video render-all [--kind …]   전부 찍기
//
// ⚠️ **종료코드를 믿지 않는다.** 실측 2026-09-12 — 다른 세션의 dev 서버가 3000 을 잡고 있어
//   Remotion 이 그 앱을 자기 번들로 착각했는데, 오류를 찍고도 **exit 0** 으로 끝났다.
//   그래서 렌더 뒤에는 항상 **파일이 생겼는지·크기가 0 이 아닌지**를 직접 본다.
//   (이 CLI 는 `bundle()` + `renderMedia()` 를 직접 부르므로 3000 을 잡지 않는다 —
//    포트 충돌은 `npx remotion render` 쪽 이야기다.)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'

import { buildSpecs, countByKind } from '../catalog/build'
import { loadBundle } from '../catalog/bundle'
import { validateAll } from '../spec/validate'
import { FPS, FORMATS, type FormatId } from '../spec/format'
import { applyVoiceTiming, loadVoiceManifest, synthesizeSpec } from '../voice/edge-tts'
import { specDuration } from '../remotion/VideoComposition'
import { ensureWorkFiles, writeVoiceIndex } from './ensure'
import type { VideoSpec } from '../spec/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '../..')
const ENTRY = path.join(PKG, 'src/remotion/index.ts')
const PUBLIC_DIR = path.join(PKG, 'work')
const OUT_DIR = path.join(PKG, 'out')

/**
 * 렌더러가 번들을 띄울 포트.
 *
 * **반드시 명시한다.** 비워 두면 3000 을 쓰는데, 이 워크스페이스는 여러 세션이 공유해
 * 거기 Next dev 서버가 떠 있기 일쑤다. 그러면 렌더러가 **그 앱을 자기 번들로 착각**하고
 *  로 죽는다(실측 2026-09-12, 두 번 겪었다).
 */
const RENDER_PORT = 4333

const args = process.argv.slice(2)
const cmd = args[0] ?? 'list'
const rest = args.slice(1)

function flag(name: string): string | null {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? (rest[i + 1] ?? null) : null
}
function has(name: string): boolean {
  return rest.includes(`--${name}`)
}
function positionals(): string[] {
  const out: string[] = []
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!
    if (a.startsWith('--')) {
      i++
      continue
    }
    out.push(a)
  }
  return out
}

/** 음성 실측 길이를 반영한 설계도. 이게 렌더가 보는 최종본이다. */
function specsWithVoice(): VideoSpec[] {
  return buildSpecs(loadBundle()).map((s) => applyVoiceTiming(s, loadVoiceManifest(s.id)))
}

/** `id` 하나, 또는 `kind` 하나, 또는 아무것도 안 주면 전부. */
function select(specs: VideoSpec[], keys: string[]): VideoSpec[] {
  if (keys.length === 0) return specs
  const out = specs.filter((s) => keys.includes(s.id) || keys.includes(s.kind))
  if (out.length === 0) {
    throw new Error(
      `그런 설계도가 없다: ${keys.join(', ')}\n  목록을 보려면  pnpm video list`,
    )
  }
  return out
}

function fmtSec(frames: number): string {
  return `${(frames / FPS).toFixed(1)}초`
}

async function cmdList(): Promise<void> {
  const specs = specsWithVoice()
  const byKind = countByKind(specs)
  for (const s of specs) {
    const voice = loadVoiceManifest(s.id)
    const voiced = voice ? Object.keys(voice).length : 0
    console.log(
      `${s.id.padEnd(28)} ${s.kind.padEnd(11)} ${String(s.scenes.length).padStart(2)}컷 ` +
        `${fmtSec(specDuration(s)).padStart(7)}  음성 ${voiced}/${s.scenes.length}  ${s.title}`,
    )
  }
  console.log(
    `\n설계도 ${specs.length}편 · 규격 ${Object.keys(FORMATS).length} → 컴포지션 ` +
      `${specs.reduce((n, s) => n + s.formats.length, 0)}개`,
  )
  console.log(
    '종류별 ' +
      Object.entries(byKind)
        .map(([k, n]) => `${k} ${n}`)
        .join(' · '),
  )
}

function cmdCheck(): number {
  const specs = specsWithVoice()
  const problems = validateAll(specs)
  if (problems.length === 0) {
    console.log(`OK 설계도 ${specs.length}편 — 위반 0`)
    return 0
  }
  for (const p of problems) console.log(`FAIL ${p.specId} [${p.rule}] ${p.detail}`)
  console.log(`\n위반 ${problems.length}건`)
  return 1
}

async function cmdVoice(): Promise<void> {
  const specs = select(buildSpecs(loadBundle()), positionals())
  const force = has('force')
  let made = 0
  let skipped = 0
  for (const spec of specs) {
    const r = await synthesizeSpec(spec, { force })
    made += r.made
    skipped += r.skipped
    const missing = spec.scenes.length - Object.keys(r.manifest).length
    console.log(
      `${spec.id.padEnd(28)} 새로 ${String(r.made).padStart(2)} · 건너뜀 ${String(r.skipped).padStart(2)}` +
        (missing > 0 ? `  ⚠ 못 구운 컷 ${missing}` : ''),
    )
  }
  const index = writeVoiceIndex()
  console.log(`\n새로 ${made} · 건너뜀 ${skipped} · manifest ${Object.keys(index).length}편`)
}

async function renderOne(
  serveUrl: string,
  spec: VideoSpec,
  format: FormatId,
): Promise<{ file: string; bytes: number }> {
  const id = `${spec.id}--${format}`
  const outFile = path.join(OUT_DIR, format, `${spec.id}.mp4`)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })

  const voice = loadVoiceManifest(spec.id)
  const inputProps = { spec, format, voice, brand: 'VOCAFLOW' }

  const composition = await selectComposition({ serveUrl, id, inputProps, port: RENDER_PORT })
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outFile,
    inputProps,
    // 학습자가 휴대폰에서 본다 — 파일이 크면 시작이 늦다. CRF 20 은 눈으로 무손실에 가깝다.
    crf: 20,
    audioCodec: 'aac',
    port: RENDER_PORT,
  })

  // **여기가 핵심** — 종료코드가 아니라 파일로 확인한다.
  if (!fs.existsSync(outFile)) throw new Error(`렌더가 끝났다는데 파일이 없다: ${outFile}`)
  const bytes = fs.statSync(outFile).size
  if (bytes === 0) throw new Error(`파일이 0바이트다: ${outFile}`)
  return { file: outFile, bytes }
}

async function cmdRender(all: boolean): Promise<number> {
  ensureWorkFiles()
  const specs = select(specsWithVoice(), all ? [] : positionals())
  const only = flag('format') as FormatId | null
  if (only && !(only in FORMATS)) {
    throw new Error(`그런 규격이 없다: ${only} (${Object.keys(FORMATS).join(' · ')})`)
  }

  console.log('번들 중…')
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: PUBLIC_DIR,
    onProgress: () => undefined,
  })

  let ok = 0
  let failed = 0
  for (const spec of specs) {
    for (const format of spec.formats) {
      if (only && format !== only) continue
      const t0 = Date.now()
      try {
        const r = await renderOne(serveUrl, spec, format)
        ok++
        console.log(
          `OK   ${spec.id}--${format}  ${(r.bytes / 1024 / 1024).toFixed(2)}MB  ` +
            `${((Date.now() - t0) / 1000).toFixed(1)}s`,
        )
      } catch (err) {
        failed++
        console.log(`FAIL ${spec.id}--${format}  ${(err as Error).message.split('\n')[0]}`)
      }
    }
  }
  console.log(`\n찍음 ${ok} · 실패 ${failed} → ${path.relative(process.cwd(), OUT_DIR)}`)
  return failed === 0 ? 0 : 1
}

async function main(): Promise<void> {
  switch (cmd) {
    case 'list':
      await cmdList()
      break
    case 'check':
      process.exitCode = cmdCheck()
      break
    case 'voice':
      await cmdVoice()
      break
    case 'render':
      process.exitCode = await cmdRender(false)
      break
    case 'render-all':
      process.exitCode = await cmdRender(true)
      break
    default:
      console.log(
        [
          'pnpm video list                     설계도 목록',
          'pnpm video check                    품질 검사',
          'pnpm video voice [<id|kind> …]      나레이션 굽기 (--force 로 다시)',
          'pnpm video render <id> [--format wide|vertical|square]',
          'pnpm video render-all [--format …]',
        ].join('\n'),
      )
      process.exitCode = 1
  }
}

void main().catch((err: unknown) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
