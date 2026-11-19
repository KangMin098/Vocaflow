// apps/web/src/lib/csat/map/v62/__tests__/home-focus.test.ts
// T-0079 — 홈 첫 제안 = 지도와 같은 판정: 시험 기록 0 이어도 직접 확인이 있으면 「기록 없음」이 아니다 · 원장 못 읽음 = 오류(기록 없음 아님)
//   Codex NEXT-HOME-MAP-ALIGNMENT probe(1 fail · 2 pass) 이식(fixture 는 그 probe 의 compose 데이터 그대로) + 상태 대조
import { describe, expect, it } from 'vitest'

import { pickHomeSuggestion } from '../../../home-suggestion'
import { DEFAULT_MAP_SETTINGS } from '../../load'
import { mapProgressOf } from '../../home-progress'
import { composeV4 } from '../../v4/compose'
import { homeFocusOf, homeMapStateOf } from '../home-focus'

const NOW='2026-10-21T00:00:00Z',key='authored-central-meaning',task='r.central_meaning';
const first=(i:number)=>({attemptId:String(i),sessionId:'s'+i,userId:'fixture',itemRef:'authored:probe-ind-'+i,taskKey:key,phase:'practice',activity:'theater',isCorrect:false,synthetic:false,helpLevel:'independent',afterViewedFirst:false,afterExplanation:false,timingUncertain:false,answeredAt:`2026-10-0${i}T00:00:00Z`,contentHash:'h',expectedContentHash:'h'});
const f=[first(1),first(2)],guide={attemptId:'3',itemRef:'authored:probe-guide',taskKey:key,phase:'practice',activity:'practice',isCorrect:true,answeredAt:'2026-10-03T00:00:00Z',receivedAt:'2026-10-03T00:00:01Z',repairRole:'guided_practice'};
const link=(ref:string)=>({target:ref,href:'/csat/learn/'+ref.slice(9)+'?d=fixture',label:ref,taskKey:key});
function data(o:Record<string,unknown>={}){return{now:NOW,settings:DEFAULT_MAP_SETTINGS,practiceLinks:{[task]:{href:'/',label:'fixture',itemId:'probe-ind-1',target:f[0].itemRef,taskKey:key,confirm:f.map(x=>link(x.itemRef))}},findAttempts:f,lifecycleActivity:[...f,guide],instrumentHashes:{},model:{goal:80,goalSet:true,lineRefItems:{},nodes:{}},v4:{sessions:[],proxyCovers:[],refItems:[],transferItems:{[key]:2},transferTargets:{[key]:[link('authored:tr-1'),link('authored:tr-2')]},repairTargets:{[key]:[{...link(guide.itemRef),role:'guided_practice'}]},saved:{status:'installed',goalVersionId:10,byTemplate:{}}},...o} as never}
const suggestion = (d: any) => { const p = mapProgressOf(d); return pickHomeSuggestion({ map: homeMapStateOf(d), focusKind: homeFocusOf(d).kind, returned: false, activeSet: false, mapProgress: { check: !!p.check, plan: !!p.plan } }) } // eslint-disable-line @typescript-eslint/no-explicit-any

describe('홈 첫 제안 · 지도 읽기 상태(T-0079)', () => {
  it('반례 — 시험 기록 0 · 직접 확인 있음 → no_records 아님(지도 다음 행동)', () => {
    const d = data()
    expect(composeV4(d, { score: 80, set: true })!.asIs.tasks['r.central_meaning'].basis).toBe('direct_check')
    expect(homeFocusOf(d).kind).not.toBe('record')
    expect(suggestion(d)).not.toBe('no_records')
  })
  it('목표 없음 = goal · 읽힌 빈 원장(진짜 첫 사용자) = no_records 유지', () => {
    const d = data() as any; d.model = { ...d.model, goalSet: false } // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(suggestion(d)).toBe('goal')
    expect(suggestion(data({ findAttempts: [], lifecycleActivity: [] }))).toBe('no_records')
  })
  it('현대 DTO 원장 undefined = 오류(no_records · records_only 아님) · 보류 = withheld · null = preparing · 보류 판정 실패 = error', () => {
    for (const o of [{ findAttempts: undefined }, { lifecycleActivity: undefined }]) {
      const d = data(o)
      expect(homeMapStateOf(d)).toBe('error')
      expect(suggestion(d)).toBe('error')
    }
    expect(homeMapStateOf(data({ heldGate: 'held' }))).toBe('withheld')
    expect(homeMapStateOf(data({ heldGate: 'failed' }))).toBe('error')
    expect(homeMapStateOf(null)).toBe('preparing')
    expect(homeMapStateOf(data({ findAttempts: [], lifecycleActivity: [] }))).toBe('ok')
  })
  it('간접 근거만(시험 기록 0 · 직접 확인 없음) = record 그대로(직접 확인으로 승격 안 함)', () => {
    expect(homeFocusOf(data({ findAttempts: [], lifecycleActivity: [] })).kind).toBe('record')
  })
})
