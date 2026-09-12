// packages/video-factory/src/render/package.mts
//
// **찍은 mp4 를 "내보낼 수 있는 것" 으로 만든다.**
//
//   mp4 (이미 있음) + 포스터 + WebVTT 자막 + 설명글 + manifest
//
// 왜 렌더와 분리했나: 렌더는 분 단위고 이것은 초 단위다. 자막 문구만 고쳤을 때
// 영상을 다시 찍을 이유가 없다. 그리고 **포스터는 mp4 에서 뽑는다** — 다시 렌더하면
// 141장에 12분이 드는데 ffmpeg 로 뽑으면 장당 1초도 안 걸린다.
//
// manifest 는 `apps/web` 이 읽는다 — 앱은 이 패키지를 import 하지 않고 **JSON 한 장**만 본다.
// 그래야 Next 번들에 헤드리스 렌더러가 딸려 들어가지 않는다.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSpecs } from '../catalog/build'
import { loadBundle } from '../catalog/bundle'
import { FPS, FORMATS, type FormatId } from '../spec/format'
import { applyVoiceTiming } from '../voice/timing'
import { loadVoiceManifest } from '../voice/edge-tts'
import { specDuration } from '../remotion/VideoComposition'
import { posterFrame, toDescription, toWebVtt } from './captions'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '../..')
const OUT = path.join(PKG, 'out')
const DIST = path.join(PKG, 'dist-media')
const MANIFEST = path.resolve(PKG, '../../apps/web/src/lib/video/manifest.json')

export interface ManifestFormat {
  /** 발행 경로(버킷 안 상대 경로). 아직 안 올렸으면 파일만 있고 url 은 없다. */
  file: string
  poster: string
  bytes: number
  width: number
  height: number
}

export interface ManifestEntry {
  id: string
  kind: string
  title: string
  subtitle: string
  /** 초. 규격이 달라도 길이는 같다. */
  seconds: number
  captions: string
  formats: Partial<Record<FormatId, ManifestFormat>>
}

export interface Manifest {
  builtAt: string
  /** 공개 기준 URL. 발행 전에는 null — 앱은 이 값이 없으면 플레이어를 그리지 않는다. */
  baseUrl: string | null
  videos: ManifestEntry[]
}

/** Remotion 이 함께 깔아 준 ffmpeg 를 쓴다 — 시스템에 ffmpeg 가 없어도 된다. */
function ffmpeg(args: string[]): void {
  execFileSync('npx', ['remotion', 'ffmpeg', ...args], {
    cwd: PKG,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })
}

function main(): void {
  const specs = buildSpecs(loadBundle()).map((s) => applyVoiceTiming(s, loadVoiceManifest(s.id)))
  fs.mkdirSync(DIST, { recursive: true })

  const videos: ManifestEntry[] = []
  let posters = 0
  let missing = 0

  for (const spec of specs) {
    const voice = loadVoiceManifest(spec.id)
    const frames = specDuration(spec)
    const seconds = Number((frames / FPS).toFixed(2))

    // 자막·설명은 규격과 무관하다 — 한 번만 쓴다.
    const vtt = path.join(DIST, `${spec.id}.vtt`)
    fs.writeFileSync(vtt, toWebVtt(spec, voice), 'utf8')
    fs.writeFileSync(path.join(DIST, `${spec.id}.txt`), toDescription(spec), 'utf8')

    const formats: Partial<Record<FormatId, ManifestFormat>> = {}
    for (const format of spec.formats) {
      const mp4 = path.join(OUT, format, `${spec.id}.mp4`)
      if (!fs.existsSync(mp4)) {
        missing++
        continue
      }
      const posterRel = `${format}/${spec.id}.jpg`
      const poster = path.join(DIST, posterRel)
      fs.mkdirSync(path.dirname(poster), { recursive: true })
      if (!fs.existsSync(poster)) {
        // 첫 프레임은 페이드 중이라 비어 있다 — 첫 컷의 70% 지점을 뽑는다.
        const at = posterFrame(spec, voice) / FPS
        ffmpeg(['-y', '-ss', at.toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '3', poster])
        posters++
      }
      const def = FORMATS[format]
      formats[format] = {
        file: `${format}/${spec.id}.mp4`,
        poster: posterRel,
        bytes: fs.statSync(mp4).size,
        width: def.width,
        height: def.height,
      }
    }

    // **규격이 하나도 없으면 manifest 에 넣지 않는다.** 빈 항목을 넣으면 앱이
    // "영상이 있다" 고 믿고 빈 플레이어를 그린다 — 드레인 규칙과 같은 이유다.
    if (Object.keys(formats).length === 0) continue

    videos.push({
      id: spec.id,
      kind: spec.kind,
      title: spec.title,
      subtitle: spec.subtitle,
      seconds,
      captions: `${spec.id}.vtt`,
      formats,
    })
  }

  const prior = fs.existsSync(MANIFEST)
    ? (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest)
    : null

  const manifest: Manifest = {
    builtAt: new Date().toISOString(),
    // 이미 발행해 둔 기준 URL 이 있으면 지키고, 없으면 null 로 둔다.
    baseUrl: prior?.baseUrl ?? null,
    videos,
  }
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`OK manifest ${videos.length}편 · 포스터 새로 ${posters}장` +
    (missing > 0 ? ` · 아직 안 찍은 규격 ${missing}개` : ''))
  console.log(`   ${path.relative(process.cwd(), MANIFEST)}`)
  console.log(`   자막·설명 → ${path.relative(process.cwd(), DIST)}`)
  if (!manifest.baseUrl) {
    console.log('   ⚠ baseUrl 이 없다 — 발행 전이라 앱은 아직 플레이어를 그리지 않는다')
  }
}

main()
