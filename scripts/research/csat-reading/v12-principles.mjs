// scripts/research/csat-reading/v12-principles.mjs
// Validate all bounded principle bindings; render semantic review candidates, not source confirmations.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const base='docs/research/csat-reading/',dir=base+'data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex')
const x=read(dir+'principle-task-review.json'),compare=read(x.source.compare.path),tasks=read(x.source.codebook.path).tasks
if(sha(fs.readFileSync(x.source.compare.path))!==x.source.compare.sha256||x.items.length!==110||new Set(x.items.map(i=>i.pair_id)).size!==110)throw Error('Principle source/denominator drift')
for(const item of x.items){if(sha(JSON.stringify(compare.pairs[item.pair_id].principle))!==item.original_principle_sha256||item.task_links.some(t=>!tasks.some(c=>c.id===t.ID)))throw Error(`Principle binding/TASK ${item.pair_id}`)}
const lines=[`<!-- ${base}V12-F-PRINCIPLES.md -->`,'# F. 조건부 출제 원리→TASK 연결','','2026-10-14 · [110개 개별 원장](./data/v12/principle-task-review.json), [교차유형 별도 사례](./data/v12/cross-type-cases.json). bounded110은749비교쌍 중 조건부 원리 객체110개이며, 공개786문항 각각의 principle 필드와 분모가 다르다. 원래 원칙·비교·승인 상태는 수정하지 않았다.','',
 '110개 문구·적용 조건·when_not를 전량 개별 읽어 자체 재진술, 수행, TASK 연결, 조건·비판 한계, 교수 설명, 직접 활동, 새 확인 후보를 작성했다. **110/110 문구 의미 검토, 311 TASK 연결 후보, 원래 두 원문을 독립 대조해 원리 전체를 검증한 수0**이다. 같은 원리에 여러TASK를 연결해도 독립 능력이나 독립 재현 수로 복제하지 않는다.','',
 '전체749쌍의 기존 유형은 모두 같은 유형이었다(기본연구 범위의 양쪽이 있는325쌍도 교차유형0). 원장에 새 교차유형 논리 후보17개를 별도 제안했으나 조건 적합·원문·전이 검증은 미확정이다. 메타데이터로 선정한 다음 확인 후보는 실제 적격 지문 확보나 학생 미노출 풀의 확정이 아니다.','',
 '실제 복원 두 문항2014A#39 삽입/2016#30 지칭은 인물 참조 자원이 공통이지만 결정 구조는 동일하지 않다. 삽입에서는 완료된 사건과 가방 정보 도입/다음 회고가 제약이며 지칭에서는 같은 대상 여부를 고른다. 부분적 유사성을 원리 재현으로 승인하지 않는 대조 사례다.','',
 '별도의2017#25 사실 불일치/2024#28 안내 일치 사례는 본문-후보 대응과 발문의 극성을 분리하는 교차유형 논리 후보를 지지한다. 전자의 공저-단독 후보는textual contradiction이지만task fits, 후자의1편-2편 후보는textual contradiction이고task fails다. 각 다섯 후보의 별도 근거 범위를 기록했다. 이는 개발 표본의 재구성이며 새 독립 검증·학생 전이 효과가 아니다.','',
 '동결 이후 원칙 문구에서 최근2025~2026의59ID와 관련된 제한적 의미 노출이 있었다. 원문·정답·개별v3산문을 직접 열지 않은 것과 완전 미노출은 다르다. 노출ID와읽은필드는원장에있으며 이후그ID를완전한모델미노출검증이라고부르지않는다.','',
 '아래 TASK 표시는 원리 문구의 교육적 연결 **후보**이고 실제문항→TASK 검토46행과 구별한다. 자세한 when_not·critical_limit·direct_activity·fresh_check_pool은JSON 원장에서 각원리ID로 찾을 수 있다.','', '| 번호·비교ID | 기존유형 | 자체재진술 | TASK 후보 | 비판한계 |','|---|---|---|---|---|']
for(const item of x.items)lines.push(`| ${item.source_ordinal} · ${item.pair_id} | ${item.original_types.left} | ${item.statement.paraphrase.replace(/\|/g,'/')} | ${item.task_links.map(t=>t.display).join(', ')} | ${item.critical_limit.replace(/\|/g,'/')} |`)
lines.push('','교수 설명은 규칙 이름을 암기시키는 대신 적용 조건과 반례를 확인하고 직접 근거·대상·범위를 구성하게 하는 후보다. 실제 학생 독립 응답·새 유형 전이·지연 유지·교육 효과 자료는 모두0이며 그 상태를 각 원리에 보존했다.')
fs.writeFileSync(base+'V12-F-PRINCIPLES.md',lines.join('\n')+'\n');console.log('All110 principle hashes and TASK IDs validated; F rendered')
