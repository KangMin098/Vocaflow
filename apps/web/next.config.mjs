/** @type {import('next').NextConfig} */
const nextConfig = {
  // v06.92 — 프로덕션 빌드 복구: SWC minifier 가 @mintplex-labs/piper-tts-web
  // (onnxruntime-web 번들, EchoMatch)을 parse 못해 `next build` 가
  // "failed to parse input file: Syntax Error" 로 실패. Terser minifier 로 폴백.
  // (기존 main 부터 깨진 상태 — CI 가 typecheck/lint 만 게이트해 미발견.)
  swcMinify: false,
  // v06.92 — 전(全)프로젝트 기존 lint 부채(74건: no-explicit-any 32·no-unused-vars 28·
  // no-unescaped-entities 12·exhaustive-deps 6)가 `next build` 의 산출물 생성을 막음.
  // lint 는 `next lint`(dev/CI 별도 job)로 분리하고 빌드는 아티팩트 생성에 집중.
  // typecheck 는 build 에서 계속 강제 (tsc 통과 상태 — ignoreBuildErrors 는 두지 않음).
  eslint: { ignoreDuringBuilds: true },
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
    }
    return config
  },
}

export default nextConfig
