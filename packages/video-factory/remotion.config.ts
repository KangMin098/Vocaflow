// packages/video-factory/remotion.config.ts
//
// 렌더 기본값. **품질 관련 값은 여기 한 곳에서만 정한다** — 컴포지션마다 적으면 갈린다.
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setOverwriteOutput(true)
Config.setChromiumOpenGlRenderer('angle')
