// apps/web/src/lib/csat/dissect-metadata.ts
// Reviewed against published design_intent/evidence and lecture wrapup, 2026-09-17.
// Missing metadata is a release defect, never an invitation to invent a topic.
const REPEAT = '빈칸 뒤 재진술은 앞말의 관계를 보존해 정답 근거를 만든다.'
const NEGATE = '부정문 빈칸은 필자의 주장과 빈칸에 들어갈 말을 반대 방향으로 배치한다.'
const EXAMPLES = '앞머리 빈칸은 뒤 사례의 공통 방향을 압축해 주장을 완성한다.'
export const DISSECTION_METADATA: Record<string, { topic: string; format: string; formula: string }> = {
  '2026#31': { topic: '곡물 무역과 정보', format: '원인과 목적', formula: '이유 절의 빈칸은 뒤따르는 행동이 지키는 목적을 묻는다.' },
  '2026#32': { topic: '글쓰기와 독자의 반응', format: '재진술', formula: REPEAT },
  '2026#33': { topic: '건축 설계와 사용자 참여', format: '결과와 조건', formula: '결과의 조건을 묻는 빈칸은 앞서 권한 행위의 주체와 강도를 보존한다.' },
  '2026#34': { topic: '칸트의 법과 자유', format: '부정문', formula: NEGATE },
  '2025#31': { topic: '문학 읽기와 몰입', format: '주장과 사례', formula: EXAMPLES },
  '2025#32': { topic: '비판적 사고와 해방', format: '방향과 문법', formula: '빈칸은 앞 문장의 방향과 뒤에 남은 문법 조건을 함께 만족시킨다.' },
  '2025#33': { topic: '광고 산업과 주의 거래', format: '조건과 거래', formula: '거래의 빈칸은 앞 문장이 나눈 주체와 대상 중 빠진 자리를 묻는다.' },
  '2025#34': { topic: '규칙이 만드는 관행과 역할', format: '주장과 사례', formula: EXAMPLES },
  '2024#31': { topic: '읽기의 확장된 의미', format: '부정문', formula: NEGATE },
  '2024#32': { topic: '영화 음악과 관객', format: '양보와 대조', formula: '양보 뒤 빈칸은 반대 방향의 효과와 그 효과를 얻는 주체를 함께 묻는다.' },
  '2024#33': { topic: '표정 해석과 맥락', format: '재진술', formula: REPEAT },
  '2024#34': { topic: '도시 교통과 개인의 이동', format: '주장과 사례', formula: EXAMPLES },
}
