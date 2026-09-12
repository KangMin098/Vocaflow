// packages/video-factory/src/render/prestudio.mts
//
// 스튜디오를 열기 전에 번들이 import 할 파일을 보장한다 — 없으면 스튜디오가
// "모듈을 찾을 수 없다" 로 뜨는데, 진짜 원인은 원료를 안 뽑은 것이다.
import { ensureWorkFiles } from './ensure'
ensureWorkFiles()
console.log('OK 원료·음성 manifest 확인')
