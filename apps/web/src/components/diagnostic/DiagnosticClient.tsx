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

  const [phase, setPhase] = useState<Phase>('start')
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

  async function startTest(test: TestInfo) {
    setError(null)
    setSelectedTest(test)
    const { data, error: qErr } = await supabase
      .from('vrl_diagnostic_questions')
      .select('id, word, target_v_level, target_track_level, display_order')
      .eq('test_id', test.id)
      .order('display_order', { ascending: true })
    if (qErr || !data) {
      setError(qErr?.message ?? '문항을 불러올 수 없어요')
      return
    }
    setQuestions(data as Question[])
    setCurrentIdx(0)
    setResponses([])
    setPhase('question')
  }

  function handleAnswer(knew: boolean) {
    const q = questions[currentIdx]
    if (!q) return
    const next: Response[] = [...responses, { question_id: q.id, knew }]
    setResponses(next)
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

    const rpcName =
      selectedTest.test_type === 'track'
        ? 'analyze_and_apply_track_diagnostic_result'
        : selectedTest.test_type === 'comprehensive'
          ? 'analyze_and_apply_comprehensive_diagnostic_result'
          : 'analyze_and_apply_diagnostic_result'

    const { data: applyData, error: applyErr } = await supabase.rpc(rpcName, {
      p_result_id: insertData.id,
    })

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
          <p className="font-body text-[var(--error)]">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setPhase('start')
            }}
            className="mt-3 font-display text-[12px] font-[600] text-[var(--p)] underline"
          >
            처음으로
          </button>
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
        <div className="rounded-[var(--r-2xl)] bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)] p-6 text-[var(--ti)] shadow-[var(--sh-md)]">
          <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--active)] px-2.5 py-1 font-display text-[11px] font-[700] text-[var(--ti)]">
            ★ 처음이라면 여기서 시작
          </span>
          <h2 className="mt-3 font-display text-[24px] font-[800] leading-tight">{p.title}</h2>
          <p className="mt-1.5 font-body text-[14px] leading-relaxed opacity-90">
            목표가 뚜렷하지 않다면, 이 진단 하나로 충분해요.
          </p>
          <p className="mt-3 inline-block rounded-[var(--r-full)] bg-white/15 px-2.5 py-1 font-body text-[12px]">
            {t.question_count}문항 · 약 {t.estimated_minutes}분
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => void startTest(t)}
              className="group flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--ti)] px-5 py-3 font-display text-[15px] font-[700] text-[var(--p)] shadow-[var(--sh-sm)] transition-transform hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--p)]"
            >
              진단 시작
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
            <button
              onClick={() => setInfoTest(t)}
              className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-white/40 px-4 py-3 font-display text-[14px] font-[600] text-[var(--ti)] transition-colors hover:bg-white/10"
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
          className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3.5 shadow-[var(--sh-sm)] transition-colors hover:border-[var(--p)]"
        >
          <span className="text-[22px] leading-none" aria-hidden>
            {p.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-[700] text-[var(--t1)]">{goal}</p>
            <p className="truncate font-body text-[11px] text-[var(--t3)]">
              {p.title} · {t.question_count}문항 · {t.estimated_minutes}분
            </p>
          </div>
          <button
            onClick={() => setInfoTest(t)}
            aria-label={`${goal} 안내`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <Info size={16} />
          </button>
          <button
            onClick={() => void startTest(t)}
            className="group inline-flex shrink-0 items-center gap-1 rounded-[var(--r-md)] bg-[var(--bg3)] px-3.5 py-2 font-display text-[12px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--p)] hover:text-[var(--ti)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
          <h1 className="font-display text-[28px] font-[800] text-[var(--t1)] md:text-[32px]">
            어휘 진단
          </h1>
          <p className="mt-3 font-body text-[15px] leading-relaxed text-[var(--t2)]">
            단어를 보고 <strong className="text-[var(--t1)]">안다/모른다</strong>만 고르면 돼요.
            3~6분이면 끝나고, <strong className="text-[var(--t1)]">언제든 다시</strong> 받을 수
            있어요.
          </p>
        </header>

        {/* 지난 결과 — 컴팩트 요약 */}
        {lastLevel && (
          <div className="mb-6 flex items-center justify-between rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
            <span className="flex items-center gap-1 font-body text-[13px] text-[var(--t2)]">
              지난 결과{' '}
              <strong className="font-display text-[var(--t1)]">V{lastLevel.level}</strong>
              <button
                onClick={() => setLevelGuideOpen(true)}
                aria-label="레벨 안내 보기"
                className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--p)]"
              >
                <Info size={13} aria-hidden />
              </button>
              <span className="text-[var(--t3)]">· {relativeTime(lastLevel.when)}</span>
            </span>
            <button
              onClick={() => router.push('/diagnostic/history')}
              className="font-display text-[12px] font-[600] text-[var(--p)] hover:underline"
            >
              기록 보기
            </button>
          </div>
        )}

        {/* 진단 선택 — 추천 기본값 부각(default effect) + 목표 기반 분기(means-end) */}
        {loadingTests ? (
          <div className="flex items-center gap-2 font-body text-[13px] text-[var(--t3)]">
            <Loader2 size={14} className="animate-spin" /> 진단 목록 불러오는 중…
          </div>
        ) : tests.length === 0 ? (
          <p className="font-body text-[13px] text-[var(--t3)]">사용 가능한 진단이 없어요.</p>
        ) : (
          <>
            {primary && renderHero(primary)}

            {secondary.length > 0 && (
              <section aria-label="목표별 진단" className="mt-7">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-display text-[12px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
                    또는, 목표가 분명하다면
                  </span>
                  <span className="h-px flex-1 bg-[var(--bd)]" aria-hidden />
                </div>
                <div className="flex flex-col gap-2.5">{secondary.map(renderGoal)}</div>
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
          <div className="mb-2 flex items-center justify-between font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
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
          <p className="font-english text-[48px] font-[600] leading-tight text-[var(--t1)]">
            {q.word}
          </p>
          <p className="mt-3 font-body text-[12px] text-[var(--t3)]">이 단어의 뜻을 알고 있나요?</p>
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
            className="flex items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-6 py-4 font-display text-[16px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
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
      <header className="mb-6 rounded-[var(--r-xl)] bg-gradient-to-br from-[var(--p-dark)] to-[var(--p)] p-8 text-center text-[var(--ti)] shadow-[var(--sh-md)]">
        <p className="font-body text-[14px] opacity-85">진단 완료 · 내 수준은</p>
        <p className="mt-1 font-display text-[56px] font-[800] leading-none text-[var(--active)]">
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
          className="mt-4 inline-flex items-center gap-1 rounded-[var(--r-full)] border border-white/40 px-3 py-1.5 font-display text-[12px] font-[600] text-[var(--ti)] transition-colors hover:bg-white/10"
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
                <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
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
                onClick={() => router.push(`/library/vocab#set-${rec.slug}`)}
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
                      <span className="rounded-[var(--r-full)] bg-[var(--p-light)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--p)]">
                        {REC_LABEL[rec.recommendation_type]}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block font-body text-[12px] text-[var(--t3)]">
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
            <li key={i} className="flex gap-2.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">
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
          <p className="mb-3 font-body text-[12px] text-[var(--t3)]">
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
                  className={`flex flex-col items-center gap-1.5 rounded-[var(--r-md)] border-2 p-3 transition-all duration-[var(--dur-normal)] ${
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

      <button
        onClick={() => router.push(isTrack ? '/diagnostic' : '/wordvault')}
        className="w-full rounded-[var(--r-md)] bg-[var(--p)] px-6 py-4 font-display text-[16px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--p-hover)] active:scale-[0.97]"
      >
        {isTrack ? '다른 진단 받기' : '내 단어장으로 가기'}
      </button>

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
                  <span className="rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--ti)]">
                    추천
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-body text-[11px] text-[var(--t2)]">
                  📝 {test.question_count}문항
                </span>
                <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-body text-[11px] text-[var(--t2)]">
                  ⏱ 약 {test.estimated_minutes}분
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* 목적 — 강조 박스 */}
          <div className="flex items-start gap-2.5 rounded-[var(--r-md)] bg-[var(--p-light)] p-3.5">
            <Target size={18} className="mt-0.5 shrink-0 text-[var(--p)]" aria-hidden />
            <p className="font-display text-[14px] font-[600] leading-snug text-[var(--t1)]">
              {info.summary}
            </p>
          </div>

          {/* 이런 분께 */}
          <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] px-3.5 py-2.5">
            <Users size={15} className="shrink-0 text-[var(--t3)]" aria-hidden />
            <p className="font-body text-[13px] text-[var(--t2)]">
              <span className="font-[600] text-[var(--t1)]">이런 분께</span> · {p.who}
            </p>
          </div>

          {/* 결과 활용 */}
          <div>
            <h3 className="mb-2 font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
              결과 활용
            </h3>
            <ul className="flex flex-col gap-1.5">
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
            <h3 className="mb-2 font-display text-[11px] font-[700] uppercase tracking-[0.06em] text-[var(--t3)]">
              학습 흐름
            </h3>
            <div className="flex items-stretch gap-1">
              {info.steps.map((s, i) => (
                <Fragment key={i}>
                  <span className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--r-md)] bg-[var(--bg2)] px-1.5 py-2 text-center">
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
                      className="shrink-0 self-center text-[var(--t4)]"
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
            className="group flex flex-[2] items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-3 font-display text-[14px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)]"
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
            <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--t3)]">
              Vocaflow는 어휘를 <strong className="text-[var(--t2)]">V0~V11</strong> 등급으로 나눠요.
              한국 학제·수능·시험 기준에 맞춰 설계됐어요.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-full)] text-[var(--t3)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
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
            <p className="p-3 font-body text-[13px] text-[var(--t3)]">레벨 정보를 불러오는 중…</p>
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
                  className={`flex items-start gap-3 rounded-[var(--r-md)] border p-2.5 transition-colors ${
                    active ? 'border-[var(--p)] bg-[var(--p-light)]' : 'border-transparent'
                  }`}
                >
                  <span
                    className={`flex h-8 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] font-display text-[12px] font-[800] ${
                      active ? 'bg-[var(--p)] text-[var(--ti)]' : 'bg-[var(--bg3)] text-[var(--t2)]'
                    }`}
                  >
                    {isTrack ? `L${b.level}` : `V${b.level}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                        {b.korean_name}
                      </span>
                      {cefr && (
                        <span className="rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t2)]">
                          CEFR {cefr}
                        </span>
                      )}
                      {active && (
                        <span className="rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-0.5 font-display text-[10px] font-[700] text-[var(--ti)]">
                          현재
                        </span>
                      )}
                    </div>
                    {b.description_ko && (
                      <p className="font-body text-[12px] leading-snug text-[var(--t3)]">
                        {b.description_ko}
                      </p>
                    )}
                    {b.test_score_hints && (
                      <p className="font-body text-[11px] leading-snug text-[var(--t4)]">
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
