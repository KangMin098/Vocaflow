// packages/video-factory/src/index.ts
//
// 패키지 바깥(앱·스크립트)이 쓰는 것만 내보낸다. Remotion 컴포넌트는 내보내지 않는다 —
// 앱이 그것을 import 하면 Next 번들에 헤드리스 렌더러가 딸려 들어간다.
export * from './spec'
export * from './catalog/bundle'
export { buildSpecs, countByKind } from './catalog/build'
export { specDuration } from './remotion/VideoComposition'
