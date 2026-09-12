// apps/web/src/components/diagnostic/DiagnosticClient.tsx
//
// 진단 클라이언트 — test-agnostic (V-Level + 시험별 진단 지원)
//
// 흐름:
//   1. start: 주 진단 1개 단일 CTA + 특정 시험 진단(접힘) + 지난 결과 요약
//   2. question: 단어 카드 + 알아요/모릅니다
//   3. submitting: spinner
//   4. results: 레벨 + 추천 단어장 (+ 관심 도메인)

'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { subscribeSet } from '@/app/(main)/library/vocab/actions'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Target,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react'

type Phase = 'start' | 'question' | 'submitting' | 'results'

interface TestInfo {
  id: string
  name_ko: string
  test_type: string
  target_axis: string
  target_track_id: string | null
  question_count: number
  estimated_minutes: number
  description_ko: string | null
}

interface Question {
  id: string
  word: string
  target_v_level: number | null
  target_track_level: number | null
  display_order: number
}

interface Response {
  question_id: string
  knew: boolean
}

interface Recommendation {
  set_id: string
  slug: string
  title: string
  category: string
  word_count: number
  cover_emoji: string | null
  recommendation_type: string
  reason: string
  priority: number
}

const INTEREST_OPTIONS = [
  { key: 'medical', label: '의학 영어', emoji: '🩺' },
  { key: 'business', label: '비즈니스 영어', emoji: '💼' },
  { key: 'literary', label: '영문학', emoji: '📚' },
  { key: 'academic', label: '학술 영어', emoji: '🎓' },
] as const

// 추천 유형 → 사용자 친화 라벨 (내부 키 노출 방지)
const REC_LABEL: Record<string, string> = {
  primary: '딱 맞아요',
  stretch: '도전',
  review: '복습',
}

// 진단 유형 → 사용자 친화 표현 (DB description_ko 는 내부 용어 위주라 UI 에서 재작성)
interface Presentation {
  emoji: string
  title: string
  blurb: string
  who: string
  recommended?: boolean
}
const TEST_PRESENTATION: Record<string, Presentation> = {
  base_v_level: {
    emoji: '🧭',
    title: '전체 어휘 진단',
    blurb: '내 전반적인 영어 어휘 수준(V-Level)을 측정해요.',
    who: '처음이거나 전반적인 수준이 궁금하다면',
    recommended: true,
  },
  comprehensive: {
    emoji: '🌐',
    title: '종합 진단',
    blurb: '전체 수준 + 수능·비즈니스·학술 영역을 한 번에 측정해요.',
    who: '여러 목표를 함께 점검하고 싶다면',
  },
  csat_korean: {
    emoji: '🎓',
    title: '수능 어휘 진단',
    blurb: '수능 빈출 어휘 기준으로 측정해요.',
    who: '수능을 준비한다면',
  },
  business_english: {
    emoji: '💼',
    title: '비즈니스·TOEIC 진단',
    blurb: '직장·TOEIC 비즈니스 어휘 기준으로 측정해요.',
    who: 'TOEIC·직장 영어를 준비한다면',
  },
  academic_english: {
    emoji: '📚',
    title: '학술·TOEFL/IELTS 진단',
    blurb: '대학원·유학 학술 어휘 기준으로 측정해요.',
    who: 'TOEFL·IELTS·유학을 준비한다면',
  },
}

// TestInfo → presentation key
function presoKey(t: TestInfo): string {
  return t.test_type === 'track' ? (t.target_track_id ?? 'track') : t.test_type
}

// 유형별 안내 팝업 콘텐츠 — 스캔 가능한 구조 (한 줄 목적 / 활용 체크리스트 / 학습 흐름 단계)
interface TestInfoContent {
  summary: string // 목적 한 줄 (headline)
  usagePoints: string[] // 결과 활용 — 짧은 항목
  steps: string[] // 학습 흐름 — 3단계 칩
}
const TEST_INFO: Record<string, TestInfoContent> = {
  base_v_level: {
    summary: '내 전반적인 영어 어휘 수준(V1~V11)을 측정해요.',
    usagePoints: [
      '결과가 내 기준 레벨이 돼요',
      '단어 추출·추천이 이 레벨에 맞춰져요 (i+1)',
      '학습이 쌓이면 레벨이 자동으로 올라가요',
    ],
    steps: ['진단', '추천 단어장 학습', '재진단으로 점검'],
  },
  comprehensive: {
    summary: '전체 수준 + 수능·비즈니스·학술을 한 번에 측정해요.',
    usagePoints: ['전체 레벨 + 3개 영역 레벨 동시 설정', '영역별 추천이 함께 활성화돼요'],
    steps: ['종합 진단', '영역별 단어장', '필요 영역 정밀 진단'],
  },
  csat_korean: {
    summary: '수능 빈출 어휘 기준으로 내 수준을 측정해요.',
    usagePoints: ['수능 트랙 레벨 설정', '수능 단어장 우선 추천'],
    steps: ['진단', '수능 단어장 집중', '시험 전 재진단'],
  },
  business_english: {
    summary: '직장·TOEIC 어휘 기준으로 내 수준을 측정해요.',
    usagePoints: ['비즈니스 트랙 레벨 설정', 'TOEIC·실무 단어장 우선 추천'],
    steps: ['진단', '비즈니스 단어장 집중', '목표 점수 시점 재진단'],
  },
  academic_english: {
    summary: '대학원·유학(TOEFL·IELTS) 학술 어휘 기준으로 측정해요.',
    usagePoints: ['학술 트랙 레벨 설정', '학술 단어장 우선 추천'],
    steps: ['진단', '학술 단어장 집중', '시험 전 재진단'],
  },
}

// V-Level 정의 — vocaflow_levels (SSoT) 런타임 fetch. 한국 학제·수능 기준.
interface LevelDef {
  level: number
  korean_name: string
  english_name: string | null
  cefr_min: string | null
  cefr_max: string | null
  test_score_hints: string | null
  description_ko: string | null
}

// ══════════════════════════════════════════════════════════════
// 진행 중 응답 보관 — 40문항이 오클릭 한 번에 사라지던 자리
//
// 진단은 최대 40문항인데 답은 React state 에만 쌓였고, `/diagnostic` 은 풀스크린 라우트가
// 아니라 진단 중에도 사이드바·나침반 띠·하단 탭이 그대로 떠 있다. 30문항을 푼 상태에서
// 셸 링크를 잘못 누르거나 새로고침하면 **30개가 전부 사라졌고 확인 대화도 없었다.**
// 제출이 실패해도 재시도 경로가 없어 처음부터 다시 풀어야 했다.
//
// 저장이 되면 확인 대화(모달)는 필요 없다 — CLAUDE.md 는 모달로 학습을 끊는 것을 금지하고,
// "나가도 잃지 않는다" 가 "나가지 마세요" 보다 낫다. 그래서 **막지 않고 보관한다.**
// ══════════════════════════════════════════════════════════════

/** 진행 중 응답 보관 키. 값은 아래 SavedProgress 한 형태만 들어간다. */
const PROGRESS_KEY = 'vocaflow-diagnostic-progress'

/**
 * 보관 유효 시간 24시간.
 * 그보다 오래된 진행을 "이어서 하기" 로 권하면 어제의 컨디션으로 잰 절반과 오늘의 절반이
 * 한 결과로 섞인다 — 측정이 아니라 잡음이 된다.
 */
const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000

interface SavedProgress {
  testId: string
  responses: Response[]
  savedAt: number
}

/** localStorage 는 사파리 프라이빗 모드 등에서 접근 자체가 던진다 — 실패해도 진단은 계속된다. */
function readProgress(): SavedProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedProgress>
    if (
      typeof parsed?.testId !== 'string' ||
      !Array.isArray(parsed.responses) ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null
    }
    const responses = parsed.responses.filter(
      (r): r is Response =>
        typeof (r as Response)?.question_id === 'string' && typeof (r as Response)?.knew === 'boolean',
    )
    if (responses.length === 0) return null
    if (Date.now() - parsed.savedAt > PROGRESS_TTL_MS) return null
    return { testId: parsed.testId, responses, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

function writeProgress(testId: string, responses: Response[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ testId, responses, savedAt: Date.now() } satisfies SavedProgress),
    )
  } catch {
    // 저장이 안 되면 예전과 같은 동작(메모리만) — 진단을 막지는 않는다
  }
}

function clearProgress(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // 지우지 못해도 TTL 이 24시간 뒤 정리한다
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  return `${Math.floor(days / 30)}개월 전`
}

export function DiagnosticClient() {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [phase, setPhase] = useState<Phase>('start')
  /** 결과 화면의 1차 CTA(구독 + 학습 시작)가 진행 중인가 — 이중 제출 방지. */
  const [starting, setStarting] = useState(false)
  /** 보관된 진행 — 시작 화면에서 "이어서 하기" 로 제시한다. 없으면 null. */
  const [saved, setSaved] = useState<SavedProgress | null>(null)
  /** 이어서 하기로 문항을 다시 받는 중 — 버튼 이중 클릭 방지. */
  const [resuming, setResuming] = useState(false)
  const [tests, setTests] = useState<TestInfo[]>([])
  const [loadingTests, setLoadingTests] = useState(true)
  const [selectedTest, setSelectedTest] = useState<TestInfo | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [responses, setResponses] = useState<Response[]>([])
  const [estimatedLevel, setEstimatedLevel] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastLevel, setLastLevel] = useState<{ level: number; when: string } | null>(null)
  const [infoTest, setInfoTest] = useState<TestInfo | null>(null)
  const [levelGuideOpen, setLevelGuideOpen] = useState(false)
  const [levels, setLevels] = useState<LevelDef[]>([])

  // V-Level 정의(SSoT) — 결과 평가 + 레벨 안내에 사용
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('vocaflow_levels')
        .select('level, korean_name, english_name, cefr_min, cefr_max, test_score_hints, description_ko')
        .order('level', { ascending: true })
      if (data) setLevels(data as LevelDef[])
    })()
  }, [supabase])

  // 팝업 Esc 닫기 (유형 안내 + 레벨 안내 공통)
  useEffect(() => {
    if (!infoTest && !levelGuideOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInfoTest(null)
        setLevelGuideOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoTest, levelGuideOpen])

  // start phase mount — fetch tests + last result
  useEffect(() => {
    if (phase !== 'start') return
    void (async () => {
      setLoadingTests(true)
      const [{ data: testsData, error: tErr }, { data: userData }] = await Promise.all([
        supabase
          .from('vrl_diagnostic_tests')
          .select(
            'id, name_ko, test_type, target_axis, target_track_id, question_count, estimated_minutes, description_ko',
          )
          .eq('is_active', true)
          .order('test_type', { ascending: true }),
        supabase.auth.getUser(),
      ])
      setLoadingTests(false)

      if (tErr) {
        setError(tErr.message)
        return
      }
      setTests((testsData ?? []) as TestInfo[])
      // 보관된 진행이 있으면 시작 화면에서 "이어서 하기" 로 제시한다(자동으로 끌어다
      // 이어 붙이지 않는다 — 어제 하다 만 것을 오늘 말없이 계속하면 결과가 뒤섞인다).
      setSaved(readProgress())

      if (userData.user?.id) {
        const { data: snap } = await supabase
          .from('user_level_snapshots')
          .select('v_level, taken_at')
          .eq('user_id', userData.user.id)
          .order('taken_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (snap) setLastLevel({ level: snap.v_level as number, when: snap.taken_at as string })
      }
    })()
  }, [phase, supabase])

  /** 문항 목록 — 시작과 이어서 하기가 같은 쿼리를 쓴다(둘이 갈라지면 이어붙일 수 없다). */
  async function fetchQuestions(testId: string): Promise<Question[] | null> {
    const { data, error: qErr } = await supabase
      .from('vrl_diagnostic_questions')
      .select('id, word, target_v_level, target_track_level, display_order')
      .eq('test_id', testId)
      .order('display_order', { ascending: true })
    if (qErr || !data) {
      setError(qErr?.message ?? '문항을 불러올 수 없어요')
      return null
    }
    return data as Question[]
  }

  async function startTest(test: TestInfo) {
    setError(null)
    setSelectedTest(test)
    const data = await fetchQuestions(test.id)
    if (!data) return
    // 새로 시작하면 보관된 진행은 버린다 — 두 진단의 답이 섞이면 안 된다.
    clearProgress()
    setSaved(null)
    setQuestions(data)
    setCurrentIdx(0)
    setResponses([])
    setPhase('question')
  }

  /** 보관된 진행을 이어서 푼다 — 답한 수만큼 건너뛰고 그 다음 문항부터. */
  async function resumeTest(progress: SavedProgress) {
    if (resuming) return
    setResuming(true)
    try {
      const test = tests.find((t) => t.id === progress.testId)
      if (!test) {
        // 진단 자체가 사라졌다(비공개 전환 등) — 보관분은 쓸 데가 없다.
        clearProgress()
        setSaved(null)
        return
      }
      setError(null)
      setSelectedTest(test)
      const data = await fetchQuestions(test.id)
      if (!data) return
      // 문항이 바뀌었을 수 있다 — 지금 목록에 있는 답만 남긴다(없는 문항 id 를 제출하면 분석이 틀어진다).
      const ids = new Set(data.map((q) => q.id))
      const kept = progress.responses.filter((r) => ids.has(r.question_id))
      setQuestions(data)
      setResponses(kept)
      if (kept.length >= data.length) {
        setCurrentIdx(Math.max(0, data.length - 1))
        void submit(kept)
        return
      }
      setCurrentIdx(kept.length)
      setPhase('question')
    } finally {
      setResuming(false)
    }
  }

  function handleAnswer(knew: boolean) {
    const q = questions[currentIdx]
    if (!q) return
    const next: Response[] = [...responses, { question_id: q.id, knew }]
    setResponses(next)
    // ⚠️ **답할 때마다** 보관한다. 마지막에 한 번 저장하면 잃는 경우가 정확히 유실 사례다.
    if (selectedTest) writeProgress(selectedTest.id, next)
    if (currentIdx + 1 >= questions.length) void submit(next)
    else setCurrentIdx(currentIdx + 1)
  }

  async function submit(finalResponses: Response[]) {
    if (!selectedTest) return
    setPhase('submitting')
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      setError('로그인이 필요해요')
      return
    }

    const { data: insertData, error: insertErr } = await supabase
      .from('user_diagnostic_results')
      .insert({
        user_id: userId,
        test_id: selectedTest.id,
        responses: finalResponses as unknown as never,
      })
      .select('id')
      .single()

    if (insertErr || !insertData) {
      setError(insertErr?.message ?? '결과 저장 실패')
      return
    }

    // ⚠️ rpc() 인자는 반드시 문자열 리터럴로 둘 것 (변수로 넘기지 말 것).
    //   RPC 권한 감사는 코드에서 호출되는 함수 이름을 정적으로 모아 "아무도 안 부르는데
    //   anon 에 열린 함수" 를 찾아낸다. 예전엔 여기가 `rpc(rpcName)` 이라 그 수집에서
    //   빠졌고, 하마터면 진단 3종의 EXECUTE 를 회수해 이 흐름을 조용히 죽일 뻔했다.
    //   회귀 락: src/lib/auth/__tests__/rpc-call-sites.test.ts
    const p = { p_result_id: insertData.id }
    const { data: applyData, error: applyErr } =
      selectedTest.test_type === 'track'
        ? await supabase.rpc('analyze_and_apply_track_diagnostic_result', p)
        : selectedTest.test_type === 'comprehensive'
          ? await supabase.rpc('analyze_and_apply_comprehensive_diagnostic_result', p)
          : await supabase.rpc('analyze_and_apply_diagnostic_result', p)

    if (applyErr) {
      setError(applyErr.message)
      return
    }

    const result = Array.isArray(applyData) ? applyData[0] : applyData
    const r = result as unknown as
      | { estimated_v_level?: number; estimated_track_level?: number; confidence?: number }
      | null
    const lvl =
      selectedTest.test_type === 'track' ? r?.estimated_track_level : r?.estimated_v_level
    setEstimatedLevel(lvl ?? null)
    setConfidence(r?.confidence ?? null)

    // 결과가 DB 에 남았으므로 보관분은 역할이 끝났다 — 남겨 두면 다음 방문에
    // 이미 끝낸 진단을 "이어서 하기" 로 권하게 된다.
    clearProgress()
    setSaved(null)

    if (selectedTest.test_type === 'base_v_level' || selectedTest.test_type === 'comprehensive') {
      await fetchRecommendations(userId, [])
    }
    setPhase('results')
  }

  async function fetchRecommendations(userId: string, selectedInterests: string[]) {
    const { data } = await supabase.rpc('recommend_word_sets_for_user', {
      p_user_id: userId,
      p_interests: selectedInterests.length > 0 ? selectedInterests : undefined,
    })
    setRecommendations((data ?? []) as Recommendation[])
  }

  /**
   * 결과 화면의 1차 CTA — **진단이 끝난 자리에서 곧장 첫 학습으로 들어간다.**
   *
   * 왜 이렇게 바꿨나 (D5 · 가입 후 첫 학습까지 화면 전환 ≤3):
   *   예전 목적지는 `/wordvault` 였는데 **방금 가입·진단한 사람의 단어장은 정의상 비어 있다** —
   *   빈 상태 화면이 다시 `/library` 로 내보내는, 아무 결정도 받지 않는 중간 화면이었다.
   *   여기서 추천 세트 하나를 구독하면 `subscribeSet` 이 첫 세션 분량(최대 40개, 도서 챕터
   *   세트는 `commit_chapter_vocab` 이 정하는 8~30개)을 `vocabularies` 에 넣고,
   *   `/flashcard/play` 는 스코프 없이 들어와도 그 단어를 앞에서부터 세션으로 연다
   *   (`fetchStudyVocabularies` 는 due 로 거르지 않고 `next_review_at` nullsFirst 정렬이라
   *    **막 담은 단어가 맨 앞에 온다** — 실측 근거).
   *
   * ⚠️ **자동 구독이 아니라 버튼이 하는 일이다.** 학습자 데이터에 쓰는 동작을 화면이 조용히
   *    대신하지 않는다 — 라벨이 세트 이름을 말하고, 구독은 `/library/vocab` 에서 해지된다.
   *
   * 실패해도 막다른 화면을 만들지 않는다(D4) — 사유를 말하고 `/hub` 로 보낸다.
   */
  async function startWithRecommendation(rec: Recommendation) {
    if (starting) return
    setStarting(true)
    try {
      const res = await subscribeSet(rec.set_id)
      if (!res.ok) {
        toast.error(
          res.reason === 'not_published'
            ? '이 단어장은 지금 담을 수 없어요. 오늘 할 일에서 다른 걸 골라볼까요?'
            : (res.message ?? '단어장을 담지 못했어요. 오늘 할 일에서 이어가 주세요.'),
        )
        router.push('/hub')
        return
      }
      router.push('/flashcard/play')
    } catch {
      toast.error('단어장을 담지 못했어요. 오늘 할 일에서 이어가 주세요.')
      router.push('/hub')
    } finally {
      setStarting(false)
    }
  }

  function toggleInterest(key: string) {
    const next = interests.includes(key)
      ? interests.filter((i) => i !== key)
      : [...interests, key]
    setInterests(next)
    void (async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user?.id) await fetchRecommendations(userData.user.id, next)
    })()
  }

  // ── Render ──
  if (error) {
    return (
      <div className="mx-auto max-w-[var(--ios-content-max)] px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-[var(--r-lg)] border border-[var(--bde)] bg-[var(--error-light)] p-6">
          <p className="break-keep font-body text-[var(--error-ink)]">{error}</p>
          {/* ⚠️ 제출이 실패했을 때 유일한 버튼이 「처음으로」였다 — 40문항을 처음부터 다시 풀라는
              말이다. 답은 아직 메모리에도 보관함에도 살아 있으므로 **같은 답으로 다시 제출**한다. */}
          {selectedTest && responses.length > 0 && (
            <>
              <p className="mt-2 break-keep font-body text-[13px] text-[var(--t2)]">
                답한 {responses.length}문항은 그대로 남아 있어요. 다시 보내볼까요?
              </p>
              <button
                onClick={() => {
                  setError(null)
                  void submit(responses)
                }}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97]"
              >
                답한 그대로 다시 제출
              </button>
            </>
          )}
          <div className="mt-3">
            <button
              onClick={() => {
                setError(null)
                setSaved(readProgress())
                setPhase('start')
              }}
              className="inline-flex min-h-[44px] items-center font-display text-[12px] font-[600] text-[var(--p)] underline transition-colors duration-[var(--dur-normal)] hover:text-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
            >
              처음으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'start') {
    const primary =
      tests.find((t) => presoKey(t) === 'base_v_level') ??
      tests.find((t) => TEST_PRESENTATION[presoKey(t)]?.recommended) ??
      tests[0] ??
      null
    const secondary = tests.filter((t) => t.id !== primary?.id)

    // 목표 라벨 (means-end: 사용자의 목표 → 진단 매핑)
    const GOAL: Record<string, string> = {
      comprehensive: '여러 목표를 한 번에',
      csat_korean: '수능 준비',
      business_english: '토익·직장 영어',
      academic_english: '토플·IELTS·유학',
      base_v_level: '전반적인 영어',
    }

    // 추천 기본값 — 압도적으로 부각 (default effect + 불안 완화)
    const renderHero = (t: TestInfo) => {
      const p = TEST_PRESENTATION[presoKey(t)]
      if (!p) return null
      return (
        <div className="rounded-[var(--r-2xl)] bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)] p-6 text-[var(--on-p)] shadow-[var(--sh-md)]">
          <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--active)] px-3 py-1 font-display text-[11px] font-[700] text-[var(--on-active)]">
            ★ 처음이라면 여기서 시작
          </span>
          <h2 className="mt-3 font-display text-[24px] font-[700] leading-tight">{p.title}</h2>
          <p className="mt-1.5 font-body text-[14px] leading-relaxed opacity-90">
            목표가 뚜렷하지 않다면, 이 진단 하나로 충분해요.
          </p>
          <p className="mt-3 inline-block rounded-[var(--r-full)] bg-white/15 px-3 py-1 font-body text-[12px]">
            {t.question_count}문항 · 약 {t.estimated_minutes}분
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => void startTest(t)}
              className="group flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--ti)] px-5 py-3 font-display text-[15px] font-[700] text-[var(--p)] shadow-[var(--sh-sm)] transition-transform hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--p)]"
            >
              진단 시작
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
            <button
              onClick={() => setInfoTest(t)}
              className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--on-p)]/40 px-4 py-3 font-display text-[14px] font-[600] text-[var(--on-p)] transition-colors hover:bg-white/10"
            >
              <Info size={14} aria-hidden /> 안내
            </button>
          </div>
        </div>
      )
    }

    // 목표 기반 보조 진단 — 조용한 위계 (recognition over recall: 목표 라벨 우선)
    const renderGoal = (t: TestInfo) => {
      const p = TEST_PRESENTATION[presoKey(t)]
      if (!p) return null
      const goal = GOAL[presoKey(t)] ?? p.title
      return (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)] transition-colors hover:border-[var(--p)]"
        >
          <span className="text-[22px] leading-none" aria-hidden>
            {p.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-[700] text-[var(--t1)]">{goal}</p>
            <p className="truncate font-body text-[11px] text-[var(--t2)]">
              {p.title} · {t.question_count}문항 · {t.estimated_minutes}분
            </p>
          </div>
          <button
            onClick={() => setInfoTest(t)}
            aria-label={`${goal} 안내`}
            // 44px 하한 — 실측 32x32 (목표 4종 전부). 아이콘(16px)은 그대로, 히트영역만 키운다.
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <Info size={16} />
          </button>
          <button
            onClick={() => void startTest(t)}
            // 44px 하한 — 실측 69x34. 진단 목록의 **시작 버튼**이라 가장 자주 눌린다.
            className="group inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-[var(--r-md)] bg-[var(--bg3)] px-4 py-2 font-display text-[12px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--p)] hover:text-[var(--on-p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            시작
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-[var(--ios-content-wide-max)] px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6">
          <h1 className="font-editorial text-[32px] font-[500] tracking-[-0.012em] text-[var(--t1)] md:text-[40px]">
            어휘 진단
          </h1>
          <p className="mt-3 font-body text-[15px] leading-relaxed text-[var(--t2)]">
            단어를 보고 <strong className="text-[var(--t1)]">안다/모른다</strong>만 고르면 돼요.
            3~6분이면 끝나고, <strong className="text-[var(--t1)]">언제든 다시</strong> 받을 수
            있어요.
          </p>
        </header>

        {/* 하다 만 진단 — 보관된 답을 되돌려 준다. 자동으로 이어 붙이지 않고 고르게 한다. */}
        {saved && tests.some((t) => t.id === saved.testId) && (
          <div className="mb-6 rounded-[var(--r-lg)] border border-[var(--p)] bg-[var(--p-light)] p-4">
            <p className="break-keep font-display text-[14px] font-[700] text-[var(--t1)]">
              하다 만 진단이 있어요 — {saved.responses.length}문항까지 답했어요
            </p>
            <p className="mt-1 break-keep font-body text-[13px] leading-relaxed text-[var(--t2)]">
              이어서 하면 답한 문항은 건너뛰고 그다음부터 물어봐요.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => void resumeTest(saved)}
                disabled={resuming}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resuming ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" aria-hidden /> 불러오는 중…
                  </>
                ) : (
                  '이어서 하기'
                )}
              </button>
              <button
                onClick={() => {
                  clearProgress()
                  setSaved(null)
                }}
                disabled={resuming}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-5 font-display text-[14px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                지우고 처음부터
              </button>
            </div>
          </div>
        )}

        {/* 지난 결과 — 컴팩트 요약 */}
        {lastLevel && (
          <div className="mb-6 flex items-center justify-between rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
            <span className="flex items-center gap-1 font-body text-[13px] text-[var(--t2)]">
              지난 결과{' '}
              <strong className="font-display text-[var(--t1)]">V{lastLevel.level}</strong>
              <button
                onClick={() => setLevelGuideOpen(true)}
                aria-label="레벨 안내 보기"
                // 44px 하한 — 실측 20x20. 아이콘(13px)은 그대로 두고 히트영역만 키운다.
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--p)]"
              >
                <Info size={13} aria-hidden />
              </button>
              <span className="text-[var(--t2)]">· {relativeTime(lastLevel.when)}</span>
            </span>
            <button
              onClick={() => router.push('/diagnostic/history')}
              // 44px 하한 — 실측 50x18. 글자 크기는 유지하고 세로 여백으로 채운다.
              className="inline-flex min-h-[44px] items-center px-2 font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
            >
              기록 보기
            </button>
          </div>
        )}

        {/* 진단 선택 — 추천 기본값 부각(default effect) + 목표 기반 분기(means-end) */}
        {loadingTests ? (
          <div className="flex items-center gap-2 font-body text-[13px] text-[var(--t2)]">
            <Loader2 size={14} className="animate-spin" /> 진단 목록 불러오는 중…
          </div>
        ) : tests.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t2)]">사용 가능한 진단이 없어요.</p>
        ) : (
          <>
            {primary && renderHero(primary)}

            {secondary.length > 0 && (
              <section aria-label="목표별 진단" className="mt-7">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
                    또는, 목표가 분명하다면
                  </span>
                  <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
                </div>
                <div className="flex flex-col gap-3">{secondary.map(renderGoal)}</div>
              </section>
            )}
          </>
        )}

        {/* 유형별 안내 팝업 */}
        {infoTest && (
          <InfoModal test={infoTest} onClose={() => setInfoTest(null)} onStart={() => { const t = infoTest; setInfoTest(null); void startTest(t); }} />
        )}
        {/* 레벨 안내 팝업 */}
        {levelGuideOpen && (
          <LevelGuideModal
            levels={levels}
            currentLevel={lastLevel?.level ?? null}
            isTrack={false}
            onClose={() => setLevelGuideOpen(false)}
          />
        )}
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="mx-auto max-w-[var(--ios-content-max)] px-6 py-8 text-center">
        <Loader2 size={32} className="mx-auto animate-spin text-[var(--p)]" />
        <p className="mt-4 font-display text-[14px] font-[600] text-[var(--t2)]">결과 분석 중…</p>
      </div>
    )
  }

  if (phase === 'question') {
    const q = questions[currentIdx]
    if (!q) return null
    const progress = ((currentIdx + 1) / questions.length) * 100
    return (
      <div className="mx-auto max-w-[var(--ios-content-max)] px-4 py-6 md:px-6 md:py-8">
        <div className="mb-8">
          {/* 나가는 것을 막지 않는다(모달 금지) — 대신 답이 남는다는 사실을 라벨이 말한다.
              답은 매 문항 localStorage 에 보관되고 시작 화면이 "이어서 하기" 로 되돌려 준다. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setSaved(readProgress())
                setPhase('start')
              }}
              aria-label="진단 멈추기 — 답한 문항은 보관되고 나중에 이어서 할 수 있어요"
              className="inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-sm)] px-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
            >
              ← 멈추기
            </button>
            {responses.length > 0 && (
              <span className="break-keep font-body text-[11px] text-[var(--t2)]">
                여기까지 답한 {responses.length}문항은 저장돼요
              </span>
            )}
          </div>
          <div className="mb-2 flex items-center justify-between font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
            <span>
              {currentIdx + 1} / {questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]">
            <div
              className="h-full rounded-[var(--r-full)] bg-[var(--p)] transition-[width] duration-[var(--dur-slow)] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mb-8 rounded-[var(--r-xl)] border border-[var(--bd)] bg-[var(--bg)] p-12 text-center shadow-[var(--sh-sm)]">
          <p className="font-editorial text-[56px] font-[500] leading-tight tracking-[-0.015em] text-[var(--t1)]">
            {q.word}
          </p>
          <p className="mt-3 font-body text-[12px] text-[var(--t2)]">이 단어의 뜻을 알고 있나요?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleAnswer(false)}
            className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border-2 border-[var(--bd)] bg-[var(--bg)] px-6 py-4 font-display text-[16px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:border-[var(--t3)] hover:bg-[var(--bg2)] active:scale-[0.97]"
          >
            <XCircle size={20} /> 모릅니다
          </button>
          <button
            onClick={() => handleAnswer(true)}
            className="flex items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-4 font-display text-[16px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
          >
            <CheckCircle2 size={20} /> 알아요
          </button>
        </div>
      </div>
    )
  }

  // phase === 'results'
  const isTrack = selectedTest?.test_type === 'track'
  const lvl = estimatedLevel
  const levelLabel = isTrack ? `L${lvl ?? '-'}` : `V${lvl ?? '-'}`
  const band = lvl != null ? (levels.find((l) => l.level === lvl) ?? null) : null
  const cefrRange = band?.cefr_min
    ? band.cefr_max && band.cefr_max !== band.cefr_min
      ? `${band.cefr_min}~${band.cefr_max}`
      : band.cefr_min
    : null
  const pct = confidence != null ? Math.round(confidence * 100) : null
  const tone: 'high' | 'mid' | 'low' =
    pct == null ? 'mid' : pct >= 85 ? 'high' : pct >= 60 ? 'mid' : 'low'
  const confLine =
    tone === 'high'
      ? '여유 있게 통과했어요. 한 단계 위 단어에 도전해도 좋아요.'
      : tone === 'low'
        ? '기초를 다지는 단계예요. 쉬운 단어부터 차근히 쌓아요.'
        : '적정 난이도예요. 지금 수준을 다지며 조금씩 올려가요.'

  const improvePoints: string[] = [
    lvl != null
      ? `지금보다 살짝 어려운 ${isTrack ? `L${Math.min(lvl + 1, 11)}` : `V${Math.min(lvl + 1, 11)}`} 단어에 집중하면 가장 빠르게 늘어요 (i+1).`
      : '내 수준보다 살짝 어려운 단어에 집중하는 것이 효과적이에요.',
    '진단에서 모른 단어를 단어장에 담아 반복 학습하세요.',
    tone === 'low'
      ? '한 번에 많이보다 매일 조금씩이 더 오래 남아요.'
      : '아는 단어는 빠르게 넘기고, 모르는 단어에 시간을 쓰세요.',
  ]
  const nextPoints: string[] = isTrack
    ? [
        '해당 시험 단어장에 집중해 학습하세요.',
        '전체 어휘 진단으로 전반적인 수준도 함께 확인해보세요.',
      ]
    : [
        '‘딱 맞아요’로 표시된 추천 단어장부터 시작하세요.',
        '하루 학습 목표를 정해 꾸준히 이어가세요.',
        '단어가 충분히 늘면 다시 진단해 레벨을 확인하세요 (자동 상향도 돼요).',
      ]

  return (
    <div className="mx-auto max-w-[var(--ios-content-max)] px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 rounded-[var(--r-xl)] bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)] p-8 text-center text-[var(--on-p)] shadow-[var(--sh-md)]">
        <p className="font-body text-[14px] opacity-85">진단 완료 · 내 수준은</p>
        <p className="mt-1 font-editorial text-[72px] font-[500] leading-none tracking-[-0.018em] text-[var(--active)]">
          {levelLabel}
        </p>
        {band && !isTrack && (
          <p className="mt-2 font-display text-[15px] font-[700]">{band.korean_name}</p>
        )}
        {cefrRange && (
          <p className="mt-1 font-body text-[12px] opacity-80">CEFR {cefrRange}</p>
        )}
        {pct !== null && (
          <p className="mt-2 font-body text-[13px] opacity-80">정답률 {pct}%</p>
        )}
        <button
          onClick={() => setLevelGuideOpen(true)}
          className="mt-4 inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--on-p)]/40 px-3 py-2 font-display text-[12px] font-[600] text-[var(--on-p)] transition-colors hover:bg-white/10"
        >
          <Info size={13} aria-hidden /> 이 레벨이 뭔가요?
        </button>
      </header>

      {/* 결과 평가 */}
      <section className="mb-6 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
        <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">결과 평가</h2>
        {band &&
          (!isTrack ? (
            <>
              <p className="mt-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">
                <strong className="text-[var(--t1)]">
                  {levelLabel} · {band.korean_name}
                </strong>
                {band.description_ko ? ` — ${band.description_ko}` : ''}
              </p>
              {(cefrRange || band.test_score_hints) && (
                <p className="mt-1 font-body text-[12px] text-[var(--t2)]">
                  {cefrRange && `CEFR ${cefrRange}`}
                  {cefrRange && band.test_score_hints && ' · '}
                  {band.test_score_hints}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">
              <strong className="text-[var(--t1)]">{levelLabel}</strong> — 이 영역에서{' '}
              {cefrRange ? `CEFR ${cefrRange}` : `약 ${lvl}단계`} 수준이에요.
            </p>
          ))}
        <p className="mt-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">{confLine}</p>
      </section>

      {/* 맞춤 단어장 (base/comprehensive) */}
      {!isTrack && recommendations.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-[15px] font-[700] text-[var(--t1)]">맞춤 단어장</h2>
          <div className="flex flex-col gap-2">
            {recommendations.map((rec) => (
              <button
                key={rec.set_id}
                onClick={() => router.push(`/library/vocab#set-${rec.set_id}`)}
                className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-left shadow-[var(--sh-sm)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
              >
                <span className="text-[28px]" aria-hidden>
                  {rec.cover_emoji ?? '📒'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[14px] font-[700] text-[var(--t1)]">
                      {rec.title}
                    </span>
                    {REC_LABEL[rec.recommendation_type] && (
                      <span className="rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--on-p-tint)]">
                        {REC_LABEL[rec.recommendation_type]}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block font-body text-[12px] text-[var(--t2)]">
                    {rec.word_count}개 단어
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 개선 방안 */}
      <section className="mb-6 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <Target size={16} className="text-[var(--p)]" aria-hidden /> 개선 방안
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {improvePoints.map((pt, i) => (
            <li key={i} className="flex gap-2 font-body text-[13px] leading-relaxed text-[var(--t2)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--p)]" aria-hidden />
              {pt}
            </li>
          ))}
        </ul>
      </section>

      {/* 진행 방안 */}
      <section className="mb-6 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-[700] text-[var(--t1)]">
          <TrendingUp size={16} className="text-[var(--success)]" aria-hidden /> 진행 방안
        </h2>
        <ol className="mt-3 flex flex-col gap-2">
          {nextPoints.map((pt, i) => (
            <li key={i} className="flex gap-3 font-body text-[13px] leading-relaxed text-[var(--t2)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-full)] bg-[var(--bg3)] font-display text-[11px] font-[700] text-[var(--t2)]">
                {i + 1}
              </span>
              {pt}
            </li>
          ))}
        </ol>
      </section>

      {/* 관심 분야 (base/comprehensive) */}
      {!isTrack && (
        <section className="mb-6">
          <h2 className="mb-1 font-display text-[15px] font-[700] text-[var(--t1)]">
            관심 분야가 있나요?
          </h2>
          <p className="mb-3 font-body text-[12px] text-[var(--t2)]">
            선택하면 관련 단어장을 함께 추천해드려요. (선택)
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {INTEREST_OPTIONS.map((opt) => {
              const selected = interests.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleInterest(opt.key)}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-2 rounded-[var(--r-md)] border-2 p-3 transition-all duration-[var(--dur-normal)] ${
                    selected
                      ? 'border-[var(--p)] bg-[var(--p-light)]'
                      : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--t3)]'
                  }`}
                >
                  <span className="text-[24px]" aria-hidden>
                    {opt.emoji}
                  </span>
                  <span className="font-display text-[12px] font-[600] text-[var(--t1)]">
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 다음 한 걸음 ──
          `/wordvault`(빈 화면)로 보내던 자리다. 진단 → 첫 학습 사이에 결정을 받지 않는
          중간 화면을 두지 않는다: 추천이 있으면 그 세트로 바로 카드 세션, 없으면 오늘 할 일. */}
      {(() => {
        if (isTrack) {
          return (
            <button
              onClick={() => router.push('/diagnostic')}
              className="min-h-[44px] w-full rounded-[var(--r-md)] bg-[var(--p)] px-6 py-4 font-display text-[16px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97]"
            >
              다른 진단 받기
            </button>
          )
        }

        // 1순위 추천 — RPC 가 priority 순으로 준다. 'primary'(딱 맞아요)가 있으면 그것.
        const first =
          recommendations.find((r) => r.recommendation_type === 'primary') ?? recommendations[0]

        if (!first) {
          return (
            <button
              onClick={() => router.push('/hub')}
              className="min-h-[44px] w-full rounded-[var(--r-md)] bg-[var(--p)] px-6 py-4 font-display text-[16px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97]"
            >
              오늘 할 일 보러 가기
            </button>
          )
        }

        return (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => void startWithRecommendation(first)}
              disabled={starting}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-4 font-display text-[16px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden />
                  <span>단어장을 담는 중…</span>
                </>
              ) : (
                <span className="break-keep">
                  「{first.title}」 담고 첫 카드 학습 시작
                </span>
              )}
            </button>
            <p className="break-keep text-center font-body text-[12px] text-[var(--t2)]">
              담은 단어장은 내 단어장에서 언제든 뺄 수 있어요.
            </p>
            <button
              onClick={() => router.push('/hub')}
              disabled={starting}
              className="min-h-[44px] w-full rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-6 font-display text-[14px] font-[600] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              나중에 · 오늘 할 일 보기
            </button>
          </div>
        )
      })()}

      {/* 레벨 안내 팝업 */}
      {levelGuideOpen && (
        <LevelGuideModal
          levels={levels}
          currentLevel={lvl}
          isTrack={isTrack}
          onClose={() => setLevelGuideOpen(false)}
        />
      )}
    </div>
  )
}

// ── 유형별 안내 팝업 (배경 클릭 / X / Esc 닫기) ──
function InfoModal({
  test,
  onClose,
  onStart,
}: {
  test: TestInfo
  onClose: () => void
  onStart: () => void
}) {
  const key = test.test_type === 'track' ? (test.target_track_id ?? 'track') : test.test_type
  const p = TEST_PRESENTATION[key]
  const info = TEST_INFO[key]
  if (!p || !info) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${p.title} 안내`}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[var(--r-2xl)] bg-[var(--bg)] shadow-[var(--sh-xl)] sm:rounded-[var(--r-2xl)]"
      >
        {/* 헤더 밴드 */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--bd)] p-5">
          <div className="flex items-start gap-3">
            <span className="text-[30px] leading-none" aria-hidden>
              {p.emoji}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[17px] font-[700] text-[var(--t1)]">{p.title}</h2>
                {p.recommended && (
                  <span className="rounded-[var(--r-full)] bg-[var(--p)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--on-p)]">
                    추천
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-body text-[11px] text-[var(--t2)]">
                  📝 {test.question_count}문항
                </span>
                <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-1 font-body text-[11px] text-[var(--t2)]">
                  ⏱ 약 {test.estimated_minutes}분
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* 목적 — 강조 박스 */}
          <div className="flex items-start gap-3 rounded-[var(--r-md)] bg-[var(--p-light)] p-4">
            <Target size={18} className="mt-0.5 shrink-0 text-[var(--p)]" aria-hidden />
            <p className="font-display text-[14px] font-[600] leading-snug text-[var(--t1)]">
              {info.summary}
            </p>
          </div>

          {/* 이런 분께 */}
          <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3">
            <Users size={15} className="shrink-0 text-[var(--t2)]" aria-hidden />
            <p className="font-body text-[13px] text-[var(--t2)]">
              <span className="font-[600] text-[var(--t1)]">이런 분께</span> · {p.who}
            </p>
          </div>

          {/* 결과 활용 */}
          <div>
            <h3 className="mb-2 font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
              결과 활용
            </h3>
            <ul className="flex flex-col gap-2">
              {info.usagePoints.map((pt, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 font-body text-[13px] leading-snug text-[var(--t2)]"
                >
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden />
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          {/* 학습 흐름 */}
          <div>
            <h3 className="mb-2 font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t2)]">
              학습 흐름
            </h3>
            <div className="flex items-stretch gap-1">
              {info.steps.map((s, i) => (
                <Fragment key={i}>
                  <span className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[var(--r-md)] bg-[var(--bg2)] px-2 py-2 text-center">
                    <span className="font-display text-[10px] font-[700] text-[var(--p)]">
                      {i + 1}
                    </span>
                    <span className="font-display text-[11px] font-[600] leading-tight text-[var(--t1)]">
                      {s}
                    </span>
                  </span>
                  {i < info.steps.length - 1 && (
                    <ArrowRight
                      size={13}
                      className="shrink-0 self-center text-[var(--t2)]"
                      aria-hidden
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 밴드 */}
        <div className="flex gap-2 border-t border-[var(--bd)] p-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3 font-display text-[14px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
          >
            닫기
          </button>
          <button
            onClick={onStart}
            className="group flex flex-[2] items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-3 font-display text-[14px] font-[700] text-[var(--on-p)] transition-colors hover:bg-[var(--p-hover)]"
          >
            이 진단 시작
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 다차원 레벨 안내 팝업 (vocaflow_levels SSoT — V0~V11, 한국 학제·수능 기준) ──
function LevelGuideModal({
  levels,
  currentLevel,
  isTrack,
  onClose,
}: {
  levels: LevelDef[]
  currentLevel: number | null
  isTrack: boolean
  onClose: () => void
}) {
  const sorted = [...levels].sort((a, b) => a.level - b.level)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="레벨 안내"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[var(--r-2xl)] bg-[var(--bg)] shadow-[var(--sh-xl)] sm:rounded-[var(--r-2xl)]"
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--bd)] p-5">
          <div>
            <h2 className="font-display text-[17px] font-[700] text-[var(--t1)]">레벨 안내</h2>
            <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--t2)]">
              Vocaflow는 어휘를 <strong className="text-[var(--t2)]">V0~V11</strong> 등급으로 나눠요.
              한국 학제·수능·시험 기준에 맞춰 설계됐어요.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* 트랙 레벨 안내 */}
        {isTrack && (
          <p className="border-b border-[var(--bd)] bg-[var(--bg2)] px-5 py-3 font-body text-[12px] leading-relaxed text-[var(--t2)]">
            수능·비즈니스·학술 진단의 <strong className="text-[var(--t1)]">L 레벨</strong>은 같은
            단계 척도를 쓰되, 전체가 아닌{' '}
            <strong className="text-[var(--t1)]">해당 영역 안에서</strong>의 수준을 뜻해요.
          </p>
        )}

        {/* V0~V11 사다리 (SSoT) */}
        <div className="flex flex-col gap-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="p-3 font-body text-[13px] text-[var(--t2)]">레벨 정보를 불러오는 중…</p>
          ) : (
            sorted.map((b) => {
              const active = currentLevel === b.level
              const cefr =
                b.cefr_min && b.cefr_max && b.cefr_min !== b.cefr_max
                  ? `${b.cefr_min}~${b.cefr_max}`
                  : (b.cefr_min ?? '')
              return (
                <div
                  key={b.level}
                  className={`flex items-start gap-3 rounded-[var(--r-md)] border p-3 transition-colors ${
                    active ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-transparent'
                  }`}
                >
                  <span
                    className={`flex h-8 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] font-display text-[12px] font-[700] ${
                      active ? 'bg-[var(--p)] text-[var(--on-p)]' : 'bg-[var(--bg3)] text-[var(--t2)]'
                    }`}
                  >
                    {isTrack ? `L${b.level}` : `V${b.level}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                        {b.korean_name}
                      </span>
                      {cefr && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] text-[var(--t2)]">
                          CEFR {cefr}
                        </span>
                      )}
                      {active && (
                        <span className="rounded-[var(--r-full)] bg-[var(--p)] px-2 py-1 font-display text-[10px] font-[700] text-[var(--on-p)]">
                          현재
                        </span>
                      )}
                    </div>
                    {b.description_ko && (
                      <p className="font-body text-[12px] leading-snug text-[var(--t2)]">
                        {b.description_ko}
                      </p>
                    )}
                    {b.test_score_hints && (
                      <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
                        {b.test_score_hints}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-[var(--bd)] p-4">
          <button
            onClick={onClose}
            className="w-full rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3 font-display text-[14px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
