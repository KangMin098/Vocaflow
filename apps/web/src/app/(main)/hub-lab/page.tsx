// apps/web/src/app/(main)/hub-lab/page.tsx
//
// 허브 재설계 랩 — 진입면 후보를 **실데이터로** 나란히 놓고 고르는 자리.
//
// 왜 (main) 안인가: /dev 아래에 두면 사이드바·StatusRibbon 없이 렌더돼서
// "본 화면보다 넓고 조용해 보이는" 착시가 생긴다. 후보를 본 화면과 같은 셸에서
// 찍어야 점수가 의미를 갖는다. 링크는 어디에도 걸지 않는다(주소를 아는 사람만 들어온다).
//
// 후보 — 셋은 취향이 아니라 **답하는 질문**이 다르다:
//   a — 오늘 하나 (Single-Focus)   : "지금 뭘 하지"     · 처방 5블록 중 하나만 무대에
//   b — 학습 지형도 (Spatial Map)  : "나는 어디 있나"   · Stage × Memory 교차 격자
//   c — 살아있는 서재 (Ambient)    : "무엇을 배우고 있나" · 단어 하나가 지면의 주인공
//
// 쿼리: `?v=a|b|c` · `?t=dawn|morning|afternoon|evening|night` (c 의 시각 톤 강제 — 랩 전용)
//
// 데이터는 /hub 과 동일 경로를 쓴다 — 목업을 넣는 순간 이 랩은 판정 도구가 아니게 된다.

import { Screen } from '@/components/ui/ios'
import { fetchStudyPlanItems } from '@/lib/learner/plan-actions'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { fetchReadingRoom } from '@/lib/learner/reading-room-actions'
import { fetchLearningTerrain } from '@/lib/learner/terrain-actions'

import { LabBar } from './LabBar'
import { VariantA } from './_variants/VariantA'
import { VariantB } from './_variants/VariantB'
import { VariantC, type RoomTime } from './_variants/VariantC'
import { VariantD } from './_variants/VariantD'
import { VariantG } from './_variants/VariantG'

export const metadata = {
  title: '허브 랩',
  description: '진입면 후보 비교 (내부용)',
}

type Variant = 'a' | 'b' | 'c' | 'd' | 'g'

const VARIANTS: { key: Variant; label: string; caption: string }[] = [
  { key: 'a', label: 'A · 오늘 하나', caption: '진입면은 "지금 할 단 하나"' },
  { key: 'b', label: 'B · 학습 지형도', caption: 'Stage × Memory 교차를 지형으로' },
  { key: 'c', label: 'C · 살아있는 서재', caption: '단어가 지면의 주인공 · 시각에 반응' },
  { key: 'd', label: 'D · 서재 + 오늘', caption: 'C 지면 + A 흐름 합성' },
  { key: 'g', label: 'G · 관문 첫 줄', caption: '복귀 4상태 — 본 화면에선 안 보이는 것' },
]

/** KST 오늘 요일 1=월..7=일. */
function kstWeekday(): number {
  const day = new Date(Date.now() + 9 * 3_600_000).getUTCDay()
  return day === 0 ? 7 : day
}

/**
 * KST 시각대 — 후보 C 의 지면 톤을 정한다.
 * 서버에서 계산해 내려보낸다. 클라이언트에서 `new Date()` 로 정하면 SSR 결과와 달라져
 * 하이드레이션 불일치가 나고, 그 순간 지면 색이 한 번 튄다.
 */
function kstRoomTime(override?: string): RoomTime {
  // 랩 전용 강제 — 시간대 반응은 그 시각이 되기 전엔 검증할 수 없다. 캡처가 하루를
  // 기다릴 수는 없으므로 `?t=night` 로 강제한다. 본 화면에 이식할 때는 따라가지 않는다.
  const forced = ['dawn', 'morning', 'afternoon', 'evening', 'night'] as const
  if (override && (forced as readonly string[]).includes(override)) return override as RoomTime

  const hour = new Date(Date.now() + 9 * 3_600_000).getUTCHours()
  if (hour < 6) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export default async function HubLabPage({
  searchParams,
}: {
  searchParams: { v?: string; t?: string }
}) {
  const active: Variant = (['a', 'b', 'c', 'd', 'g'] as const).includes(searchParams.v as Variant)
    ? (searchParams.v as Variant)
    : 'a'

  // 후보마다 필요한 데이터가 다르다. 넷을 항상 부르면 지형 계산(learning_records 전량)이
  // A 를 볼 때도 돌아 캡처가 느려지고, 그 느려짐이 "디자인이 무겁다" 로 잘못 읽힌다.
  const needsToday = active === 'a' || active === 'd'
  const needsRoom = active === 'c' || active === 'd'

  const [planItems, prescription, terrain, room] = await Promise.all([
    active === 'a' ? fetchStudyPlanItems() : Promise.resolve([]),
    needsToday ? fetchTodayPrescription() : Promise.resolve(null),
    active === 'b' ? fetchLearningTerrain() : Promise.resolve(null),
    needsRoom ? fetchReadingRoom() : Promise.resolve(null),
  ])

  const today = kstWeekday()
  const hasTodayPlan = planItems.some((i) => i.weekdays.includes(today))

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        <LabBar variants={VARIANTS} active={active} />

        {active === 'a' && (
          <VariantA prescription={prescription} hasTodayPlan={hasTodayPlan} />
        )}

        {active === 'b' && <VariantB terrain={terrain} />}

        {/* G 는 실데이터를 쓰지 않는다 — 시간을 되돌릴 수 없어 상태를 합성한다(VariantG 주석). */}
        {active === 'g' && <VariantG />}

        {active === 'c' && <VariantC room={room} time={kstRoomTime(searchParams.t)} />}

        {active === 'd' && (
          <VariantD
            room={room}
            prescription={prescription}
            time={kstRoomTime(searchParams.t)}
          />
        )}
      </div>
    </Screen>
  )
}
