// scripts/csat/source-origin-report.mjs
// A report describes stored searches and reviewed evidence, never assumed coverage.
import path from 'node:path'

export function renderOriginReport({ curated, rows, counts, itemCoverage, tableRows, resultsPath }) {
  const searched = rows.filter(r => r.search_checked)
  const cohort = kind => Object.fromEntries(Object.keys(counts).map(status => [status, rows.filter(r => r.exam.kind === kind && r.status === status).length]))
  const suneung = cohort('suneung'), mock = cohort('mock')
  const run = curated.audit_run
  const reviewed = rows.filter(r => r.exam.kind === 'suneung').length
  return `# 평가원 영어 기출 원천 조사 — ${curated.audited_at}

수능·평가원 모의평가 ${rows.length}개 고유 지문(${itemCoverage}문항) 등록부를 기준으로 집계했다. 직접 확인 ${counts.confirmed_exact}, 유력 후보 ${counts.supported_candidate}, 소재 계보 ${counts.topic_lineage_only}, 미확인 ${counts.unresolved}개다. 이번 추가 조사는 수능을 대상으로 했다.

| 범위 | 직접 확인 | 유력 후보 | 소재 계보 | 미확인 | 합계 |
|---|---:|---:|---:|---:|---:|
| 수능 | ${suneung.confirmed_exact} | ${suneung.supported_candidate} | ${suneung.topic_lineage_only} | ${suneung.unresolved} | ${rows.filter(r => r.exam.kind === 'suneung').length} |
| 모의평가 | ${mock.confirmed_exact} | ${mock.supported_candidate} | ${mock.topic_lineage_only} | ${mock.unresolved} | ${rows.filter(r => r.exam.kind === 'mock').length} |

## 근거와 검색 범위

- 직접 확인은 해당 문단을 출판사·저자·공식 보고서 또는 서지가 식별되는 전문 사본에서 대조한 판정이다. 출판사 미리보기의 완전한 인용과 정확한 출처 주석도 근거로 삼는다. 시험의 생략·빈칸·가벼운 어휘 변경을 메모에 남긴다.
- 후보는 본문 대조 미완료, 소재 계보는 동일한 연구·사례만 확인된 상태다. 미확인은 출처가 없다는 뜻이 아니다.
- 이 결과에 연결된 저장 검색 이력은 ${searched.length}개 지문, ${rows.reduce((sum,r) => sum + r.search_attempt_count, 0)}건이다. 저장 이력이 없는 행은 미조사로 표시한다. 과거 판정의 근거 링크와 이번 검색 로그의 유무는 별개다.
- 이번 검색 범위는 ${run?.searched_unresolved ?? '미기록'}개 수능 미확인 지문의 1차 검색이다. 후속 검색·도서·논문 전문 대조는 발견 단서에 따라 수행했다. 모든 지문에 3개 검색어를 실행했다고 주장하지 않는다.
- 교육청 학평은 DB에 존재하지만 이 조사 대상에서 제외했다. 모의평가 기존 판정은 유지한다. 등록부의 고유 지문 식별자와 연결 문항을 보존하며, 새 검수는 연결 문항 각각의 현재 원문 UTF-8 SHA-256에 묶는다.

## 확보 결과

수능 직접 확인은 ${suneung.confirmed_exact}개/${reviewed}개(${(100*suneung.confirmed_exact/reviewed).toFixed(1)}%)다. ${run ? `이번 검수 전 ${run.baseline_confirmed}개 대비 +${run.upgrades}개. 후보에서 ${run.candidate_upgrades}개, 미확인에서 ${run.unresolved_upgrades}개를 확보했다.` : ''} 단순 검색 개선만의 효과로 분해한 실험은 아니다. 효과는 후보 재검토·검색식 개선·전문 대조를 합친 실행 결과다.

확정 기준에서 책·장 편집자, 인용된 연구자, 지문의 실제 저자를 구분했다. 예를 들어 Thomas Kuhn의 장 저자는 Joseph Rouse, 혁신경제학 편람의 해당 장 저자는 Paula E. Stephan이다. 열람 판본과 시험 사용 판본은 구분하고, 판본 연도가 확인되지 않으면 비워 둔다.

| 문항 | 상태 | 원천 | 대표 근거 |
|---|---|---|---|
${tableRows}

## 다음 조사 우선순위

1. 남은 후보 ${suneung.supported_candidate}개: 출판사 도서 미리보기·Google Books·저자 저장소에서 해당 문단 확보. 검색 결과의 책 제목만으로 확정하지 않는다.
2. 추가 단서: 2025#24 Mirzoeff의 셀피 설명(재인용 원전 특정 필요), 2026#41 Cumming의 패션 전시 설명(인용된 일부 문장 외에 전체 문단 필요), 2018#41 Nancy Kress의 소설 인물 묘사(원서·출판사 본문 재확보), 2024#36 협상 문단(전문은 발견했으나 책·저자 특정 미완).
3. 수능 미확인 ${suneung.unresolved}개: 저장된 2·3번째 구절을 검색하고, 편집 어휘를 바꿔 짧게 검색한다. PDF의 텍스트층이 없으면 스캔을 렌더링해 직접 대조한다. 현재 확보율을 남은 지문에 외삽하지 않는다.

## 재현·적재·검증

1. 새 검색 큐: <code>node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/source-origin-export.mjs --kind suneung --output scripts/csat/source-origin-work/suneung.jsonl</code>. 읽기 전용이다. 기존 등록부와는 문항 ID로 대응한다.
2. 검색 결과 저장: <code>source-origin-raw-write.mjs</code>에 JSON 배열을 표준입력으로 전달한다. 해시·제공자·검색어·회차를 열쇠로 쓰며 동일 시도 재실행은 안전하다. 본문·대용량 응답은 커밋하지 않는다.
3. 갱신 검수: [리뷰 명세](./csat-source-origin-review-${curated.audited_at.replaceAll('-','')}.json)에 변경 전후 값·연결 문항·본문 해시를 담는다. <code>source-origin-review.mjs --input &lt;검수 파일&gt; --output &lt;예행 SQL&gt;</code>로 읽기 전용 SQL을 만들고 DB에서 실행한다. 모든 행이 <code>already_applied</code>면 완료다.
4. 적용 SQL 생성은 <code>--commit-sql</code>이다. 생성만 하며 자동 DB 연결은 없다. DB 체크포인트 전후를 찍고 한 트랜잭션으로 실행한다. 변경 전 상태·본문·연결 관계가 다르면 전체 적용을 거부한다. 같은 검수를 다시 적용하면 건너뛴다. 되돌리기는 저장된 before/after를 토대로 별도 복구 작업을 검수한다.
5. 기존 <code>scripts/knowledge/import-seed.mjs</code>는 최초 등록용이다. 이미 있는 행을 갱신하지 않으므로 이번 증분 갱신에 사용하지 않는다.
6. 집계 조립은 <code>source-origin-build.mjs --pending &lt;등록부 기준 큐&gt; --search-log &lt;로그&gt; --results &lt;결과 경로&gt; --report &lt;보고서 경로&gt;</code>. DB 쓰기 없이 출력 파일을 재생성한다. 분모·문항 커버리지가 다르면 중단한다.

${run?.applied_note ?? 'DB 반영 여부는 별도 검수 기록을 확인한다.'}

전체 ${rows.length}행 결과: [${path.basename(resultsPath)}](./${path.basename(resultsPath)})
`
}
