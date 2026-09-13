// packages/video-factory/src/render/cli.mts
//
// **공장 조작반.**
//
//   pnpm video enqueue                 설계도를 큐에 올린다 (재실행 안전)
//   pnpm video list                    설계도 목록과 길이 · 큐 현황
//   pnpm video check                   설계도 품질 검사만 (렌더 안 함)
//   pnpm video voice [<id|kind> …]     Edge TTS 로 나레이션 굽기 (재실행 안전)
//   pnpm video render <id> [--format]  한 편 찍기
//   pnpm video render-all [--kind …]   전부 찍기
//   pnpm video thumbs [<id|kind> …]    YouTube 썸네일 (영상이 아니라 1프레임)
//   pnpm video loudness [--fix]        음량이 YouTube 규격(-14 LUFS) 안인지 (--fix 로 맞춤)
//   pnpm video stale                   발행본 ↔ 설계도 어긋남 (렌더 안 함)
//
// ⚠️ **종료코드를 믿지 않는다.** 실측 2026-09-12 — 다른 세션의 dev 서버가 3000 을 잡고 있어
//   Remotion 이 그 앱을 자기 번들로 착각했는데, 오류를 찍고도 **exit 0** 으로 끝났다.
//   그래서 렌더 뒤에는 항상 **파일이 생겼는지·크기가 0 이 아닌지**를 직접 본다.
//   (이 CLI 는 `bundle()` + `renderMedia()` 를 직접 부르므로 3000 을 잡지 않는다 —
//    포트 충돌은 `npx remotion render` 쪽 이야기다.)

import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'

import { buildSpecs, countByKind } from '../catalog/build'
import { loadBundle } from '../catalog/bundle'
import { validateAll } from '../spec/validate'
import { FPS, FORMATS, type FormatId } from '../spec/format'
import { applyVoiceTiming, loadVoiceManifest, synthesizeSpec } from '../voice/edge-tts'
import { specDuration } from '../remotion/VideoComposition'
import { ensureWorkFiles, writeVoiceIndex } from './ensure'
import { advance, enqueueAll, overview } from '../jobs/client'
import { allRendered, measure, normalize, shortName } from './loudness-run.mjs'
import {
  offsetFromTarget,
  report as loudnessReport,
  TARGET_LUFS,
  TOLERANCE_LU,
  withinSpec,
  type Loudness,
} from './loudness'
import type { VideoSpec } from '../spec/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '../..')
const ENTRY = path.join(PKG, 'src/remotion/index.ts')
const PUBLIC_DIR = path.join(PKG, 'work')
const OUT_DIR = path.join(PKG, 'out')
const THUMB_DIR = path.join(PKG, 'dist-media/thumb')

/**
 * 렌더러가 번들을 띄울 포트 — **실제로 비어 있는 것을 찾아서** 쓴다.
 *
 * 비워 두면 Remotion 이 3000 을 쓰는데, 이 워크스페이스는 여러 세션이 공유해 거기 Next dev
 * 서버가 떠 있기 일쑤다. 그러면 렌더러가 **그 앱을 자기 번들로 착각**하고
 * `window.getStaticCompositions is undefined` 로 죽는다(실측 2026-09-12).
 *
 * 그렇다고 한 번호로 못 박으면 **새 실패 모드**가 생긴다 — 앞 렌더를 중단한 직후 그 포트가
 * 아직 붙들려 있어 141편이 전부 즉시 실패했다(실측 2026-09-13, 4333 고정일 때).
 * 그래서 후보를 차례로 **바인드해 보고** 되는 것을 쓴다.
 */
async function freePort(from = 4333, tries = 40): Promise<number> {
  for (let port = from; port < from + tries; port++) {
    const ok = await new Promise<boolean>((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(false))
      srv.once('listening', () => srv.close(() => resolve(true)))
      // ⚠️ **호스트를 지정하지 않는다**(= 0.0.0.0 전체에 바인드).
      //   `127.0.0.1` 로 시험하면 Windows 에서 **이미 0.0.0.0 로 잡혀 있어도 성공한다** —
      //   그래서 "비었다" 고 답한 포트에서 Remotion 이 곧바로 튕겼고, 186편이 전부
      //   즉시 실패했다(실측 2026-09-13). 렌더러가 잡는 방식과 **같은 방식**으로 시험해야 한다.
      srv.listen(port)
    })
    if (ok) return port
  }
  throw new Error(`${from}부터 ${tries}개를 봤는데 빈 포트가 없다`)
}

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

  // 큐 — 파일이 아니라 **기록**이 말하는 진행. 못 읽으면 조용히 뺀다(마이그레이션 전).
  const q = await overview()
  if (q && q.length > 0) {
    console.log('큐   ' + q.map((r) => `${r.stage} ${r.n}`).join(' · '))
  }
}

/** 설계도 전부를 큐에 올린다 — 이게 「안 만든 편」의 분모가 된다. */
async function cmdEnqueue(): Promise<void> {
  const specs = select(buildSpecs(loadBundle()), positionals())
  const r = await enqueueAll(specs)
  console.log(`큐에 올림 ${r.ok}` + (r.skipped ? ` · 못 올림 ${r.skipped}` : ''))
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
    // 구운 컷이 하나도 없으면 실패로 남긴다 — 콘솔에만 찍고 사라지면 아무도 모른다.
    if (Object.keys(r.manifest).length === 0) {
      await advance(spec.id, spec.kind, 'failed', { scenes: spec.scenes.length }, '나레이션을 한 컷도 못 구웠다')
    } else {
      await advance(spec.id, spec.kind, 'voiced', {
        scenes: spec.scenes.length,
        voice_clips: Object.keys(r.manifest).length,
        note: missing > 0 ? `못 구운 컷 ${missing}` : undefined,
      })
    }
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
  port: number,
): Promise<{ file: string; bytes: number }> {
  const id = `${spec.id}--${format}`
  const outFile = path.join(OUT_DIR, format, `${spec.id}.mp4`)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })

  const voice = loadVoiceManifest(spec.id)
  const inputProps = { spec, format, voice, brand: 'VOCAFLOW' }

  const composition = await selectComposition({ serveUrl, id, inputProps, port })
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outFile,
    inputProps,
    // 학습자가 휴대폰에서 본다 — 파일이 크면 시작이 늦다. CRF 20 은 눈으로 무손실에 가깝다.
    crf: 20,
    audioCodec: 'aac',
    port,
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

  const port = await freePort()
  console.log(`번들 중… (렌더 포트 ${port})`)
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: PUBLIC_DIR,
    onProgress: () => undefined,
  })

  let ok = 0
  let failed = 0
  for (const spec of specs) {
    // 편 단위로 모아서 한 번 기록한다 — 규격마다 쓰면 한 편에 세 번 쓴다.
    let made = 0
    let bytes = 0
    let lastError: string | null = null
    for (const format of spec.formats) {
      if (only && format !== only) continue
      const t0 = Date.now()
      try {
        const r = await renderOne(serveUrl, spec, format, port)
        made++
        bytes += r.bytes
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

/**
 * 썸네일 62장 — **포스터와 다른 물건**이다(`Thumbnail.tsx` 머리말 참조).
 *
 * 영상이 아니라 1프레임이라 장당 1~3초다. 재실행 안전: 이미 있으면 건너뛴다.
 */
async function cmdThumbs(): Promise<number> {
  ensureWorkFiles()
  const specs = select(specsWithVoice(), positionals())
  const force = has('force')
  fs.mkdirSync(THUMB_DIR, { recursive: true })

  const port = await freePort()
  console.log(`번들 중… (렌더 포트 ${port})`)
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, onProgress: () => undefined })

  let made = 0
  let skipped = 0
  let failed = 0
  for (const spec of specs) {
    const out = path.join(THUMB_DIR, `${spec.id}.jpg`)
    if (!force && fs.existsSync(out) && fs.statSync(out).size > 0) {
      skipped++
      continue
    }
    const id = `${spec.id}--thumb`
    const inputProps = { spec, brand: 'VOCAFLOW' }
    try {
      const composition = await selectComposition({ serveUrl, id, inputProps, port })
      await renderStill({
        composition,
        serveUrl,
        output: out,
        inputProps,
        imageFormat: 'jpeg',
        jpegQuality: 90,
        port,
      })
      // 종료코드가 아니라 파일로 확인한다 — 이 저장소에서 이미 겪은 함정.
      if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error('파일이 비었다')
      await advance(spec.id, spec.kind, 'rendered', { thumb: true })
      made++
    } catch (err) {
      failed++
      console.log(`FAIL ${spec.id} — ${(err as Error).message.split('\n')[0]}`)
    }
  }
  console.log(`썸네일 새로 ${made} · 건너뜀 ${skipped}` + (failed ? ` · 실패 ${failed}` : ''))
  console.log(`  → ${path.relative(process.cwd(), THUMB_DIR)}`)
  return failed === 0 ? 0 : 1
}

/**
 * **음량이 YouTube 규격 안인가** — 이 공장에서 유일하게 "시중" 과 **같은 자**로 잴 수 있는 축.
 *
 * 나머지 품질 축(카피·구성·색)은 경쟁사 파이프라인을 관측할 수 없어 비교 자체가 성립하지 않는다.
 * 음량만은 YouTube 가 규격을 공개했고, **큰 소리는 줄이지만 작은 소리는 키워 주지 않는다** —
 * 목표보다 조용하면 같은 피드에서 실제로 작게 재생된다.
 *
 * 재실행 안전: 이미 규격 안인 편은 건드리지 않는다(다시 인코딩하면 세대손실만 쌓인다).
 */
function cmdLoudness(): number {
  const files = allRendered()
  if (files.length === 0) {
    console.log('잰 것이 없다 — 먼저 `pnpm video render-all` 을 돌린다')
    return 1
  }
  const fix = has('fix')
  const results: Loudness[] = []
  let fixed = 0
  let unfixable = 0

  for (const file of files) {
    let l = measure(file)
    if (fix && withinSpec(l) === false) {
      const r = normalize(file)
      if (r) {
        l = r.after
        fixed++
        console.log(
          `맞춤 ${shortName(file).padEnd(34)} ${String(r.before.integrated).padStart(6)} → ` +
            `${String(r.after.integrated).padStart(6)} LUFS`,
        )
      } else {
        unfixable++
        console.log(`FAIL ${shortName(file)} — 정규화가 파일을 못 만들었다`)
      }
    }
    results.push(l)
  }

  const r = loudnessReport(results)
  for (const l of results) {
    const v = withinSpec(l)
    if (v === true) continue
    const mark = v === null ? '못 잼 ' : '벗어남'
    const off = offsetFromTarget(l)
    console.log(
      `${mark} ${shortName(l.file).padEnd(34)} ${String(l.integrated).padStart(6)} LUFS` +
        (off === null ? '' : ` (목표 ${TARGET_LUFS} 대비 ${off > 0 ? '+' : ''}${off} LU)`) +
        `  TP ${String(l.truePeak)} dBTP`,
    )
  }

  console.log(
    `\n잰 편 ${r.measured} · 규격 안 ${r.pass} · 벗어남 ${r.fail}` +
      (r.unknown ? ` · 못 잼 ${r.unknown}` : '') +
      (fixed ? ` · 맞춤 ${fixed}` : '') +
      (unfixable ? ` · 못 맞춤 ${unfixable}` : ''),
  )
  console.log(
    `목표 ${TARGET_LUFS} LUFS ±${TOLERANCE_LU} · 편차(최대-최소) ` +
      `${r.spreadLu === null ? '?' : r.spreadLu} LU` +
      (r.worst ? ` · 가장 먼 편 ${shortName(r.worst.file)} ${r.worst.integrated}` : ''),
  )
  if (r.fail > 0 && !fix) {
    console.log('  맞추려면  pnpm video loudness --fix  (그다음 package → publish)')
  }
  return r.fail === 0 && r.unknown === 0 ? 0 : 1
}

/**
 * **발행된 것과 지금 설계도가 어긋나는가.**
 *
 * 이 공장의 마지막 구멍이다. `out/` 은 커밋하지 않으므로 저장소에 남는 것은 manifest 한 장인데,
 * 설계도의 문구나 컷 길이를 고쳐도 **이미 올라간 mp4 는 옛 내용을 말한다.** 그리고 아무도
 * 안 알려 준다 — 화면은 멀쩡히 뜨고, 영상만 거짓말을 한다.
 *
 * 셋을 가른다:
 *   · **없어진 편** — manifest 에 있는데 설계도에 없다. 화면이 죽은 링크를 그린다
 *   · **안 올린 편** — 설계도에 있는데 manifest 에 없다. 새로 만든 영상이 화면에 안 뜬다
 *   · **낡은 편** — 제목·부제가 다르거나 길이가 어긋난다(문구를 고치면 길이가 바뀐다)
 *
 * 재고 수치가 달라진 것은 **낡음으로 세지 않는다** — 영상은 찍은 날의 스냅샷이고,
 * 화면에도 출처와 날짜가 함께 박혀 있다. DB 가 자랄 때마다 186편을 다시 찍을 수는 없다.
 */
function cmdStale(): number {
  const specs = specsWithVoice()
  const manifestPathAbs = path.resolve(PKG, '../../apps/web/src/lib/video/manifest.json')
  if (!fs.existsSync(manifestPathAbs)) {
    console.log('manifest 가 없다 — 아직 한 번도 포장하지 않았다 (pnpm video package)')
    return 1
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPathAbs, 'utf8')) as {
    baseUrl: string | null
    videos: { id: string; title: string; subtitle: string; seconds: number }[]
  }
  const byId = new Map(manifest.videos.map((v) => [v.id, v]))
  const specIds = new Set(specs.map((s) => s.id))

  const orphan = manifest.videos.filter((v) => !specIds.has(v.id)).map((v) => v.id)
  const unpublished = specs.filter((s) => !byId.has(s.id)).map((s) => s.id)
  const stale: string[] = []
  for (const spec of specs) {
    const v = byId.get(spec.id)
    if (!v) continue
    const seconds = Number((specDuration(spec) / FPS).toFixed(2))
    if (v.title !== spec.title) stale.push(`${spec.id}: 제목 «${v.title}» → «${spec.title}»`)
    else if (v.subtitle !== spec.subtitle) stale.push(`${spec.id}: 부제가 바뀌었다`)
    // 0.1초는 반올림 오차 — 문구를 고치면 음성 길이가 그보다 훨씬 크게 바뀐다.
    else if (Math.abs(v.seconds - seconds) > 0.1) {
      stale.push(`${spec.id}: 길이 ${v.seconds}초 → ${seconds}초 (문구가 바뀌었다)`)
    }
  }

  for (const id of orphan) console.log(`없어진 편  ${id} — manifest 에 있는데 설계도에 없다`)
  for (const id of unpublished) console.log(`안 올린 편 ${id} — 찍고 올려야 화면에 뜬다`)
  for (const line of stale) console.log(`낡은 편   ${line}`)

  const bad = orphan.length + unpublished.length + stale.length
  if (bad === 0) {
    console.log(
      `OK 발행본과 설계도가 일치한다 — ${manifest.videos.length}편` +
        (manifest.baseUrl ? '' : ' (아직 baseUrl 없음 — 화면에는 안 뜬다)'),
    )
    return 0
  }
  console.log(
    `\n없어진 ${orphan.length} · 안 올린 ${unpublished.length} · 낡은 ${stale.length}\n` +
      '  고치는 법:  pnpm video voice && pnpm video render-all && pnpm video thumbs && ' +
      'pnpm --filter @vocaflow/video-factory package && … publish',
  )
  return 1
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
    case 'enqueue':
      await cmdEnqueue()
      break
    case 'stale':
      process.exitCode = cmdStale()
      break
    case 'loudness':
      process.exitCode = cmdLoudness()
      break
    case 'thumbs':
      process.exitCode = await cmdThumbs()
      break
    default:
      console.log(
        [
          'pnpm video list                     설계도 목록',
          'pnpm video check                    품질 검사',
          'pnpm video voice [<id|kind> …]      나레이션 굽기 (--force 로 다시)',
          'pnpm video render <id> [--format wide|vertical|square]',
          'pnpm video render-all [--format …]',
          'pnpm video thumbs [<id|kind> …]     YouTube 썸네일 1280×720 (--force 로 다시)',
          'pnpm video enqueue                  설계도를 큐에 올린다 (재실행 안전)',
          'pnpm video loudness [--fix]         음량이 YouTube 규격(-14 LUFS) 안인지',
          'pnpm video stale                    발행본이 설계도와 어긋나는지',
        ].join('\n'),
      )
      process.exitCode = 1
  }
}

void main().catch((err: unknown) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
