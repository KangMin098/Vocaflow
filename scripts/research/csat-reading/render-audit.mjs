// scripts/research/csat-reading/render-audit.mjs
// Regenerate structural audit from measured manifests; no semantic labels inferred from types.
import fs from 'node:fs'
const dir='docs/research/csat-reading'
const read=f=>JSON.parse(fs.readFileSync(`${dir}/data/${f}`,'utf8'))
const s=read('audit-summary.json'),rows=read('item-manifest.json'),held=read('held-ledger.json'),drift=read('legacy-input-drift.json')
const count=(a,f)=>a.filter(f).length
const expected=[]
for(let year=2014;year<=2026;year++)for(const form of year===2014?['A','B']:[null]){
 expected.push({year,month:11,form,kind:'suneung'})
 for(const month of [6,9])expected.push({year,month,form,kind:'mock'})
}
for(const e of expected)e.observed=s.by_exam.find(r=>r.year===e.year&&r.month===e.month&&r.form===e.form&&r.kind===e.kind)?.id??null
const missing=expected.filter(e=>!e.observed)
const manifest={as_of:s.as_of,method:'expected regular June/September and main examination booklets, 2014 A/B separate; official complete PDF catalogue not independently traversed',booklets:expected,expected_count:expected.length,observed_in_scope_count:expected.length-missing.length,missing_count:missing.length,reading_count_if_templates_hold:expected.reduce((n,e)=>n+(e.year===2014?23:28),0),missing_reading_count_if_templates_hold:missing.reduce((n,e)=>n+(e.year===2014?23:28),0)}
// Included in the existing audit object to avoid a second competing denominator ledger.
s.expected_inventory=manifest;fs.writeFileSync(`${dir}/data/audit-summary.json`,JSON.stringify(s,null,2)+'\n')
const yearTable=Array.from({length:13},(_,i)=>2014+i).map(y=>{
 const rs=rows.filter(r=>r.school_year===y);return `| ${y}${y===2014?' (A/B 별도)':''} | ${count(rs,r=>r.kind==='suneung')} | ${count(rs,r=>r.kind==='mock'&&r.month===6)} | ${count(rs,r=>r.kind==='mock'&&r.month===9)} | ${count(rs,r=>r.public_v3)} | ${count(rs,r=>!r.public_v3)} |`
}).join('\n')
const typeTable=Object.entries(s.by_type).map(([type,n])=>{
 const rs=rows.filter(r=>r.set!=='out_of_scope'&&r.type===type);return `| ${type} | ${n} | ${count(rs,r=>r.kind==='suneung')} | ${count(rs,r=>r.kind==='mock')} | ${count(rs,r=>!r.public_v3)} |`
}).join('\n')
const text=`# 입력·기존 연구 자산 감사

기준 ${s.as_of}. 생성: \`node scripts/research/csat-reading/render-audit.mjs\`. 숫자는 현재 DB 조회 및 파일 직접 계산이다. 원문 전문은 로컬 전용이며 해시·ID만 추적한다. 이것은 입력·구조 감사이고 전수 의미분류 결과가 아니다.

## 연구 분모

| 집합 | 문항 | 해석 |
|---|---:|---|
| 보유 평가원 읽기 | ${s.all_reading} | 학평 제외; 2027 모평 포함 |
| 2014~2026 연구 범위 | ${s.research_reading} | 본시험 ${s.by_kind.suneung}, 모평 ${s.by_kind.mock} |
| 범위 밖 | ${s.out_of_scope} | M2706; 이번 연구 분모에서 제외 |
| 발견 2014~2024 | ${s.by_set.discovery} | 파일럿/원리 후보 도출 |
| 검증 2025~2026 | ${s.by_set.validation} | 새 연구 내 전향적 분할; 기존 AI 연구에는 이미 사용됨 |
| 공개 v3 (전 보유) | ${s.public_v3_all} | 프로그램의 verified 라벨이며 학문적 전문가 검증이 아님 |
| 공개 v3 (연구 범위) | ${s.public_v3_scope} | 기존 분석은 증거 후보, 원문 확인 대체 불가 |
| 보류 | ${s.held_scope} | 정본에 승격하지 않음 |

현재 본시험은 2014 A/B 및 2015~2026의 14책자를 보유한다. 모평은 요청 범위에서 14책자만 보유한다. 정기 시험 구조로 만든 기대 목록은 본시험14/모평28이며 모평14책자가 빠져 있다. 기대 책자 구조는 [2014 채점 공식 Q&A](https://www.korea.kr/briefing/policyBriefingView.do?newsId=148770380)와 [2015 영어 통합형 공식 자료](https://moe.go.kr/boardCnts/view.do?boardID=339&boardSeq=57553&lev=0&m=02&opType=N&page=80&s=moe)로 체제 구분을 확인했다. **공식 기출 게시판의 첨부 목록 전체를 독립적으로 대조한 결과는 아니다.** 2014읽기23/2015이후28이라는 책자 틀을 누락 모평에도 적용하면 기대 읽기1146/누락372다. 이 값은 조건부 산술이며 누락 PDF 직접 계수로 확정하지 않았다.

누락 후보: ${missing.map(e=>`${e.year}학년도 ${e.month}월${e.form?' '+e.form+'형':''}`).join(', ')}.

## 연도·기관

학년도와 시행연도는 다르다(예: 2026학년도 수능은 2025년 시행). 2014 A/B는 소재·언어복잡성·유형을 달리 설계했으므로 [교육부 공식 출제경향](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=339&boardSeq=51277&lev=0&m=020101&opType=N&page=106&s=moe)의 범위 구분을 유지한다. 초기 모평 누락 때문에 기관×연도 변화의 균형 비교를 할 수 없다.

| 학년도 | 본시험 | 6월 | 9월 | 공개 v3 | 보류 |
|---|---:|---:|---:|---:|---:|
${yearTable}

## 유형 분포 — 문항수

유형은 저장된 발문 분류이다. 이 표에서 담화 종류나 추론 수준을 자동 추정하지 않는다.

| 유형 | 합계 | 본시험 | 모평 | 보류 |
|---|---:|---:|---:|---:|
${typeTable}

## 문항과 지문

번호 묶음으로 선언한 공유지문 후보는 ${s.unique_declared_passage_groups}개다. 원문해시가 다른 장문 묶음 ${s.group_hash_conflicts.length}개는 ${s.group_hash_conflicts.map(x=>x.group).join(', ')}다. PDF 감사에서 같은 [41~42] 제시문에 대응하나 저장된 문항별 보기에서는 빈칸표시 손실/보기 머리 오염이 있는 것을 확인했다. **단순 동일 문자열 수를 독립 지문수로 쓰지 않는다.** 묶음 수는 원문 단위 감사 완료 전 후보 분모다. 2014 A/B에는 동일 정규화 본문 3쌍(2014A#24↔2014B#23, #32↔#29, #35↔#31)이 있어 출제 사건과 독립 본문 군집도 구분해야 한다.

DB 본문을 새로 읽은 스냅샷과 DB SHA256의 불일치는 ${s.db_mismatch.length}개다. 이전 공유 워크스페이스 코퍼스와 현재 본문이 다른 것은 ${drift.length}개이며 공백 정규화만으로 같아지는 것은 ${count(drift,r=>r.whitespace_normalized_equal)}개다. 이는 버전 차이이지 ${drift.length}개가 오류라는 뜻이 아니다. 현재 원문과 과거 AI 분석의 결속은 별도로 확인해야 한다.

## 16보류와 누락 편향

| 유형 | 보류 | 연구 범위 유형 문항 | 보류 비율 |
|---|---:|---:|---:|
${Object.entries(s.held_by_type).map(([t,n])=>`| ${t} | ${n} | ${s.by_type[t]} | ${(100*n/s.by_type[t]).toFixed(1)}% |`).join('\n')}

보류는 주로 기존 문장 번호/인용의 불일치다. 심경은 ${s.held_by_type['R-MOOD']}/${s.by_type['R-MOOD']}이 제외되므로 공개 v3만 센 분포는 서사·심경 과제를 과소대표할 수 있다. 자세한 ID·원장 파일·원래 메모 해시는 held-ledger.json에 있다. 독립 원문 대조로 보류 원인이 해소되어도 기존 v3 공개 승인을 이 연구에서 변경하지 않는다.

## 기존 비교 쌍과 조건부 원리

| 자료 | 보유 전체 | 양쪽이 연구 범위인 것 |
|---|---:|---:|
| 공개 비교쌍 | ${s.pairs_all} | ${s.pairs_both_scope} |
| bounded 원리 객체 | ${s.principle_pair_objects} | ${s.principle_pairs_scope} |

${Object.entries(s.pairs_kind).map(([kind,n])=>`- ${kind}: 전체 ${n} / 연구 범위 ${s.pairs_kind_scope[kind]||0}`).join('\n')}

110은 비교쌍에 붙은 조건부 원리 객체이며 서로 다른 문구도 110개다. 원리가 독립적으로 110회 재현되었다거나 110개 능력이 검증되었다는 뜻은 아니다. same_structure=${s.pairs_kind.same_structure}, boundary=${s.pairs_kind.boundary}, contrast=${s.pairs_kind.contrast}인 편중이 있고, ${s.pairs_all-s.pairs_both_scope}쌍은 범위 밖 M2706 문항을 포함한다. 쌍의 양 끝이 반복되므로 749쌍을 749 독립 증거로 간주할 수 없다. 또한 contrast는 비교 자료의 라벨이지 지문의 대립 관계를 뜻하지 않는다.

## 확인 수준과 보안

모든774문항은 현재 DB의 본문·발문·정답·유형 해시와 대조한 저장 입력이다. PDF와 형별 정답표의 직접 대조는 파일럿부터 진행하며 전체774가 공식 원문 검증을 마쳤다는 뜻은 아니다. source-audit.json에 실제 수준과 미해결을 기록한다. 일부 정답표 이름의 PDF는 듣기대본이다. 파일명·body_ok·AI pass는 이 확인을 대체하지 못한다.

메타데이터·분석 산문만 연구 브랜치에 저장한다. 전문·보기·PDF는 gitignore local/. DB 쓰기0, 기존 v3/공개 범위/학습자UI 변경0. 원문 입력을 새로 분석할 수 있도록 기존 전문을 제공받은 범위에서 읽었고, 원문을 연구 결과물로 재배포하지 않는다.
`
fs.writeFileSync(`${dir}/AUDIT.md`,text)
console.log(`Structural audit: ${rows.length} stored items, ${missing.length} expected booklets missing. No semantic distribution inferred.`)
