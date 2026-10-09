// apps/web/src/lib/csat/map/skill-diagnosis.ts
// 기능 단위 직접 확인(verified_diagnosis · student × learning skill) — 계약 A · D-1 결정 v1(2026-10-10 · 사용자 「외부 검토 없이 진행」).
// 정본 VNEXT §10-1 은 verified_diagnosis 단위를 「student × learning skill/axis」로 둔다 — 여기서는 **한 원리(skill)** 만 판정한다(축 전체 판정 아님).
// 「그 skill 만 겨냥한 직접 진단」 = 그 원리의 확인 문항 묶음(FIND 대상). 판정 근거는 독립 첫 시도뿐(합성 · 도움 · 해설 뒤 · 시각 불확실 제외).
//
// 규칙(초안 값 — 정본 관례대로 「Pilot 뒤 조정」 · 상수만 바꾼다):
//   확정  판단 시각 순으로 확인 문항의 독립 첫 시도를 읽다가, 맞힌 문항 없이 서로 다른 문항 VERIFY_ITEMS(2)개가 막힌 시점에 확정
//         (그 전에 한 문항이라도 맞혔으면 확정하지 않는다 — 섞인 결과는 원인 확정이 아니다)
//   CHECK 확정 뒤 · 확정에 쓰지 않은 확인 문항의 독립 첫 시도 — CHECK_ITEMS(2)개를 맞히고 막힌 것이 없으면 해소(resolved)
//         하나라도 막히면 학습 요구가 이어진다(still_needed) · 그 밖은 확인 중(checking)
//   만료  확정 뒤 EXPIRY_DAYS(120)일 안에 해소되지 않으면 만료 — 다시 확인해야 한다(EED §9 의 120일과 같은 값)
// 저장하지 않는다 — 주입한 now 로 조회할 때마다 계산한다. 축 관찰(rule_proxy) · 다른 단계 상태는 바꾸지 않는다.
import { isEligible, type FirstAttempt } from '../../knowledge/effect-signals'

export const VERIFY_ITEMS = 2
export const CHECK_ITEMS = 2
export const EXPIRY_DAYS = 120

export interface SkillTarget {
  itemRef: string
  taskKey: string
}

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
  /** 확정 뒤 기한 안에 해소되지 않음 — 다시 확인 필요 */
  | 'expired'

export interface SkillDiagnosis {
  status: SkillStatus
  /** 처방을 열어도 되는 근거 수준인가 — verified · still_needed 만 */
  verified: boolean
  verifiedAt: string | null
  /** 확정에 쓴 문항 */
  verifiedItems: string[]
  /** CHECK 진행 — 확정에 쓰지 않은 확인 문항의 독립 첫 시도 */
  check: { right: number; wrong: number; need: number; remaining: string[] }
  resolvedAt: string | null
}

const DAY = 86_400_000

const RANK: Record<SkillStatus, number> = { still_needed: 4, verified: 3, expired: 2, resolved: 1, unverified: 0 }

/**
 * 과제 키(원리)마다 따로 판정한다 — 서로 다른 원리의 오답을 한 줄에 합쳐 확정하지 않는다(Codex P1).
 * 한 단계에 원리가 여럿이면 처방을 여는 쪽(still_needed > verified > expired > resolved)을 보인다.
 */
export function skillDiagnosis(targets: readonly SkillTarget[], attempts: readonly SkillAttempt[], now: Date): SkillDiagnosis {
  const byKey = new Map<string, SkillTarget[]>()
  for (const t of targets) byKey.set(t.taskKey, [...(byKey.get(t.taskKey) ?? []), t])
  const results = [...byKey.values()].map((ts) => skillDiagnosisOne(ts, attempts, now))
  return results.sort((a, b) => RANK[b.status] - RANK[a.status])[0] ?? skillDiagnosisOne([], attempts, now)
}

function skillDiagnosisOne(targets: readonly SkillTarget[], attempts: readonly SkillAttempt[], now: Date): SkillDiagnosis {
  const keys = new Set(targets.map((t) => `${t.taskKey}|${t.itemRef}`))
  const items = [...new Set(targets.map((t) => t.itemRef))]
  // 문항을 처음 본 시각 — 단계 · 자격과 무관하게(이미 본 문항은 「미노출」 CHECK 가 아니다 · Codex P1)
  const seenAt = new Map<string, string>()
  for (const a of attempts) {
    if (!keys.has(`${a.taskKey}|${a.itemRef}`) || !a.answeredAt) continue
    const cur = seenAt.get(a.itemRef)
    if (!cur || a.answeredAt < cur) seenAt.set(a.itemRef, a.answeredAt)
  }
  // 문항마다 가장 이른 독립 첫 시도 하나
  const first = new Map<string, { at: string; ok: boolean }>()
  for (const a of attempts) {
    if (a.phase !== 'practice' || !keys.has(`${a.taskKey}|${a.itemRef}`) || !isEligible(a) || a.isCorrect === null || !a.answeredAt) continue
    const cur = first.get(a.itemRef)
    if (!cur || a.answeredAt < cur.at) first.set(a.itemRef, { at: a.answeredAt, ok: a.isCorrect })
  }
  const timeline = [...first.entries()].map(([item, v]) => ({ item, ...v })).sort((x, y) => x.at.localeCompare(y.at) || x.item.localeCompare(y.item))

  const none: SkillDiagnosis = { status: 'unverified', verified: false, verifiedAt: null, verifiedItems: [], check: { right: 0, wrong: 0, need: CHECK_ITEMS, remaining: items }, resolvedAt: null }
  // 확정 — 맞힌 문항 없이 VERIFY_ITEMS 개가 막힌 시점
  const wrongs: string[] = []
  let verifiedAt: string | null = null
  for (const e of timeline) {
    if (e.ok) break
    wrongs.push(e.item)
    if (wrongs.length >= VERIFY_ITEMS) { verifiedAt = e.at; break }
  }
  if (!verifiedAt) return none

  // CHECK — 확정 뒤 · 확정에 쓰지 않은 문항
  const used = new Set(wrongs)
  // 확정 뒤에 **처음 본** 문항만 CHECK — 확정 전에 어떤 단계로든 본 문항은 제외
  const checks = timeline.filter((e) => !used.has(e.item) && e.at > verifiedAt! && (seenAt.get(e.item) ?? e.at) > verifiedAt!)
  const right = checks.filter((e) => e.ok).length
  const wrong = checks.length - right
  const remaining = items.filter((i) => !used.has(i) && !seenAt.has(i))
  const base = { verifiedAt, verifiedItems: wrongs, check: { right, wrong, need: CHECK_ITEMS, remaining } }
  if (wrong === 0 && right >= CHECK_ITEMS) {
    const resolvedAt = checks.filter((e) => e.ok)[CHECK_ITEMS - 1].at
    return { ...base, status: 'resolved', verified: false, resolvedAt }
  }
  // 해소되지 않았으면 기한이 먼저다 — CHECK 에서 막혔어도 기한이 지나면 다시 확인(Codex P1)
  if (now.getTime() - new Date(verifiedAt).getTime() > EXPIRY_DAYS * DAY) return { ...base, status: 'expired', verified: false, resolvedAt: null }
  if (wrong > 0) return { ...base, status: 'still_needed', verified: true, resolvedAt: null }
  return { ...base, status: 'verified', verified: true, resolvedAt: null }
}

/** 학생 화면 문구 — 약점 · 실력 단정 없이 「이 원리 · 이번 확인 기준」으로만 말한다 */
export function skillMessage(d: SkillDiagnosis): string {
  switch (d.status) {
    case 'verified':
      return `서로 다른 확인 문항 ${d.verifiedItems.length}개에서 같은 곳이 막혀 이 원리 연습이 필요하다고 확인했어요(이번 확인 기준). 바로잡기 → 다른 글에 적용하기 → 다시 확인하기 순서로 해 보세요.`
    case 'still_needed':
      return `다시 확인하기에서 아직 막힌 문항이 있어요(${d.check.wrong}개). 바로잡기를 한 번 더 하고 다른 확인 문항으로 다시 확인해요.`
    case 'resolved':
      return `처음 확인 뒤 연습하고, 풀지 않았던 확인 문항 ${d.check.right}개를 혼자 해냈어요. 이 원리는 다시 확인됐어요 — 다음 단계로 넘어가도 돼요. 능력이 늘었다는 판정은 아니에요.`
    case 'expired':
      return `확인한 지 ${EXPIRY_DAYS}일이 지났어요. 지금 상태를 알려면 확인 문항으로 다시 확인해요.`
    default:
      return ''
  }
}
