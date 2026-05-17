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
}

export default nextConfig
