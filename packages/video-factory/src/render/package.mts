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

import { loadBundle } from '../catalog/bundle'
import { allSpecs } from '../requests/store'
import { FPS, FORMATS, type FormatId } from '../spec/format'
import { applyVoiceTiming } from '../voice/timing'
import { loadVoiceManifest } from '../voice/edge-tts'
import { specDuration } from '../remotion/VideoComposition'
import { posterFrame, toDescription, toWebVtt } from './captions'
import { advance } from '../jobs/client'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '../..')
const OUT = path.join(PKG, 'out')
const DIST = path.join(PKG, 'dist-media')
const MANIFEST = path.resolve(PKG, '../../apps/web/src/lib/video/manifest.json')
const YOUTUBE = path.join(DIST, 'youtube.json')

/**
 * YouTube 태그 — **종류에서 파생시킨다.**
 *
 * 손으로 적으면 62편이 제각각이 되고, 그러면 검색에서 한 채널로 안 묶인다.
 * 자유 문자열을 허용하지 않는 것은 계측 계약(`analytics/events.ts`)과 같은 이유다.
 */
const KIND_TAG: Record<string, string> = {
  intro: '영어학습',
  benefit: '영어공부법',
  curriculum: '영어커리큘럼',
  series: '영어교재',
  type: '수능영어',
  module: '영단어암기',
}

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
  /**
   * 컷별 자막 전문. **왜 manifest 에 싣나:**
   *   편별 페이지가 이걸 **서버 렌더 HTML** 로 내야 검색이 읽을 것이 생긴다(I6).
   *   버킷의 .vtt 를 매 요청마다 가져오면 지연이 붙고, 크롤러는 그 요청을 안 기다린다.
   *   62편 × 여덟 줄이라 파일이 커지지 않는다.
   */
  transcript: string[]
  /**
   * 화면에 나온 수치와 그 출처. 설명란에도 들어가지만 여기 따로 싣는 이유는
   * **낡음 판정**이다 — 지금 DB 값과 비교하면 "이 영상이 말하는 수가 얼마나 묵었나" 가 나온다.
   */
  evidence: { label: string; value: string; source: string }[]
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

async function main(): Promise<void> {
  const specs = allSpecs(loadBundle()).map((s) => applyVoiceTiming(s, loadVoiceManifest(s.id)))
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
      // 자막이 비어 있는 컷은 넣지 않는다 — 여는·닫는 컷은 큰 글씨가 자막을 대신한다.
      transcript: spec.scenes.map((sc) => sc.caption.trim()).filter((c) => c.length > 0),
      evidence: spec.evidence.map((e) => ({ ...e })),
      formats,
    })
  }

  // ── YouTube 업로드 명세 ────────────────────────────────────────
  //
  // 채널을 만들 때 손으로 62번 제목·설명을 적지 않게 한다. 값은 전부 설계도에서 오므로
  // 영상이 늘면 이 파일도 같이 는다.
  //
  // 정사각은 여기 넣지 않는다 — YouTube 에 올릴 규격이 아니다(피드 광고용).
  const youtube = videos.map((v) => {
    const spec = specs.find((s) => s.id === v.id)!
    return {
      id: v.id,
      // 제목을 지어내지 않는다 — 구성요소의 실제 이름 + 브랜드. 낚시 문구는 Calm UI 위반이다.
      title: `${v.title} — Vocaflow`,
      description: fs.readFileSync(path.join(DIST, `${v.id}.txt`), 'utf8'),
      tags: ['Vocaflow', KIND_TAG[v.kind] ?? '영어학습', v.title],
      captions: `${v.id}.vtt`,
      thumbnail: `thumb/${v.id}.jpg`,
      video: v.formats.wide ? `../out/${v.formats.wide.file}` : null,
      shorts: v.formats.vertical ? `../out/${v.formats.vertical.file}` : null,
      seconds: v.seconds,
      /** 설명란에 이미 들어 있지만, 검수할 때 한눈에 보라고 따로 싣는다. */
      evidence: spec.evidence.map((e) => `${e.label} ${e.value} — ${e.source}`),
    }
  })
  fs.writeFileSync(YOUTUBE, JSON.stringify(youtube, null, 2) + '\n', 'utf8')

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

  // 큐에 단계를 남긴다 — 파일이 아니라 기록이 진행을 말해야 파이프라인이다.
  for (const v of videos) {
    await advance(v.id, v.kind, 'packaged', {
      seconds: v.seconds,
      bytes: Object.values(v.formats).reduce((n, f) => n + (f?.bytes ?? 0), 0),
      captions: v.transcript.length > 0,
      thumb: fs.existsSync(path.join(DIST, 'thumb', `${v.id}.jpg`)),
    })
  }

  console.log(`OK manifest ${videos.length}편 · 포스터 새로 ${posters}장` +
    (missing > 0 ? ` · 아직 안 찍은 규격 ${missing}개` : ''))
  console.log(`   ${path.relative(process.cwd(), MANIFEST)}`)
  console.log(`   자막·설명 → ${path.relative(process.cwd(), DIST)}`)
  const thumbs = youtube.filter((y) => fs.existsSync(path.join(DIST, y.thumbnail))).length
  console.log(
    `   YouTube 명세 ${youtube.length}편 → ${path.relative(process.cwd(), YOUTUBE)}` +
      (thumbs < youtube.length ? `  ⚠ 썸네일 ${thumbs}/${youtube.length} — video thumbs 를 돌린다` : ''),
  )
  if (!manifest.baseUrl) {
    console.log('   ⚠ baseUrl 이 없다 — 발행 전이라 앱은 아직 플레이어를 그리지 않는다')
  }
}

await main()
