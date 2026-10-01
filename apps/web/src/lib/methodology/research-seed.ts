// apps/web/src/lib/methodology/research-seed.ts
// Primary-source research snapshot. No transcript or effectiveness claim is stored here.
import type { ClaimKind, KnowledgeBundle, Source, Taxon } from './types'
import videoInventory from './video-inventory.json'

const verifiedAt = '2026-09-19'
const taxonomy: Taxon[] = []
function terms(dimension: Taxon['dimension'], entries: string[][], parentId: string | null = null) {
  taxonomy.push(...entries.map(([id, label]) => ({ id, label, dimension, parentId })))
}
terms('age', [['age:primary', '초등'], ['age:middle', '중등'], ['age:high', '고등'], ['age:adult', '성인']])
terms('proficiency', [['level:foundation', '기초'], ['level:intermediate', '중급'], ['level:advanced', '고급']])
terms('exam', [['exam:csat', '수능'], ['exam:kice', '평가원 모의평가'], ['exam:regional', '전국연합학력평가'], ['exam:school', '내신'], ['exam:performance', '수행평가']])
terms('skill', [['skill:reading', '읽기·독해'], ['skill:vocabulary', '어휘'], ['skill:grammar', '문법'], ['skill:listening', '듣기'], ['skill:speaking', '말하기'], ['skill:writing', '쓰기'], ['skill:pronunciation', '발음']])
terms('skill', [['skill:logic', '논리적 읽기'], ['skill:summary', '요약'], ['skill:background', '배경지식 활용']], 'skill:reading')
terms('process', [['process:first', '처음 학습'], ['process:concept', '개념 이해'], ['process:practice', '연습'], ['process:approach', '문제 접근'], ['process:analysis', '분석'], ['process:error', '오답'], ['process:review', '복습'], ['process:memory', '암기'], ['process:transfer', '전이'], ['process:final', '시험 직전'], ['process:time', '시간 관리']])
// public.csat_types IDs, read directly on 2026-09-19. Retired types remain explicit.
terms('question', [['R-BLANK', '빈칸 추론'], ['R-BLANK2', '빈칸 추론(2개·폐지)'], ['R-CHART', '도표'], ['R-CLAIM', '필자 주장'], ['R-FACT', '내용 일치(글)'], ['R-GIST', '요지'], ['R-GRAMMAR', '어법'], ['R-IMPLY', '함축 의미'], ['R-INSERT', '문장 삽입'], ['R-IRRELEVANT', '무관한 문장'], ['R-MOOD', '심경·분위기'], ['R-NOTICE', '안내문 일치'], ['R-ORDER', '글의 순서'], ['R-PURPOSE', '글의 목적'], ['R-REFER', '지칭 추론(단문·폐지)'], ['R-SUMMARY', '요약문 완성'], ['R-TITLE', '제목'], ['R-TOPIC', '주제'], ['R-VOCAB', '어휘(문맥)'], ['X-BLANK', '장문 빈칸(1개·폐지)'], ['X-BLANK2', '장문 빈칸(2개)'], ['X-FACT', '장문 내용 일치'], ['X-ORDER', '장문 순서'], ['X-REFER', '장문 지칭'], ['X-TITLE', '장문 제목'], ['X-VOCAB', '장문 어휘']])

const sources: Source[] = []
function document(id: string, title: string, url: string, expertIds: string[], taxonomyIds: string[], originGroup: string) {
  sources.push({ id, title, url, expertIds, taxonomyIds, originGroup, kind: 'document', channelId: null, publishedAt: null, verifiedAt, revision: `reviewed:${verifiedAt}`, access: 'document_read', rights: 'link_only', rightsBasis: '공개 공식 페이지를 읽고 짧게 재서술. 원문·이미지·첨부자료 복제 허용은 확인하지 않음.', durationSeconds: null, priority: 'high', priorityReason: '공식 전문 활동 또는 명시적 교육 절차의 일차 출처' })
}
document('russell-kjy', '러셀 김지영 프로필·커리큘럼', 'https://mrusseldc.megastudy.net/teacher/teacher_home.asp?code=1485', ['kim-jiyoung'], ['age:high', 'skill:reading', 'exam:csat'], 'kim-jiyoung-curriculum')
document('cedu-grammar', '천일문 고등 GRAMMAR 교재특징', 'https://www.cedubook.com/products/2312040001', ['kim-kihoon'], ['age:high', 'skill:grammar', 'exam:school', 'exam:csat'], 'cedu-sentence-learning')
document('cedu-writing', '천일문 중등 WRITING 교재특징', 'https://cedubook.com/products/2410140001', ['kim-kihoon'], ['age:middle', 'skill:writing', 'exam:performance'], 'cedu-sentence-learning')
document('cedu-voca', '천일문 VOCA 중등 스타트 교재특징', 'https://www.cedubook.com/products/2310170001', ['kim-kihoon'], ['age:middle', 'skill:vocabulary'], 'cedu-sentence-learning')
document('ebs-heo', 'EBS 허준석 선생님 소개', 'https://primary.ebs.co.kr/teacher/view?subjectCd=32000002&teacherId=FEAF9DCCD254DF6EF7F28F63F0035747', ['heo-junseok'], ['age:primary', 'age:middle', 'skill:grammar'], 'ebs-heo-profile')
document('snue-faculty', '서울교육대학교 영어교육과 교수 소개', 'https://grad.snue.ac.kr/snue/cm/cntnts/cntntsView.do?cntntsId=3010&mi=3016', ['kim-hyeri', 'yoon-yeobeom'], ['age:primary', 'skill:reading', 'skill:pronunciation'], 'snue-faculty')
document('ebs-writing', 'EBS Easy Writing 출연자 소개', 'https://home.ebs.co.kr/dw/etc/5/cast', ['master-eugene', 'serina-hwang'], ['age:adult', 'skill:writing', 'skill:speaking'], 'ebs-easy-writing')
// Sources below were discovered in official listings; their bodies still need examination.
function candidateSource(id: string, title: string, url: string, expertIds: string[], taxonomyIds: string[]) {
  document(id, title, url, expertIds, taxonomyIds, id)
  sources[sources.length - 1].access = 'metadata_only'
  sources[sources.length - 1].priorityReason = '공식 검색 결과에서 발견. 본문·방법론 확인 대기'
}
candidateSource('ebs-jung', 'EBS 중학 Grammar Inside 강좌 목록', 'https://mid.ebs.co.kr/premium/product/list?clsfnSystId=58000371&has5DepthYN=N', ['jung-seungik'], ['age:middle', 'skill:grammar'])
candidateSource('mega-jo', '조정식 믿어봐 문장편 공식 강좌', 'https://m.megastudy.net/mobile/smart/lecture/detail/view.asp?chr_cd=58678', ['jo-jungsik'], ['age:high', 'skill:reading', 'exam:csat'])
candidateSource('ebs-speaking', 'EBS 입이 트이는 영어', 'https://home.ebs.co.kr/speakinge/', ['lee-hyunseok'], ['age:adult', 'skill:speaking'])
candidateSource('mimac-syntax', '대성마이맥 이명학 Syntax 1.0 공식 영상', 'https://www.youtube.com/watch?v=0_y-frivXqo', ['lee-myunghak'], ['age:high', 'skill:reading', 'exam:csat'])
Object.assign(sources[sources.length - 1], { kind: 'video', channelId: 'mimac', publishedAt: '2025-12-30' })
candidateSource('compass-reading', '웅진컴퍼스 김혜리 그림책 읽기 강연', 'https://www.youtube.com/watch?v=yAwJk4wd5yc', ['kim-hyeri'], ['age:primary', 'skill:reading'])
Object.assign(sources[sources.length - 1], { kind: 'video', channelId: 'compass', publishedAt: '2020-11-11' })
candidateSource('kjy-channel', '영어는V김지영 채널 및 공식 강좌 연결', 'https://www.youtube.com/@kimjiyoung.V', ['kim-jiyoung'], ['age:high', 'skill:reading', 'exam:csat'])
// A channel landing page is a document inventory record, never transcript evidence.
for (const video of videoInventory) {
  const educational = /공부|독해|단어|문장|순서|삽입|등급|회화|영어|모의|6모|9평|수능/.test(video.title)
  sources.push({ id: `yt:${video.id}`, title: video.title, url: `https://www.youtube.com/watch?v=${video.id}`, kind: 'video', expertIds: ['kim-jiyoung'], channelId: 'kjy', originGroup: 'kim-jiyoung-youtube-unresolved', publishedAt: video.publishedAt, verifiedAt, revision: `metadata:${verifiedAt}`, access: 'metadata_only', rights: 'link_only', rightsBasis: '공개 영상 메타데이터만 확보. 자막 요청은 빈 응답이어서 내용 추출 안 됨.', durationSeconds: video.seconds, taxonomyIds: [], priority: educational && video.format === 'video' ? 'high' : 'low', priorityReason: educational ? '제목 기준 교육 내용 후보. 실제 내용·대상 분류 및 원본/쇼츠 중복 확인 필요' : '제목 기준 일상·홍보·기타 후보. 내용 확인 전 낮은 우선순위' })
}

export const researchSeed: KnowledgeBundle = {
  schemaVersion: 1, verifiedAt, taxonomy, sources,
  experts: [
    ['kim-jiyoung', '김지영', '메가스터디·러셀', '수능 독해·어휘', 'russell-kjy', 'profile_verified'],
    ['kim-kihoon', '김기훈', '쎄듀', '문장 중심 문법·어휘·영작 교재', 'cedu-grammar', 'profile_verified'],
    ['heo-junseok', '허준석', 'EBS', '초·중등 영어·문법', 'ebs-heo', 'profile_verified'],
    ['kim-hyeri', '김혜리', '서울교육대학교', '초등 영어교육', 'snue-faculty', 'profile_verified'],
    ['yoon-yeobeom', '윤여범', '서울교육대학교', '영어 음성학·초등 영어교육', 'snue-faculty', 'profile_verified'],
    ['master-eugene', '마스터유진', 'EBS Easy Writing', '영작·말하기', 'ebs-writing', 'profile_verified'],
    ['serina-hwang', '세리나 황', 'EBS Easy Writing', '영작·말하기', 'ebs-writing', 'profile_verified'],
    ['jung-seungik', '정승익', 'EBS', '중학 문법', 'ebs-jung', 'candidate'],
    ['jo-jungsik', '조정식', '메가스터디', '수능 독해', 'mega-jo', 'candidate'],
    ['lee-hyunseok', '이현석', 'EBS', '일상 영어 말하기', 'ebs-speaking', 'candidate'],
    ['lee-myunghak', '이명학', '대성마이맥', '수능 구문·독해', 'mimac-syntax', 'candidate'],
  ].map(([id, name, organization, specialty, profile, status]) => ({ id, name, organization, specialties: [specialty], profileSourceIds: [profile], researchStatus: status as 'candidate' | 'profile_verified', verifiedAt })),
  channels: [
    { id: 'kjy', name: '영어는V김지영', url: 'https://www.youtube.com/@kimjiyoung.V', expertIds: ['kim-jiyoung'], relationship: 'personal', verificationSourceIds: ['kjy-channel', 'russell-kjy'], verifiedAt },
    { id: 'mimac', name: '대성마이맥', url: 'https://www.youtube.com/channel/UCKziRqbw2AvmAJ5wcYXRaMw', expertIds: ['lee-myunghak'], relationship: 'platform', verificationSourceIds: ['mimac-syntax'], verifiedAt },
    { id: 'compass', name: '웅진컴퍼스', url: 'https://www.youtube.com/channel/UCmcNlckdzS4Z8Ulz_ckebFA', expertIds: ['kim-hyeri'], relationship: 'guest', verificationSourceIds: ['compass-reading'], verifiedAt },
  ],
  methods: [], claims: [], evidence: [], relations: [], gaps: [],
}
function method(id: string, sourceId: string, section: string, taxonomyIds: string[], parts: [ClaimKind, string][]) {
  const source = sources.find(s => s.id === sourceId)!
  researchSeed.methods.push({ id, statement: parts.find(([kind]) => kind === 'principle')![1], taxonomyIds, review: 'extracted', reviewedAt: null, reviewedBy: null, efficacy: 'not_assessed', productApplications: [] })
  const ordinals: Partial<Record<ClaimKind, number>> = {}
  for (const [kind, text] of parts) {
    const ordinal = ordinals[kind] ?? 0; ordinals[kind] = ordinal + 1
    const claimId = `${id}:${kind}:${ordinal}`
    researchSeed.claims.push({ id: claimId, methodId: id, kind, text, ordinal, attribution: 'source_explicit' })
    researchSeed.evidence.push({ id: `e:${claimId}`, claimId, sourceId, sourceRevision: source.revision, expertIds: source.expertIds, locator: { kind: 'section', section }, stance: 'supports', note: '공식 설명의 재서술. 교육 효과의 독립 검증과 구분하며, 사람 검토 전 추출 상태.' })
  }
}
method('example-grammar', 'cedu-grammar', '교재특징: 예문 중점 문법 학습 설명 및 유닛/챕터 확인 문제 문단', ['age:high', 'skill:grammar', 'exam:school', 'exam:csat', 'R-GRAMMAR', 'process:concept', 'process:transfer'], [
  ['principle', '대표 문장에서 문법을 익히고 다른 예문에서 같은 개념을 찾아 적용한다.'],
  ['condition', '문법 규칙을 암기했지만 실제 문제에 적용하기 어려운 고등학생을 대상으로 한다.'],
  ['procedure', '문법 사항이 드러나는 예문과 간략한 설명을 함께 학습한다.'],
  ['procedure', '유닛 확인 문제를 풀고 챕터의 내신형 문제로 점검한다.'],
  ['transfer', '새로운 유사 문장을 읽을 때 배운 문법 개념을 떠올리는 것을 지향한다.'],
])
method('writing-plan-assess', 'cedu-writing', '교재특징: 논술형 수행평가 Step 1–3 및 자기 채점 문단', ['age:middle', 'skill:writing', 'exam:performance', 'process:analysis', 'process:practice', 'process:review'], [
  ['principle', '예시 글의 틀을 분석한 뒤 자신의 글을 계획하고 작성하여 평가 기준으로 점검한다.'],
  ['condition', '중학교 영어 논술형 수행평가 연습에 제시된 절차다.'],
  ['procedure', '예시 글을 분석하며 구성 방식을 파악한다.'],
  ['procedure', '쓸 내용을 생각하고 글의 뼈대를 만든다.'],
  ['procedure', '주어진 조건에 맞게 글을 쓰고 제공된 평가 기준으로 스스로 채점한다.'],
])
method('vocab-new-context', 'cedu-voca', '교재특징: 문장 중심 학습과 1001 Sentences Review 설명 문단', ['age:middle', 'skill:vocabulary', 'process:memory', 'process:transfer'], [
  ['principle', '어휘를 문장 속에서 학습하고 새로운 문맥에 적용하며 누적 복습한다.'],
  ['condition', '중등 필수 어휘와 표현을 학습하는 상황에 제시된다.'],
  ['procedure', '예문으로 단어와 표현을 익히고 학습일별 문제로 기억을 점검한다.'],
  ['transfer', '배운 어휘를 새로운 문맥에 적용하는 복습 문제를 활용한다.'],
])
method('reading-type-transfer', 'russell-kjy', '강의특징 & 수강효과: V 유형 독해의 유형 간 관계 및 V Check 설명', ['age:high', 'skill:reading', 'skill:logic', 'exam:csat', 'R-ORDER', 'R-INSERT', 'R-BLANK', 'process:transfer', 'process:review'], [
  ['principle', '독해 유형 사이의 관계를 연결해 배우고 지문 파악과 풀이에 일관되게 적용한다.'],
  ['condition', '수능 영어 유형 독해 커리큘럼의 학습 원칙이다.'],
  ['procedure', '문제를 푼 뒤 풀이 과정에서 확인해야 할 점검 사항을 다시 확인한다.'],
  ['transfer', '한 유형에서 배운 접근을 관련된 다음 유형의 풀이에 연결한다.'],
])
for (const skill of taxonomy.filter(t => t.dimension === 'skill')) {
  researchSeed.gaps.push({ id: `gap:${skill.id}`, taxonomyIds: [skill.id, ...taxonomy.filter(t => t.dimension === 'age').map(t => t.id)], question: `${skill.label}: 학령별 적용 조건과 실패·예외를 독립 출처에서 확인했는가?`, nextAction: '공식 원문 또는 허용된 자막 확보 → 조건·실패·예외 근거 추출 → 사람 검토. 현재 후보 목록은 조사 완료를 뜻하지 않음.' })
}
