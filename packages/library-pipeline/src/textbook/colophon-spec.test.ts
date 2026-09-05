// packages/library-pipeline/src/textbook/colophon-spec.test.ts
//
// **판권장에 찍는 규격이 하드코딩으로 되돌아가지 않게 지킨다.**
//
// `render-volume.mjs` 의 규격 칩이 오래 `지문 90~200어` 로 박혀 있었다. 학년별 창이
// 도입돼 중등이 90~152, 고2 가 90~188 이 된 뒤에도 **전 밴드가 90~200 을 인쇄**했다
// (실측 2026-08-31: V3·V4·V6·V7 전부 오기). 조판물만 보는 사람에게 그 줄은 검수의
// 근거로 읽히므로, 틀린 규격을 적는 것은 내용이 틀린 것과 같다.
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 저장소 뿌리 — **이 파일 위치 기준**으로 잡는다.
 *
 * 전에는 `process.cwd()` 에서 '../..' 를 올라갔다. 그러면 패키지 디렉터리에서 돌릴 때만
 * 맞고, vitest 를 저장소 뿌리에서 돌리면 저장소 밖을 읽으려다 ENOENT 로
 * **네 파일이 통째로 실패**한다(실측 2026-09-05). 조용히 안 도는 테스트는 없는 테스트다.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')


const read = (f: string) =>
  fs.readFileSync(path.resolve(REPO_ROOT, 'scripts/textbook', f), 'utf8')

describe('판권장 규격 칩', () => {
  const src = read('render-volume.mjs')

  it('길이를 하드코딩하지 않는다', () => {
    // ⚠️ 파일 어디에도 없어야 한다고 검사하면 **이 결함을 설명하는 주석까지** 걸린다
    //   (처음에 그렇게 썼다가 걸렸다). 인쇄되는 자리, 즉 칩 템플릿만 본다.
    expect(src).not.toContain('class="chip">지문 90~200어')
    expect(src).toContain('class="chip">지문 ${PASSAGE_CHIP}')
  })

  it('실제로 인쇄한 유형에서 창을 유도한다', () => {
    expect(src).toContain('passageSpecChip(Object.keys(actualMix))')
    // 학년을 넘겨야 중등·고2 의 좁은 창이 반영된다.
    expect(src).toContain('itemWordSpec(t, BAND)')
  })

  it('지문이 없는 유형은 규격에서 뺀다', () => {
    // 초등 3종은 사전에서 나와 창이 무한대이고(0~MAX_SAFE_INTEGER),
    // 문장 단위 유형의 6~40어는 지문 길이가 아니다. 둘 다 그대로 인쇄된 적이 있다.
    expect(src).toContain('!ELEMENTARY_TYPES.has(t) && !SCHOOL_SENTENCE_TYPES.has(t)')
    expect(src).toContain('s.max < 10_000')
  })

  it('지문을 싣지 않는 권은 그렇다고 적는다', () => {
    expect(src).toContain("'없음 — 낱말 중심'")
  })

  it('판권장이 주장하는 검수를 **실제로 돌린다**', () => {
    // ⚠️ 이 두 칩은 오래 근거 없이 찍혔다 — scoreVolume 에 정답 쏠림 검사가 없었고
    //   조판기는 proofread 를 한 번도 부르지 않았다(둘 다 참조 0건, 실측 2026-08-31).
    //   재료는 있었으니 없던 것은 호출이다. 주장을 지우는 대신 수행하게 했다.
    // 2026-08-31 — 5칸 고정 배열(`biasCounts`)이 4지선다를 오탐하던 것을 고치면서
    // 선택지 수별 묶음으로 바뀌었다. 상세는 `answer-bias-choices.test.ts`.
    expect(src).toContain('assessAnswerBias(counts)')
    expect(src).toContain('summarizeProofread(proofPassages)')
    // 결과를 함께 찍어야 그 줄이 근거가 된다 — 통과 여부만 적으면 또 장식이 된다.
    expect(src).toContain('bias.chi2.toFixed(1)')
    expect(src).toContain('proof.defective}/')
  })

  it('교정은 **인쇄되는 지문**에 건다 — 저장 원본이 아니다', () => {
    // 절 이름 제거·반복 꼬리 절단·따옴표 정규화를 거친 사본이 학습자가 읽는 글이다.
    const pool = read('volume-pool.mjs')
    // 2026-08-31 — 교정기가 처음 잡은 실 결함 6건(전부 원문 추출 잡티)을 이 체인에서 지운다.
    // 상세와 순서 근거는 `extraction-grime.test.ts`.
    expect(pool).toContain('stripSectionLabels')
    expect(pool).toContain('dropRepeatedTail')
    expect(pool).toContain('dropDuplicatedLeadWord')
    expect(pool).toContain('stripSpaceBeforePunct')
    expect(pool).toContain('pairStraightQuotes')
  })

  it('출처는 **지문마다** 붙는다 — 판권장이 그렇게 약속한다', () => {
    // 판권장의 정책 문구는 "각 지문 아래에 출처를 밝힌다" 인데, 조판은 단원 끝에
    // "A / B / C" 로 몰아 찍고 있었다(실측 2026-08-31: 60문항에 출처줄 10개).
    // 출처는 저작권 표시이자 원문으로 가는 길이라 **문항에 붙어야** 뜻이 있다.
    expect(src).toContain('r.html + srcLine(r.source)')
    expect(src).toContain('const srcLine =')
  })

  it('원글이 없는 카드는 낱말을 출처라고 적지 않는다', () => {
    // 초등 3종은 ref_title 자리에 낱말이 들어가 "출처 · above" 가 찍혔다(V1 60문항 전부).
    expect(src).toContain("source: '2022 개정 교육과정 별표 어휘'")
  })
})
