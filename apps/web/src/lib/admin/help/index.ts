// apps/web/src/lib/admin/help/index.ts
//
// 관리자 화면도움말 레지스트리 — 파이프라인별 파일을 병합한다.
//
// **파일을 파이프라인별로 나눈 이유**: 한 파일에 몰면 파이프라인을 동시에 손볼 때
// 매번 충돌한다. 소유권을 파이프라인 팀(=그 화면을 고치는 사람)에 두는 편이
// 도움말이 코드와 함께 갱신될 확률을 높인다.
//
// ⚠️ 화면·기능·로직·프로세스를 바꾸면 **같은 커밋에서** 해당 파일의 도움말도 고친다.
//    (루트 CLAUDE.md §자동화 정책 의 .md 자동 갱신 매트릭스에 명문화돼 있다.)
//
// 키는 라우트 슬러그다. 탭이 있는 화면은 `tabs` 에 **화면에 보이는 라벨 그대로** 넣는다
// — AdminScreenHelp 가 그 문자열로 조회하므로 라벨을 바꾸면 여기도 바꿔야 한다.

import type { HelpRegistry } from './types'

import { ACP_HELP } from './articles'
import { CCP_HELP } from './comic'
import { LCP_HELP } from './curation'
import { OPS_HELP } from './ops'
import { PDCP_HELP } from './pd-comics'
import { QUALITY_HELP } from './quality'
import { VCB_HELP } from './vocab'
import { VRL_HELP } from './vrl'

export const HELP_REGISTRY: HelpRegistry = {
  ...ACP_HELP,
  ...LCP_HELP,
  ...CCP_HELP,
  ...PDCP_HELP,
  ...VCB_HELP,
  ...VRL_HELP,
  ...QUALITY_HELP,
  ...OPS_HELP,
}

export type { ScreenHelp, ScreenHelpEntry, HelpRegistry } from './types'
