// apps/web/src/lib/srs/flush-types.ts
// 세션 종료 flush 의 클라이언트 ↔ 서버 공유 타입.
// ('use server' / 'use client' 디렉티브 파일에서 타입만 import 하기 위한 중립 모듈.)

/** flush 서버 액션 입력 1건 — 평가된 단어 + FSRS grade. */
export interface FlushItem {
  /** 평가된 단어 (vocabularies lookup key). */
  word: string;
  /** FSRS 1~4. */
  rating: number;
  /** ISO timestamp. */
  reviewedAt: string;
  /** learning_records.module enum 값. */
  module: string;
}

export type FlushResult =
  | {
      ok: true;
      persisted: number;
      skipped: number;
      /**
       * 이미 DB 에 있어 건너뛴 건수 — **재전송이 정상 동작임을 드러내는 값**이다.
       * 0 이 아니라고 결함이 아니다(탭을 닫으며 보낸 flush 는 응답을 못 받으므로
       * 같은 큐가 다시 올 수 있다). 이 값이 계속 크면 큐를 비우는 쪽이 고장 난 것이다.
       */
      duplicated: number;
    }
  | { ok: false; error: string };
