// apps/web/src/lib/csat/content-review/types.ts
//
// **기출분석 콘텐츠 검수 — 공통 계약(F1~F8).** 후보·판본 결속·상태·승인·원장이 이 모양 하나를 쓴다.
//
// 원칙(대량작업 F §3·§4):
// - 이 모듈은 **DB 를 쓰지 않는다.** 검수 화면의 상태 변경은 시연 원장(브라우저)에만 남는다.
// - **공식 정답(official_answer)과 교육적 해설(explanation)의 승인은 별개 트랙**이다. 하나가 승인돼도 다른 쪽은 그대로다.
// - **AI 합의는 증거이지 승인이 아니다.** `ai_consensus` 증거만으로는 어떤 트랙도 content_approved 가 되지 않는다.
// - 출제 의도는 `intent_claim` 이 공식 근거(official_*)를 가질 때만 사실로, 아니면 가설로 표시한다.
// - 정답은 **집합**이다(2015#25 = {4,5}). 단일 숫자로 줄이지 않는다.
// ⚠️ `@/` 별칭을 쓰지 않는다 — 스냅샷 빌드 스크립트(tsx)가 그대로 import 한다.

/** 판본 결속 — 후보가 「무엇을 보고」 만들어졌는지. 하나라도 지금 값과 다르면 후보는 stale 이다. */
export interface RevisionBinding {
  itemId: string
  /** csat_items 행(passage·choices·answer)의 md5 — C 인계표의 item md5 */
  itemMd5: string
  /** 최신 published 분석 버전과 그 본문 md5 */
  analysisVersion: number
  analysisMd5: string
  /** 강의 판본 — lecture-data/<exam>.json 안 그 문항의 version 과 canonical sha256 앞 16자 */
  lectureVersion: number | null
  lectureHash: string | null
}

export type CandidateSource =
  | 'C_HANDOFF_30' // 대량작업 C 감수 인계표
  | 'C_HOLD' // 인계 밖 보류(REVIEW_REQUIRED)
  | 'DRAIN_MULTI_ANSWER' // drain 후속 F3 — 2015#25 복수정답
  | 'E_T0149_GOLD' // 대량작업 E 결정 근거 gold(AI 이중 판정 교집합)

/** 결함 묶음 — 검수자가 무엇을 판정하는지 */
export type DefectKind =
  | 'false_elimination' // 사실과 다른 소거
  | 'false_trap' // 사실과 다른 함정 설명
  | 'emphasis_binding' // 35번 강조 결속
  | 'overgeneralized_rule' // 정리 규칙 과잉 일반화
  | 'explanation_error' // 개별 설명 오류
  | 'extraction_error' // 추출 오류 → 판정 보류
  | 'official_answer_conflict' // 공식 정답과 해설·강의 충돌
  | 'evidence_gold' // 결정 근거 gold 수용 여부

/** 검수 트랙. 같은 후보라도 트랙마다 따로 승인된다. */
export type ReviewTrack = 'official_answer' | 'explanation' | 'lecture_cue' | 'evidence_gold'

/** 수정 후보 한 건 — cue 또는 분석 블록 하나의 「현재 → 제안」 */
export interface ProposedChange {
  /** 'cue:c9' · 'analysis:reject:5' · 'analysis:answer' · 'gold:decisive' */
  target: string
  current: string
  proposed: string | null
  /** 제안 문안이 나온 파일(연구 브랜치 상대 경로) */
  draftRef: string | null
}

export interface ReviewCandidate {
  /** 결정적 id — `cr_` + sha256(itemId · defect · 정렬된 target · binding)의 앞 16자 */
  id: string
  itemId: string
  source: CandidateSource
  /** 원천 자료 안의 번호(예: 인계표 #, blind W01) */
  sourceRef: string
  defect: DefectKind
  tracks: ReviewTrack[]
  binding: RevisionBinding
  changes: ProposedChange[]
  /** 공식 원문 대조 결과 — C OT1/OT2 */
  officialText: { verdict: 'TEXT_MATCH' | 'TEXT_DIFF' | 'NOT_CHECKED'; note: string | null }
  /** 공식 정답 **집합**. 근거 없으면 null(모름 — 비어 있음과 다르다) */
  officialAnswers: number[] | null
  officialAnswerBasis: 'kice_answer_sheet' | 'press_verified' | 'db_only' | null
  /** 이 후보에 이미 붙은 AI 확인 경로(증거일 뿐, 승인 아님) */
  aiEvidence: string[]
  note: string | null
}

/** F1 결과 — 중복·충돌 관계 */
export interface CandidateRelation {
  kind: 'duplicate' | 'conflict' | 'same_item'
  a: string
  b: string
  reason: string
}

// ── F3 상태 계약 ─────────────────────────────────────────────

export type ReviewState =
  | 'queued' // 검수 대기
  | 'in_review' // 검토 중
  | 'changes_requested' // 수정 요청
  | 'content_approved' // 내용 승인(트랙별)
  | 'publish_pending' // 발행 대기(실제 발행은 이 모듈 밖·별도 승인)
  | 'stale' // 결속 판본이 바뀜 → 재검수 필요
  | 'withdrawn' // 철회(비파괴 — 이력은 남는다)

export type ReviewerKind = 'human' | 'ai'

export interface Reviewer {
  id: string
  kind: ReviewerKind
  /** 사람 검수자의 역할. content_approved 는 이 역할이 있어야 한다. */
  roles: ('content_reviewer' | 'answer_authority' | 'publisher')[]
}

export type EvidenceKind =
  | 'official_pdf_text' // 공식 문제지 문장 대조
  | 'official_answer_sheet' // 평가원 정답표
  | 'press_report' // 보도(1차 원문 아님)
  | 'analysis_revision' // 분석 판본 본문
  | 'lecture_cue' // 강의 cue 본문
  | 'ai_consensus' // AI 교차·이중 판정 — **승인 근거가 아니다**
  | 'reviewer_note'

export interface Evidence {
  kind: EvidenceKind
  ref: string
  /** 증거가 묶인 판본 해시(없으면 결속 안 됨) */
  boundHash: string | null
}

/** 원장 한 줄 — append-only. 지우지 않고 뒤에 덧붙여 상태를 바꾼다(F8). */
export interface LedgerEntry {
  seq: number
  candidateId: string
  track: ReviewTrack
  from: ReviewState
  to: ReviewState
  by: Reviewer
  /** 이 결정이 묶인 판본 — 승인 시 후보 binding 과 같아야 한다 */
  binding: RevisionBinding
  evidence: Evidence[]
  reason: string
  at: string
  /** 되돌림이면 무엇을 되돌리는지 */
  revertsSeq?: number
}
