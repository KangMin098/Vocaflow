/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // 도서 원천 표지 이미지 (next/image 서버 캐시·webp·리사이즈). 핫링크 회피 + 최적화.
  //   - Project Gutenberg: pg{id}.cover.medium.jpg
  //   - Standard Ebooks: og:image (CC0)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.gutenberg.org' },
      { protocol: 'https', hostname: 'standardebooks.org' },
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
