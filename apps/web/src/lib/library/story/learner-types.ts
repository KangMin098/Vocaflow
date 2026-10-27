// apps/web/src/lib/library/story/learner-types.ts
//
// LCP Story S5 — 학습자 서가 · 판본 독서의 공유 계약(타입만 · 서버/클라이언트 공용 · 런타임 코드 없음).
// 계약 정본: docs/LCP_STORY.md §12 · §13 · §15 · §17. DB 정본: S3 `20261025094450_lcp_story_s3_schema.sql` 의 학습자 RPC 5개
// + S5 제안(미적용) `public.story_reader_context(p_release_key, p_unit_index) returns jsonb`.
//
// - 이 파일의 값은 서버(lib/library/story/learner.ts)가 RPC 응답을 런타임으로 검사해 만든 것만 담는다(형 변환 단언 없음).
// - 클라이언트로 가는 모양에는 내부 UUID · 해시 · 권리 · 판본 artifact · 활동 · 정답 · 검수 · 원문 전문 · 다른 사용자 신원이 없다.
//   예외 하나: `viewerId` = 서버가 쿠키 세션 getUser 로 확인한 **그 요청의 본인 uid**. 개인 화면 상태(SSR 첫 내용 · 액션 결과)를
//   본인에게 결속하는 용도로만 쓴다 — 클라이언트는 자기 인증 상태(onAuthStateChange)의 uid 와 다르면 내용을 버린다.
//   이벤트 속성 · URL · 로그에는 싣지 않는다(D3). 서버는 클라이언트가 보낸 uid 를 권한 근거로 받지 않는다.
// - 진도는 발행본(release_key)별이다. 위치(last/furthest)는 이동 기록이고 완료가 아니다. 각색 완독(adapted_full_work)은 원문 완독이 아니다.

export type StoryKind = 'story_edition' | 'easy_reader'
/** 판본 범위 — 발행본 기준. */
export type StoryCoverage = 'complete_work' | 'episode' | 'excerpt'
/** 원천 스냅숏 범위. */
export type StorySourceCoverage = 'complete_work' | 'excerpt'
export type StoryCompletionLabel = 'adapted_full_work' | 'adapted_partial'

/** `story_catalog()` 한 행(이용 가능한 발행본의 메타 · 진입 장면만 — 본문 없음). anon 도 읽는다. */
export interface StoryCatalogRelease {
  releaseKey: string
  workKey: string
  editionKey: string
  kind: StoryKind
  coverage: StoryCoverage
  completionLabel: StoryCompletionLabel
  title: string
  /** 스포일러 없는 진입 장면(HOOK). */
  hookText: string
  unitCount: number
  /** 편집 목표 CEFR(실측 아님) — 없으면 null. */
  targetCefr: string | null
  publishedAt: string
}

/** 편집 판단 등급(실측 아님). */
export type StoryGuidanceLevel = 'low' | 'moderate' | 'high'

/**
 * `story_release_guidance` 한 행 — 발행본이 가리키는 불변 판본 자리의 편집 목표(production.target)에서 시작 전 선택에 필요한 것만.
 * 모두 편집 판단 · 목표이며 실측 · 진단이 아니다. 줄거리 설명(note) · 목표(goals) · 배경 지원 의도(supports)는 싣지 않는다.
 */
export interface StoryReleaseGuidance {
  releaseKey: string
  /** 편집 목표 CEFR — 서가 행의 targetCefr 와 같아야 한다(다르면 결속 불일치로 버린다). */
  targetCefr: string
  /** 사고 · 추론 요구(편집 판단). */
  cognitiveDemand: StoryGuidanceLevel
  /** 배경지식 부담(편집 판단). */
  backgroundLoad: StoryGuidanceLevel
  /** 검수된 저장 주의 문장 그대로(순서 보존). 빈 배열 = 저장된 주의 없음 — 화면은 경고를 만들지 않는다. */
  cautions: string[]
}

/**
 * 선택 안내 조회 결과. 「불러오지 못함」(함수 없음 · 일시 오류 · 결속/모양 불일치)은 「주의 없음」이 아니다.
 * ready 의 byRelease 에 없는 발행본도 「불러오지 못함」으로 다룬다(조회 사이 철회 등).
 */
export type StoryGuidanceState =
  | { status: 'ready'; byRelease: Readonly<Record<string, StoryReleaseGuidance>> }
  | { status: 'unavailable'; reason: StoryGuidanceUnavailableReason }

/** not_ready = 이 환경에 안내 RPC 가 없다(SQL 미적용) · invalid = 결속 · 모양 불일치 · temporary = 일시 오류. */
export type StoryGuidanceUnavailableReason = 'not_ready' | 'invalid' | 'temporary'

/** 발행본 하나의 안내(화면 입력). */
export type StoryReleaseGuidanceView =
  | { status: 'ready'; guidance: StoryReleaseGuidance }
  | { status: 'unavailable'; reason: StoryGuidanceUnavailableReason }

/**
 * 단위 하나의 시대적 맥락 설명(T-0189 W2 · `story_unit_context_notes`) — 편집 기준이 「맥락과 함께 남김」으로 정한 민감 표현에 붙인
 * 검수된 설명만. id = 판본 change_id · text = 저장된 learner_note 그대로(다듬지 않는다).
 */
export interface StoryContextNote {
  id: string
  text: string
}

/**
 * 단위 화면의 맥락 설명 조회 결과. ready 는 어느 발행 키 · 단위의 결과인지 함께 가진다(화면이 지금 단위와 다시 대조한다).
 * notes 가 빈 배열 = 이 단위에 설명 없음. 「불러오지 못함 · 확인하지 못함」(unavailable)은 「설명 없음」이 아니다.
 */
export type StoryContextNotesView =
  | { status: 'ready'; releaseKey: string; unitIndex: number; notes: StoryContextNote[] }
  | { status: 'unavailable'; reason: StoryGuidanceUnavailableReason }

/** `story_my_progress()` 한 행 — 이 학습자 것만. 철회 · 권리 보류된 발행본도 이력으로 남는다(releaseAvailable=false). */
export interface StoryProgressRow {
  releaseKey: string
  workKey: string
  editionKey: string
  completionLabel: StoryCompletionLabel
  countsAsWorkCompletion: boolean
  /** DB 가 false 로 고정한다 — 각색 완독은 원문 완독이 아니다. */
  countsAsOriginalTextCompletion: false
  lastUnitIndex: number
  furthestUnitIndex: number
  completedUnitCount: number
  unitCount: number
  completedAt: string | null
  releaseAvailable: boolean
}

/** 원문 앵커 — 저장된 검증 인용 그대로. start/end 는 원문 전문 기준 UTF-16 코드 단위 반열린 구간(메타 · 화면이 다시 자르지 않는다). */
export interface StorySourceAnchor {
  paragraph: number
  start: number
  end: number
  quote: string
}

export interface StoryReaderTocEntry {
  unitIndex: number
  unitTitle: string | null
  /** 이 학습자의 명시적 단위 완료 기록이 있는가. */
  completed: boolean
}

export interface StoryReaderProgress {
  lastUnitIndex: number
  furthestUnitIndex: number
  completedUnitCount: number
  /** 이 발행본의 모든 단위에 완료 기록이 있다(각색 완료 · 원문 완독 아님). */
  completed: boolean
}

/** 출처 표기용 원천 판본 메타(허용 목록). sourceUrl 은 저장값 그대로 — http/https 만 링크로 만든다(화면 책임). */
export interface StoryReaderSource {
  title: string
  author: string | null
  /** 원작 언어(ISO 639). 본문 언어와 다르면 번역본이다. */
  originalLanguage: string
  textLanguage: string
  translator: string | null
  editionLabel: string
  coverage: StorySourceCoverage
  sourceUrl: string | null
}

/** `story_reader_context` 응답을 검사 · 정리한 값(해시 · 내부 id 는 버린다). 본문은 없다(`StoryUnitBody`). */
export interface StoryReaderContext {
  releaseKey: string
  workKey: string
  editionKey: string
  kind: StoryKind
  coverage: StoryCoverage
  completionLabel: StoryCompletionLabel
  countsAsWorkCompletion: boolean
  countsAsOriginalTextCompletion: false
  title: string
  unitCount: number
  progress: StoryReaderProgress | null
  toc: StoryReaderTocEntry[]
  unit: { unitIndex: number; unitTitle: string | null; anchors: StorySourceAnchor[] }
  source: StoryReaderSource
}

/** `story_read_unit` 한 행 — 요청한 그 단위의 본문. */
export interface StoryUnitBody {
  releaseKey: string
  unitIndex: number
  unitCount: number
  unitTitle: string | null
  text: string
}

/** `story_record_position` 결과(이동만 — 완료를 만들지 않는다). */
export interface StoryPositionResult {
  /** 이 요청을 처리한 쿠키 세션 본인 uid(서버 확인값). */
  viewerId: string
  releaseKey: string
  lastUnitIndex: number
  furthestUnitIndex: number
  completedUnitCount: number
  unitCount: number
  completed: boolean
}

/** `story_complete_unit` 결과(단위 하나 · 재호출 안전). completed = 발행본 전 단위 완료. */
export interface StoryUnitCompletionResult {
  /** 이 요청을 처리한 쿠키 세션 본인 uid(서버 확인값). */
  viewerId: string
  releaseKey: string
  unitIndex: number
  completedUnitCount: number
  unitCount: number
  completed: boolean
  completionLabel: StoryCompletionLabel
}

/** 위치 기록의 계기 — 명시적 사용자 행동만(화면 렌더 · GET · 프리페치는 기록하지 않는다). */
export type StoryPositionReason = 'start' | 'resume' | 'navigate'

/**
 * 저장 액션 입력. `expectedViewerId` = 화면이 그려진 서버 확인 본인 uid(`ready.viewerId`) — **전제 조건일 뿐 권한이 아니다.**
 * 서버는 실제 쿠키 세션 getUser + 계정 상태를 확인한 뒤 그 uid 와 정확히 같을 때만 읽기 문맥 확인 · 저장을 한다
 * (다르면 `viewer_changed` · 어떤 개인 RPC 도 부르지 않는다). RPC 의 사용자 선택은 언제나 DB 의 auth.uid() 다.
 */
export interface StoryPositionInput {
  releaseKey: string
  unitIndex: number
  reason: StoryPositionReason
  expectedViewerId: string
}

export interface StoryCompleteInput {
  releaseKey: string
  unitIndex: number
  expectedViewerId: string
}

export type StoryLearnerFailureCode =
  /** 로그인 필요(쿠키 세션 없음). */
  | 'auth_required'
  /** suspended · deleted 계정. */
  | 'account_blocked'
  /** 미발행 · 철회 · 권리 보류 · 없는 키(구분하지 않는다). */
  | 'release_unavailable'
  | 'unit_not_found'
  /** 읽기 문맥 RPC 가 이 환경에 없다(S5 SQL 미적용) — 꾸민 목차 · 앵커 · 진도로 대신하지 않는다. */
  | 'reader_not_ready'
  /** DB 저장값 결속 불일치(story:reader_context_mismatch) 또는 응답 모양이 계약과 다름. */
  | 'reader_data_invalid'
  /** 입력(release_key 형식 · 단위 번호) 거부 — RPC 를 부르지 않았다. */
  | 'invalid_input'
  /** 저장 요청의 전제(그려진 화면의 본인)와 지금 쿠키 세션 사용자가 다르다 — 아무것도 쓰지 않았다. 화면을 다시 불러온다. */
  | 'viewer_changed'
  /** 일시 오류(네트워크 · DB) — 다시 시도할 수 있다. */
  | 'temporary'

export interface StoryLearnerFailure {
  ok: false
  code: StoryLearnerFailureCode
  /** 학습자에게 보일 한국어 한 줄(내부 RPC · 해시 용어 없음). */
  message: string
  retryable: boolean
}

export type StoryLearnerResult<T> = { ok: true; data: T } | StoryLearnerFailure

/** 서가 화면(`/library/stories`)의 서버 판정. 실패를 빈 서가로 바꾸지 않는다. */
export type StoryCatalogPageState =
  | {
      status: 'ready'
      signedIn: boolean
      /** 로그인했으면 서버가 확인한 본인 uid, 아니면 null — progress 를 본인에게 결속한다. */
      viewerId: string | null
      releases: StoryCatalogRelease[]
      /** 로그인했을 때만 · 이 학습자 것만. 진도 조회가 실패하면 null + progressError(서가는 그대로). */
      progress: StoryProgressRow[] | null
      progressError: StoryLearnerFailure | null
      /** 시작 전 선택 안내(공개 · 로그인과 무관). 실패해도 서가는 그대로다. */
      guidance: StoryGuidanceState
    }
  | { status: 'error'; failure: StoryLearnerFailure }

/** 독서 화면(`/library/stories/[releaseKey]?unit=N`)의 서버 판정. 로그인 · 차단 판정 전에는 본문 · 목차 · 앵커를 싣지 않는다. */
export type StoryReaderPageState =
  | {
      status: 'signed_out'
      /** 지원되는 로그인 복귀 URL(`loginUrlWithReturn`). */
      loginHref: string
      /** 공개 서가 메타(있으면) — 본문 없음. */
      release: StoryCatalogRelease | null
      /** 이 발행본의 시작 전 선택 안내(release 가 null 이면 unavailable). */
      guidance: StoryReleaseGuidanceView
    }
  | { status: 'blocked' }
  | { status: 'unavailable'; failure: StoryLearnerFailure }
  | {
      status: 'ready'
      /** 서버가 쿠키 세션으로 확인한 본인 uid — 이 상태의 진도 · 본문은 이 사용자 것이다. */
      viewerId: string
      context: StoryReaderContext
      /**
       * 이 발행본의 서가 메타(HOOK · 편집 목표 CEFR 등 — 시작 전에 보인다). 서가 조회가 **실패**하면 null 이다
       * (그때는 「HOOK 없음」이 아니라 「정보를 불러오지 못함」으로 보인다). 서가 조회는 성공했는데 이 발행본이 없으면
       * (본문을 읽은 사이 철회 · 권리 보류) ready 가 아니라 unavailable 로 닫는다 — 이전 본문을 보이지 않는다.
       */
      release: StoryCatalogRelease | null
      /** `?unit=` 이 없으면(작품 입구) null — 본문을 읽지 않고 목차 · 진도 · 다음 행동만 보인다. */
      unit: StoryUnitBody | null
      /** 같은 작품의 다른 발행본(이용 가능한 것만 · 서가 메타 · 자기 자신 제외). 진도는 각자 따로다.
       *  서가 조회가 실패하면 null(「다른 판본 없음」과 구분한다 — 실패를 빈 목록으로 바꾸지 않는다). */
      siblings: StoryCatalogRelease[] | null
      /** 이 발행본의 시작 전 선택 안내(입구에서 보인다). 실패해도 독서는 그대로다. */
      guidance: StoryReleaseGuidanceView
      /** 단위 화면(`?unit=`)의 시대적 맥락 설명. 작품 입구에서는 부르지 않아 null 이다. 실패해도 본문 · 진도는 그대로다. */
      contextNotes: StoryContextNotesView | null
    }
