// apps/web/next.config.mjs
import fs from 'node:fs'
import path from 'node:path'
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js'

// ══════════════════════════════════════════════════════════════════
// distDir 소유권 — dev 서버가 쓰는 디렉터리를 빌드가 지우지 못하게 한다
// ══════════════════════════════════════════════════════════════════
// 2026-08-30 실측 사고: `next dev` 가 뜬 채로 다른 세션이 `npx next build` 를
// 돌렸다. 빌드가 `.next/static` 을 비우는데 dev 서버의 매니페스트는 이미 낸
// 청크를 계속 가리켜서 `/_next/static/css/app/layout.css` 가 404 →
// **모든 화면이 CSS 없이** 렌더됐다(sr-only 텍스트·아이콘 대체 문자까지 노출).
// dev 서버는 살아 있고 HTML 은 정상이라 "스타일만 안 먹는다" 로 보여 원인이 안 보인다.
//
// 규약(NEXT_DIST_DIR)만으로는 못 막는다 — 규약을 모르는 `npx next build` 한 줄이면
// 재현된다. 그래서 두 겹으로 막는다:
//   ① dev 는 기본값부터 `.next-dev` — 빌드가 지우는 `.next` 와 애초에 겹치지 않는다.
//   ② 빌드는 대상 distDir 에 살아 있는 dev 서버의 소유권 표식이 있으면 즉시 실패한다.
const OWNER_FILE = '.dev-server-owner.json'
/** 표식을 stale 로 볼 시간. dev 서버가 60초마다 touch 하므로 그 3배. */
const OWNER_STALE_MS = 3 * 60_000

function ownerPath(distDir) {
  return path.join(process.cwd(), distDir, OWNER_FILE)
}

/**
 * dev 서버가 자기 distDir 에 소유권을 남기고, 죽을 때 지운다.
 *
 * `next dev` 는 부모(CLI)와 자식(start-server) **두 프로세스**가 각각 이 설정을 읽는다.
 * 그래서 ① 표식은 마지막에 쓴 쪽 PID 를 갖고 ② 지울 때는 **내 PID 로 적힌 것만** 지운다
 * (부모가 먼저 끝나며 자식의 표식을 지워 보호가 조용히 풀리는 것을 막는다).
 * heartbeat 도 touch 가 아니라 다시 쓰기다 — 표식이 사라졌으면 스스로 되살린다.
 */
function claimDistDir(distDir) {
  const file = ownerPath(distDir)
  const stamp = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(
      file,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), cwd: process.cwd() }, null, 2),
    )
  }
  try {
    stamp()
  } catch {
    return // 표식을 못 써도 dev 는 떠야 한다 — 보호가 약해질 뿐이다
  }
  // PID 재사용으로 죽은 표식이 살아 있는 것처럼 보이는 것을 막는 heartbeat.
  // unref — 이 타이머가 프로세스를 붙잡아 두면 안 된다.
  const beat = setInterval(() => {
    try {
      stamp()
    } catch {
      /* 다음 박동에 다시 시도한다 */
    }
  }, 60_000)
  beat.unref?.()
  const drop = () => {
    try {
      const cur = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (cur?.pid === process.pid) fs.rmSync(file, { force: true })
    } catch {
      /* 없거나 남의 것이다 — 건드리지 않는다 */
    }
  }
  process.once('exit', drop)
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.once(sig, () => {
      drop()
      process.exit(0)
    })
  }
}

/** 빌드가 지우려는 distDir 을 살아 있는 dev 서버가 쓰고 있으면 던진다. */
function assertDistDirFree(distDir) {
  if (process.env.NEXT_ALLOW_DIST_CLOBBER === '1') return
  let owner
  let touchedAt
  try {
    const file = ownerPath(distDir)
    owner = JSON.parse(fs.readFileSync(file, 'utf8'))
    touchedAt = fs.statSync(file).mtimeMs
  } catch {
    return // 표식이 없다 = 아무도 안 쓴다
  }
  if (!owner?.pid || owner.pid === process.pid) return
  if (Date.now() - touchedAt > OWNER_STALE_MS) return // heartbeat 끊긴 유령 표식
  try {
    process.kill(owner.pid, 0) // 살아 있는지만 본다 — 시그널을 보내지 않는다
  } catch {
    return // 죽은 PID
  }
  throw new Error(
    [
      '',
      `이 빌드는 dev 서버(PID ${owner.pid}, ${owner.startedAt} 기동)가 쓰는 중인 "${distDir}" 를 지우려 했다.`,
      '그대로 두면 dev 서버는 살아 있는데 정적 자산만 사라져 모든 화면이 CSS 없이 렌더된다.',
      '',
      '  검증 빌드:  NEXT_DIST_DIR=.next-verify pnpm --filter web build',
      '  배포 빌드:  dev 서버를 먼저 종료한 뒤 다시 실행',
      '',
      `표식이 잘못 남은 것이라면 ${path.join(distDir, OWNER_FILE)} 를 지운다.`,
      '',
    ].join('\n'),
  )
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // v06.92 — 프로덕션 빌드 복구: SWC minifier 가 @mintplex-labs/piper-tts-web
  // (onnxruntime-web 번들, EchoMatch)을 parse 못해 `next build` 가
  // "failed to parse input file: Syntax Error" 로 실패. Terser minifier 로 폴백.
  // (기존 main 부터 깨진 상태 — CI 가 typecheck/lint 만 게이트해 미발견.)
  swcMinify: false,
  // v06.92 — 기존 lint 부채(74건)로 `next build` 산출물 생성이 막혀 임시로 lint 를 빌드에서 분리했었음.
  // v06.117 — 부채 청산 완료(`next lint` = 0 error / 6 warning). 빌드-타임 lint 게이트 복원.
  //   build 는 error 만 차단(warning 은 통과) — exhaustive-deps 잔여 6건은 warning 이라 무영향.
  //   typecheck 는 계속 강제 (ignoreBuildErrors 두지 않음).
  eslint: { ignoreDuringBuilds: false },
  // distDir 은 아래 defineConfig 가 phase 별로 채운다 —
  // dev = `.next-dev`(빌드가 지우는 `.next` 와 분리) · build/start = `.next`.
  // NEXT_DIST_DIR 로 언제든 덮어쓸 수 있다(검증 빌드 격리용).
  // Workspace 패키지의 .js extension import (Node ESM 컨벤션) 를
  // Next.js webpack 이 해석하도록 transpilePackages 등록.
  // - @vocaflow/vcb-core: lemma + Supabase admin client
  // - @vocaflow/vcb-curate-core: curation/precheck/publish 비즈니스 로직
  // - @vocaflow/wlp: winkNLP processor + QA rules
  // - @vocaflow/types: DB row 타입
  // - @vocaflow/design-tokens: CSS 변수
  // - @vocaflow/ui-shared: 공유 UI 로직
  transpilePackages: [
    '@vocaflow/vcb-core',
    '@vocaflow/vcb-curate-core',
    '@vocaflow/wlp',
    '@vocaflow/types',
    '@vocaflow/design-tokens',
    '@vocaflow/ui-shared',
  ],
  // 도서 원천 표지/삽화 이미지 (next/image 서버 캐시·webp·리사이즈). 핫링크 회피 + 최적화.
  //   - Project Gutenberg: pg{id}.cover.medium.jpg
  //   - Standard Ebooks: og:image (CC0)
  //   - StoryWeaver(Pratham): 표지·삽화 = GCS 버킷 static.storyweaver.org.in (CC BY 4.0)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.gutenberg.org' },
      { protocol: 'https', hostname: 'standardebooks.org' },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/static.storyweaver.org.in/**',
      },
    ],
  },
  // v06.32 — Windows dev server watchpack 가 시스템 파일 (pagefile/hiberfil/swapfile)
  // lstat 시도 시 EINVAL 발생. node_modules + .next + .git + Windows 시스템 파일 제외.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next*/**',
          'C:/pagefile.sys',
          'C:/hiberfil.sys',
          'C:/swapfile.sys',
          'C:/DumpStack.log.tmp',
        ],
      }
      // Windows dev 안정화 — webpack FS 캐시(.next/cache/**/*.pack.gz)의 rename 이
      // 백신 파일락/디스크 압박으로 간헐 실패(ENOENT) → vendor-chunks 손상 → 라우트 404/500·서버 사망.
      // Windows 한정으로 메모리 캐시 전환해 pack.gz 쓰기 자체를 제거(cold-start 소폭 느려지나 손상 근절).
      // (mac/linux 는 FS 캐시 유지 — 문제없고 재시작 캐시가 더 빠름.)
      if (process.platform === 'win32') config.cache = { type: 'memory' }
    }
    return config
  },
}

/**
 * phase 별 distDir 결정 + 소유권 처리.
 * dev 가 `.next` 를 안 쓰므로, 규약을 모르는 `npx next build` 가 돌아도 dev 서버는 멀쩡하다.
 */
export default (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  const distDir = process.env.NEXT_DIST_DIR || (isDev ? '.next-dev' : '.next')
  if (isDev) claimDistDir(distDir)
  else if (phase === PHASE_PRODUCTION_BUILD) assertDistDirFree(distDir)
  return { ...nextConfig, distDir }
}
