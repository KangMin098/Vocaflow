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
          '**/.next/**',
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

export default nextConfig
