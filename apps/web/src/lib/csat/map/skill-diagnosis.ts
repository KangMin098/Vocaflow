// apps/web/src/lib/csat/map/skill-diagnosis.ts
// 기능 단위 직접 확인(verified_diagnosis · student × learning skill) — 계약 A · D-1 결정 v1(2026-10-10 · 사용자 「외부 검토 없이 진행」).
// 정본 VNEXT §10-1 은 verified_diagnosis 단위를 「student × learning skill/axis」로 둔다 — 여기서는 **한 원리(skill)** 만 판정한다(축 전체 판정 아님).
// 「그 skill 만 겨냥한 직접 진단」 = 그 원리의 확인 문항 묶음(FIND 대상). 판정 근거는 독립 첫 시도뿐(합성 · 도움 · 해설 뒤 · 시각 불확실 제외).
//
// 규칙(초안 값 — 정본 관례대로 「Pilot 뒤 조정」 · 상수만 바꾼다):
//   확정  판단 시각 순으로 확인 문항의 독립 첫 시도를 읽다가, 맞힌 문항 없이 서로 다른 문항 VERIFY_ITEMS(2)개가 막힌 시점에 확정
//         (그 전에 한 문항이라도 맞혔으면 확정하지 않는다 — 섞인 결과는 원인 확정이 아니다)
//   CHECK 확정 뒤 · 확정에 쓰지 않은 확인 문항의 독립 첫 시도 — 연속 CHECK_ITEMS(2)개를 맞히면 해소(resolved)
//         막히면 학습 요구가 이어진다(still_needed) — 그 뒤 다른 확인 문항 연속 2개를 맞히면 해소(D-8 v1.1 · 2026-10-10)
//   만료  확정 뒤 EXPIRY_DAYS(120)일 안에 해소되지 않으면 만료 — 다시 확인해야 한다(EED §9 의 120일과 같은 값)
// 코드북 조건(ReachPolicy · TASK 의 criterion 문장에서 도출 — T-0088 D4-1 · N3):
//   distinctPassages  해소의 연속 정답은 서로 다른 지문이어야 한다(같은 지문의 다른 문항은 연속을 늘리지 않는다)
//   differentDay      D4-DEC-01: 연속 정답으로 초기 확인을 마친 시각 t0 뒤의 **별도** 재확인 정답이 t0 와 다른 KST 날짜 · 12시간 이상일 때만 해소.
//                     그 전에는 pending_delayed(초기 확인 통과 · 다른 날 재확인 전). 12시간은 Pilot 운영 하한이다
//   지문 정체를 모르는 문항은 서로 다른 지문 조건에서 세지 않는다(문항을 지문으로 대신 세지 않는다 — 판정 근거를 지어내지 않는다)
//   observationOnly   객관식 정오만으로 학습 요구를 확정하지 않는다(E3 「함정 선택만으로 약함 판정 금지」 · R2 「관찰 근거 내역만」)
// 저장하지 않는다 — 주입한 now 로 조회할 때마다 계산한다. 축 관찰(rule_proxy) · 다른 단계 상태는 바꾸지 않는다.
import { isEligible, type FirstAttempt } from '../../knowledge/effect-signals'

export const VERIFY_ITEMS = 2
export const CHECK_ITEMS = 2
export const EXPIRY_DAYS = 120

export interface SkillTarget {
  itemRef: string
  taskKey: string
  /** 지문 정체(같은 지문 세트 문항은 같은 값) — 서로 다른 지문 조건이 있을 때만 쓴다. 그때 없으면 그 문항은 세지 않는다 */
  passageKey?: string | null
}

export interface ReachPolicy {
  distinctPassages?: boolean
  differentDay?: boolean
  observationOnly?: boolean
}

/** 코드북 도달 조건 · 관찰 제한 문장 → 판정 정책(정본 문장이 바뀌면 정책도 따라 바뀐다) */
export function reachPolicyOf(criterion: string): ReachPolicy {
  return {
    distinctPassages: /서로 다른 지문/.test(criterion),
    differentDay: /다른 날/.test(criterion),
    observationOnly: /함정 선택만으로 약함 판정 금지|관찰 근거 내역만/.test(criterion),
  }
}

const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 10)

export interface SkillAttempt extends FirstAttempt {
  itemRef: string
  taskKey: string
  /** 판단 시각(ISO) — 없으면 순서를 알 수 없어 판정에 쓰지 않는다 */
  answeredAt?: string | null
}

export type SkillStatus =
  /** 아직 확정 근거 없음(확인 중 · 섞임 · 필요 없음 포함 — 세부는 findOutcome) */
  | 'unverified'
  /** 직접 확인된 학습 요구 — 처방(REPAIR · TRANSFER · CHECK) 개방 */
  | 'verified'
  /** 확정 뒤 CHECK 에서 다시 막힘 — 학습 요구 계속 */
  | 'still_needed'
  /** 확정 뒤 CHECK 통과 — 이 원리는 다시 확인됐다(다음 단계로) */
  | 'resolved'
  /** D4-DEC-01 — 초기 확인 기준은 통과했지만 다른 날 재확인 전(처방은 닫고 재확인만 남는다) */
  | 'pending_delayed'
  /** 확정 뒤 기한 안에 해소되지 않음 — 다시 확인 필요 */
  | 'expired'

export interface SkillDiagnosis {
  /** Exclusive boundary of the current 120-day episode; null is the initial episode. */
  episodeStart?: string | null
  status: SkillStatus
  /** 처방을 열어도 되는 근거 수준인가 — verified · still_needed 만 */
  verified: boolean
  verifiedAt: string | null
  /** 확정에 쓴 문항 */
  verifiedItems: string[]
  /** CHECK 진행 — 확정에 쓰지 않은 확인 문항의 독립 첫 시도 */
  check: {
    right: number; wrong: number; need: number; remaining: string[]
    /** 다시 확인에서 막힌 문항과 마지막으로 막힌 시각 — 그 뒤의 바로잡기만 센다(lifecycle-evidence) */
    wrongItems?: string[]; lastWrongAt?: string | null
  }
  resolvedAt: string | null
}

const DAY = 86_400_000

const RANK: Record<SkillStatus, number> = { still_needed: 4, verified: 3, expired: 2, pending_delayed: 1.5, resolved: 1, unverified: 0 }
const DELAY_MS = 12 * 3_600_000

/**
 * 과제 키(원리)마다 따로 판정한다 — 서로 다른 원리의 오답을 한 줄에 합쳐 확정하지 않는다(Codex P1).
 * 한 단계에 원리가 여럿이면 처방을 여는 쪽(still_needed > verified > expired > resolved)을 보인다.
 */
export function skillDiagnosis(targets: readonly SkillTarget[], attempts: readonly SkillAttempt[], now: Date, policy: ReachPolicy = {}): SkillDiagnosis {
  const byKey = new Map<string, SkillTarget[]>()
  for (const t of targets) byKey.set(t.taskKey, [...(byKey.get(t.taskKey) ?? []), t])
  const results = [...byKey.values()].map((ts) => skillDiagnosisOne(ts, attempts, now, policy))
  return results.sort((a, b) => RANK[b.status] - RANK[a.status])[0] ?? skillDiagnosisOne([], attempts, now, policy)
}

function skillDiagnosisOne(targets: readonly SkillTarget[], attempts: readonly SkillAttempt[], now: Date, policy: ReachPolicy): SkillDiagnosis {
  // 지문 단위 중복 배제는 서로 다른 지문 조건이 있을 때만(T-0096 Codex F1). 조건이 없으면 서로 다른 **문항**으로 센다(기존 판정 그대로)
  const passageOf = new Map(targets.map((t) => [t.itemRef, policy.distinctPassages ? t.passageKey ?? null : t.itemRef]))
  const keys = new Set(targets.map((t) => `${t.taskKey}|${t.itemRef}`))
  const items = [...new Set(targets.map((t) => t.itemRef))]
  // 문항을 처음 본 시각 — 단계 · 자격 · **과제 키와 무관하게**(다른 과제로 본 문항도 「미노출」 CHECK 가 아니다 · Codex P1)
  const itemSet = new Set(items)
  const seenAt = new Map<string, string>()
  for (const a of attempts) {
    if (!itemSet.has(a.itemRef) || !a.answeredAt) continue
    const cur = seenAt.get(a.itemRef)
    if (!cur || a.answeredAt < cur) seenAt.set(a.itemRef, a.answeredAt)
  }
  // 문항마다 가장 이른 독립 첫 시도 하나
  const first = new Map<string, { at: string; ok: boolean }>()
  for (const a of attempts) {
    // 연습 화면 기록은 직접 확인 근거가 아니다 — 확인 과제를 하지 않고 연습에서만 틀려도 확정되던 결함(Codex P2 · find-policy.v3 와 같은 기준)
    if ((a as { activity?: string | null }).activity === 'practice') continue
    // 본인 판정 — 합성 표시는 빼지 않는다(집단 통계에서만 뺀다 · find-outcome 과 같은 기준 2026-10-10). 독립 첫 시도 조건은 그대로
    //   (5차: 이 차이로 합성 학습자는 v4 지도에서 확정에 닿지 못해 실제 경로 E2E 가 불가능했고, 같은 학습자가 두 화면에서 다른 판정을 받았다)
    if (a.phase !== 'practice' || !keys.has(`${a.taskKey}|${a.itemRef}`) || !isEligible({ ...a, synthetic: false }) || a.isCorrect === null || !a.answeredAt) continue
    const cur = first.get(a.itemRef)
    if (!cur || a.answeredAt < cur.at) first.set(a.itemRef, { at: a.answeredAt, ok: a.isCorrect })
  }
  const timeline = [...first.entries()].map(([item, v]) => ({ item, ...v })).sort((x, y) => x.at.localeCompare(y.at) || x.item.localeCompare(y.item))

  const remaining = items.filter((i) => !seenAt.has(i))
  // 회차(episode) — 확정 → (기한 안) CHECK → 해소 · 계속 · 만료. 만료되면 그 시점부터 새 회차를 연다(재진단 · Codex P1)
  let start = ''
  let last: SkillDiagnosis = { status: 'unverified', verified: false, verifiedAt: null, verifiedItems: [], check: { right: 0, wrong: 0, need: CHECK_ITEMS, remaining }, resolvedAt: null }
  // 관찰 제한 TASK — 객관식 정오로 학습 요구를 확정하지 않는다(관찰 기록 · 확인 진행량은 호출부가 그대로 센다)
  if (policy.observationOnly) return last
  for (let guard = 0; guard < items.length + 1; guard++) {
    // 확정 — 회차 시작 뒤 맞힌 문항 없이 VERIFY_ITEMS 개가 막힌 시점
    const wrongs: string[] = []
    let verifiedAt: string | null = null
    for (const e of timeline) {
      if (e.at <= start) continue
      if (e.ok) break
      wrongs.push(e.item)
      if (wrongs.length >= VERIFY_ITEMS) { verifiedAt = e.at; break }
    }
    if (!verifiedAt) return last.status === 'expired' ? last : { ...last, status: 'unverified', verified: false, verifiedAt: null, verifiedItems: [], resolvedAt: null }

    const deadline = new Date(new Date(verifiedAt).getTime() + EXPIRY_DAYS * DAY).toISOString()
    // CHECK — 확정 뒤 · 기한 안 · 확정에 쓰지 않은 · 확정 뒤에 **처음 본** 문항만
    const used = new Set(wrongs)
    const checks = timeline.filter((e) => !used.has(e.item) && e.at > verifiedAt! && e.at <= deadline && (seenAt.get(e.item) ?? e.at) > verifiedAt!)
    // 판단 시각 순으로 읽는다 — 막힘 없이 CHECK_ITEMS 개를 맞힌 시점에 해소하고 그 회차를 끝낸다(해소 뒤의 시도로 되돌리지 않는다 · Codex P1)
    let right = 0
    let wrong = 0
    let resolvedAt: string | null = null
    // 막힌 뒤에는 바로잡기를 다시 하고 **새로** 확인한다 — 막힌 다음의 연속 정답 CHECK_ITEMS 개로 해소(누적 오답이 영구히 막지 않게 · Codex P2 · D-8 v1.1)
    let streak = 0
    const streakPassages = new Set<string>()
    let t0: string | null = null
    const wrongItems: string[] = []
    let lastWrongAt: string | null = null
    for (const e of checks) {
      if (e.ok) {
        right++
        // 초기 확인을 마친 뒤의 정답 — 다른 날 재확인 조건(t0 와 다른 KST 날짜 · 12시간 이상)을 채우면 해소
        if (t0) {
          // 서로 다른 지문 조건이 있는 TASK 는 지문 정체를 모르는 재확인 정답도 세지 않는다(Codex ④ — 근거를 지어내지 않는다)
          if (policy.distinctPassages && passageOf.get(e.item) == null) continue
          if (kstDay(e.at) !== kstDay(t0) && new Date(e.at).getTime() - new Date(t0).getTime() >= DELAY_MS) { resolvedAt = e.at; break }
          continue
        }
        const p = passageOf.get(e.item) ?? null
        // 서로 다른 지문 조건 — 지문을 모르거나 연속 안에서 이미 쓴 지문이면 연속을 늘리지 않는다(끊지도 않는다)
        if (p !== null && !streakPassages.has(p)) { streak++; streakPassages.add(p) }
      } else { wrong++; streak = 0; streakPassages.clear(); t0 = null; wrongItems.push(e.item); lastWrongAt = e.at }
      if (streak >= CHECK_ITEMS && !t0) {
        if (!policy.differentDay) { resolvedAt = e.at; break }
        t0 = e.at // 초기 확인 완료 — 이 정답을 지연 재확인으로 함께 쓰지 않는다
      }
    }
    const base = { episodeStart: start || null, verifiedAt, verifiedItems: wrongs, check: { right, wrong, need: CHECK_ITEMS, remaining: remaining.filter((i) => !used.has(i)), wrongItems, lastWrongAt } }
    if (resolvedAt) return { ...base, status: 'resolved', verified: false, resolvedAt }
    // 해소되지 않았고 기한이 지났으면 만료 → 기한 뒤의 시도로 새 회차(그 시도가 없으면 만료로 끝)
    if (now.toISOString() > deadline) {
      last = { ...base, status: 'expired', verified: false, resolvedAt: null }
      start = deadline
      continue
    }
    if (t0) return { ...base, status: 'pending_delayed', verified: false, resolvedAt: null }
    if (wrong > 0) return { ...base, status: 'still_needed', verified: true, resolvedAt: null }
    return { ...base, status: 'verified', verified: true, resolvedAt: null }
  }
  return last
}

/** 학생 화면 문구 — 약점 · 실력 단정 없이 「이 원리 · 이번 확인 기준」으로만 말한다 */
export function skillMessage(d: SkillDiagnosis): string {
  switch (d.status) {
    case 'verified':
      return `서로 다른 확인 문항 ${d.verifiedItems.length}개에서 같은 곳이 막혀 이 원리 연습이 필요하다고 확인했어요(이번 확인 기준). 바로잡기 → 다른 글에 적용하기 → 다시 확인하기 순서로 해 보세요.`
    case 'still_needed':
      return `다시 확인하기에서 아직 막힌 문항이 있어요(${d.check.wrong}개). 바로잡기를 한 번 더 하고 다른 확인 문항으로 다시 확인해요.`
    case 'resolved':
      // LM-G1.1 — 판정(독립 CHECK 연속 정답)은 그대로. 문구는 그 근거만 말한다: 바로잡기 · 적용을 했는지는 이 판정이 보지 않으므로 「연습하고」 라고 하지 않는다.
      //   유효 기간(EXPIRY_DAYS)은 다시 확인할 때를 알리는 기한이지 오래 기억했다는(지연 확인) 증거가 아니다
      return `처음 확인 뒤, 풀지 않았던 확인 문항 ${d.check.right}개를 혼자 해냈어요. 이번 확인 기준으로는 다시 확인됐어요 — 다음 단계로 넘어가도 돼요. 능력이 늘었다는 판정은 아니에요.`
    case 'pending_delayed':
      return `서로 다른 확인 문항으로 다시 확인했어요. 이 원리는 다른 날 한 번 더 혼자 확인하면 확인이 끝나요(12시간 이상 · 다른 날).`
    case 'expired':
      return `확인한 지 ${EXPIRY_DAYS}일이 지났어요. 지금 상태를 알려면 확인 문항으로 다시 확인해요.`
    default:
      return ''
  }
}
