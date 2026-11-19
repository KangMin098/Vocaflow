// apps/web/src/lib/learner/article-practice-copy.ts
// R0 같은 기사 연습 — loader 실패 사유별 문구(/practice/article/[articleId]).

import type { ArticlePracticeLoad } from './article-practice-actions'

type Reason = Extract<ArticlePracticeLoad, { ok: false }>['reason']

/** 사유 → 학습자에게 하는 말. 사유를 섞지 않는다(설치 대기 ≠ 문항 없음 ≠ 조회 실패). */
export const ARTICLE_PRACTICE_REASON: Record<Reason, string> = {
  bad_article: '연습할 글 주소가 올바르지 않아요.',
  signed_out: '로그인한 뒤 글을 열어 주세요.',
  blocked_account: '지금 계정으로는 연습할 수 없어요.',
  not_opened: '이 글을 먼저 열어 읽은 뒤에 연습할 수 있어요.',
  stale_copy: '글 내용이 바뀌었어요. 글을 다시 연 뒤에 연습해 주세요.',
  lookup_failed: '글 정보를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  not_installed: '이 연습은 아직 준비 중이에요.',
  query_failed: '연습 문항을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  no_items: '이 글에는 아직 준비된 연습이 없어요.',
}
