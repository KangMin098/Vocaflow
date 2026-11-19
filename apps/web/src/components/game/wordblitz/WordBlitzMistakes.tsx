// apps/web/src/components/game/wordblitz/WordBlitzMistakes.tsx
//
// 끝화면 부록 — 이번 판에서 놓친 단어를 "당시 질문 · 내 선택 · 정답" 으로 나란히 대조한다.
//
// 이 화면은 보여 주기만 한다. 고르기·이동·닫기는 점수·콤보·재출제·FSRS·기록 콜백 어느 것도
// 부르지 않는다 — 펼쳐 본 것을 이해·숙달의 증거로 세지 않기 위해서다(새 제출·기록·TTS 없음).
// 상태는 현재 판의 메모리뿐이다. 판이 다시 시작되거나 라운드가 remount 되면 함께 사라지고,
// 과거 판을 복원하거나 서버에서 다시 읽지 않는다.
//
// 「대조 닫기」로 상세를 닫으면 초점을 **그때 대조하던 단어의 목록 버튼**으로 한 번 돌려준다 — 닫기 버튼이 사라져
// 초점이 body 로 떨어지면 키보드 학습자는 목록 어디였는지 잃는다. 「다음 단어」로 넘긴 뒤 닫으면 넘어간 그 단어로 간다.
// 단어는 en 으로 찾으므로 부모가 다시 그려도 같은 단어 버튼이고, 목록에서 빠졌으면 아무 데도 옮기지 않는다.

'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import type { Word } from '@/components/game/_shared/gamekit';

/** 프롬프트 형태 — ko: 뜻→단어 / en: 단어→뜻(역방향) / context: 예문 빈칸→단어 */
export type MissForm = 'ko' | 'en' | 'context';

/** 놓친 순간 하나. 한 단어당 처음 놓친 순간만 남기고, 몇 번 놓쳤는지는 따로 센다. */
export interface MissEntry {
  target: Word;
  /** 대신 고른 단어. 시간 초과면 null — 고른 것이 없으므로 무언가를 추정해 채우지 않는다. */
  chosen: Word | null;
  form: MissForm;
  /** 그때 화면에 보였던 질문 그대로(문맥 출제면 빈칸 처리된 예문). */
  prompt: string;
  /** 이번 판에서 이 단어를 놓친 횟수(처음 포함). */
  times: number;
}

/** 오답 하나를 판 기록에 더한다 — en 기준 중복 제거, 처음 놓친 순간 보존. */
export function addMiss(
  prev: MissEntry[],
  miss: Omit<MissEntry, 'times'>,
): MissEntry[] {
  const i = prev.findIndex((m) => m.target.en === miss.target.en);
  if (i < 0) return [...prev, { ...miss, times: 1 }];
  return prev.map((m, j) => (j === i ? { ...m, times: m.times + 1 } : m));
}

const FORM_LABEL: Record<MissForm, string> = {
  ko: '뜻을 보고 단어 고르기',
  en: '단어를 보고 뜻 고르기',
  context: '예문 빈칸에 들어갈 단어 고르기',
};

/** 역방향(en) 출제에서는 선택지가 뜻이었다 — 그때 본 면을 먼저 보여 준다. */
function face(w: Word, form: MissForm): { main: string; sub: string } {
  return form === 'en' ? { main: w.ko, sub: w.en } : { main: w.en, sub: w.ko };
}

export function MistakeCompare({ misses }: { misses: MissEntry[] }) {
  const [open, setOpen] = useState<number | null>(null);
  /** 단어(en) → 목록 버튼 */
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  /** 「대조 닫기」 직후 한 번만 돌려줄 단어(en). 쓰고 나면 비운다 */
  const returnTo = useRef<string | null>(null);
  // 상세가 사라진 바로 그 커밋에서(그리기 전) 옮긴다 — body 에 머무는 프레임이 없게
  useLayoutEffect(() => {
    if (open !== null || returnTo.current === null) return;
    const key = returnTo.current;
    returnTo.current = null;
    itemRefs.current.get(key)?.focus();
  }, [open]);
  if (misses.length === 0) return null;
  const cur = open !== null ? misses[open] : null;

  return (
    <div className="wbz-recap">
      <p className="wbz-recap-title" id="wbz-recap-title">
        이번 판에서 놓친 단어 {misses.length}개
      </p>
      <p className="wbz-mx-lead">단어를 고르면 그때의 질문과 내 선택을 정답과 나란히 볼 수 있어요.</p>
      <ul className="wbz-mx-list" aria-labelledby="wbz-recap-title">
        {misses.map((m, i) => (
          <li key={m.target.en}>
            <button
              ref={(el) => {
                if (el) itemRefs.current.set(m.target.en, el);
                else itemRefs.current.delete(m.target.en);
              }}
              type="button"
              className="wbz-mx-item"
              aria-pressed={open === i}
              aria-controls="wbz-mx-detail"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <b className="wbz-recap-en">{m.target.en}</b>
              <span className="wbz-recap-ko">{m.target.ko}</span>
              {m.times > 1 && <span className="wbz-mx-times">{m.times}번 놓침</span>}
            </button>
          </li>
        ))}
      </ul>

      <div id="wbz-mx-detail" aria-live="polite">
        {cur && open !== null && (
          <section className="wbz-mx-detail" aria-label={`${cur.target.en} 대조`}>
            <p className="wbz-mx-q">
              <span className="wbz-mx-label">
                {cur.times > 1 ? `처음 놓친 질문 · ${FORM_LABEL[cur.form]}` : `당시 질문 · ${FORM_LABEL[cur.form]}`}
              </span>
              <span className="wbz-mx-prompt">{cur.prompt}</span>
            </p>
            <div className="wbz-mx-pair">
              <div className="wbz-mx-side wbz-mx-side--mine">
                <span className="wbz-mx-label">내 선택</span>
                {cur.chosen ? (
                  <>
                    <b className="wbz-mx-main">{face(cur.chosen, cur.form).main}</b>
                    <span className="wbz-mx-sub">{face(cur.chosen, cur.form).sub}</span>
                  </>
                ) : (
                  <b className="wbz-mx-main wbz-mx-none">선택하지 못함 · 시간 초과</b>
                )}
              </div>
              <div className="wbz-mx-side wbz-mx-side--answer">
                <span className="wbz-mx-label">정답</span>
                <b className="wbz-mx-main">{face(cur.target, cur.form).main}</b>
                <span className="wbz-mx-sub">{face(cur.target, cur.form).sub}</span>
                {cur.target.pron && <span className="wbz-recap-pron">{cur.target.pron}</span>}
              </div>
            </div>
            {cur.target.example && (
              <p className="wbz-mx-ex">
                <span className="wbz-mx-label">단어 예문</span>
                <span>{cur.target.example}</span>
              </p>
            )}
            <div className="wbz-mx-nav">
              {misses.length > 1 && (
                <button
                  type="button"
                  className="wbz-mx-btn"
                  onClick={() => setOpen((open + 1) % misses.length)}
                >
                  다음 단어
                </button>
              )}
              <button
                type="button"
                className="wbz-mx-btn"
                onClick={() => {
                  returnTo.current = cur.target.en;
                  setOpen(null);
                }}
              >
                대조 닫기
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export const MISTAKE_STYLES = `
  /* 대조를 펼치면 끝화면이 화면보다 길어진다 — .wbz-root 는 100dvh·overflow:hidden 이라
     WordBlitz 의 끝화면만 자체 스크롤로 통계·한 판 더·나가기에 닿게 한다(공용 GameDone 불변). */
  .wbz-root > .gk-done { min-height: 0; overflow-y: auto; justify-content: safe center; }
  .wbz-mx-lead { margin: 0 0 8px; font-size: 12.5px; color: var(--t3); word-break: keep-all; }
  .wbz-mx-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; max-height: 236px; overflow-y: auto; }
  .wbz-mx-item {
    display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; width: 100%; min-height: 44px; padding: 10px 10px;
    border: 1px solid transparent; border-radius: var(--r-md, 10px); background: transparent; text-align: left; cursor: pointer; font: inherit;
  }
  .wbz-mx-item:hover { background: color-mix(in srgb, var(--t1) 5%, transparent); }
  .wbz-mx-item[aria-pressed='true'] { border-color: var(--bd); background: color-mix(in srgb, var(--t1) 6%, transparent); }
  .wbz-mx-item:focus-visible, .wbz-mx-btn:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; }
  .wbz-mx-times { font-size: 12px; font-weight: 700; color: var(--t3); }
  .wbz-mx-detail { margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--bd); display: flex; flex-direction: column; gap: 10px; }
  .wbz-mx-label { display: block; font-size: 11.5px; font-weight: 800; color: var(--t3); letter-spacing: .04em; word-break: keep-all; }
  .wbz-mx-q { margin: 0; }
  .wbz-mx-prompt { display: block; font-size: 15px; font-weight: 700; color: var(--t1); word-break: keep-all; }
  .wbz-mx-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .wbz-mx-side { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--r-md, 10px); border: 1px solid var(--bd); }
  .wbz-mx-side--mine { border-left: 3px solid var(--danger, #9C3A30); }
  .wbz-mx-side--answer { border-left: 3px solid var(--success, #2E7D5A); }
  .wbz-mx-main { font-size: 15px; font-weight: 800; color: var(--t1); word-break: keep-all; }
  .wbz-mx-none { color: var(--t2); font-weight: 700; }
  .wbz-mx-sub { font-size: 13px; color: var(--t2); word-break: keep-all; }
  .wbz-mx-ex { margin: 0; font-size: 13.5px; color: var(--t2); }
  .wbz-mx-nav { display: flex; gap: 8px; justify-content: flex-end; }
  .wbz-mx-btn {
    min-height: 44px; padding: 0 14px; border-radius: var(--r-md, 10px); border: 1px solid var(--bd);
    background: var(--bg); color: var(--t1); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer;
  }
  .wbz-mx-btn:hover { background: var(--bg2, var(--bg)); }
`;
