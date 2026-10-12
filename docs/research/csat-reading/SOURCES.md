<!-- docs/research/csat-reading/SOURCES.md -->
# 출처 감사와 문헌 근거

확인일: 2026-10-12. AI 분석자의 직접 확인 기록이다. 인간 전문가 검수나 교수 효과 검증을 뜻하지 않는다. 원문 지문·교재·논문을 재배포하지 않고 서지, 접근 수준, 분석에 필요한 짧은 요약만 보존한다.

`metadata`: 서지 확인. `abstract`: 공개 초록 확인. `abstract_indexed`: 출판사 검색 색인 초록만 확인하고 실제 페이지 요청 실패. `full_sections`: 필요한 본문 절 직접 확인; 전 페이지 정독 아님. `full_available_unreadable`: PDF가 열리지만 이번 도구로 본문 확인 못함. 출판사 온라인 게시일과 인쇄 출판연도는 구분한다.

## 기출 원문 감사

항목별 파일 SHA256, 페이지, 홀짝형, 검사 결과는 [source-audit.json](./data/source-audit.json)에 기록했다. 입력은 현행 DB의 읽기 전용 로컬 추출이며 옛 분석을 정본으로 삼지 않았다.

- 파일럿 32문항을 실제 문제 PDF에서 텍스트 선별 대조했다. 24자 구간 일치와 선지 번호 결속은 탐지 절차이며, 전체 원문 대조 완료 수는 **0**이다. 7문항의 해당 페이지를 시각 확인했다. 차트 값·밑줄·빈칸의 전량 독립 확인은 남았다.
- 27문항은 해당 홀짝형의 로컬 정답표 PDF 텍스트와 DB 답이 일치했다. 5문항은 저장소의 KICE 보완 정답 JSON과 일치하지만 그 보완의 원본 PDF를 현재 찾지 못했다. 전체 정답 검증 완료라고 쓰지 않는다.
- M2206·M2306·M2309·M2406·M2409의 로컬 `정답표.pdf`는 실제 17페이지 듣기 대본이다. 보완 JSON의 존재와 현재 원본 PDF 직접 확인은 서로 다른 증거 수준이다.
- 2014A/B·2016·2017·M1809의 41-42는 실제 PDF의 `[41~42]` 표제와 시각 확인으로 같은 공유지문임을 확인했다. 41번 빈칸 표식 손실, 2017년 42번 끝의 선지 열 표제 혼입이 문자열 해시 차이를 만든다. 그룹을 유지하되 추출 변형을 보존하고 원본 표시 구조로 파생 정본을 만들어야 한다. 이번에 DB를 변경하지 않았다.
- 2020#38·2022#38·M1809#30의 DB `choices`는 독립 선지 대신 본문 표시 이후 구간을 담으며, 마지막 값에 각주·페이지 번호가 혼입됐다. 이 값을 독립 오답 명제로 코딩하지 않는다.
- 2022#21 짝수형 문제지 3쪽에서 발문과 본문의 동일 밑줄 범위, 선지 번호를 시각 확인했다. 표면적인 의문문/명사구 차이는 전사 오류가 아니다.
- 2025/2026 holdout 본문과 선지를 열람하지 않았다. 2025 로컬 문제지 짝수형과 DB 형식 결속은 검증을 개방할 때 확인할 미해결 위험이다.

### 시험 체제와 기대 목록

2014학년도 6·9월 영어 A/B형은 [정부 공식 채점 표](https://www.korea.kr/briefing/policyBriefingView.do?newsId=148770380)에서 확인했다. 2015학년도 통합 영어 및 6·9월 모평과 같은 통합형 출제는 [교육부 출제경향 원게시물](https://moe.go.kr/boardCnts/view.do?boardID=339&boardSeq=57553&lev=0&m=02&opType=N&page=80&s=moe)에서 확인했다. 연도는 학년도이며 시행연도와 다르다.

따라서 2014-2026 기대 시험책자는 본시험 14개(2014 A/B 2 + 2015-2026 12), 모평 28개(2014 A/B 6·9월 4 + 2015-2026 24)다. 이 산술은 시험 체제 근거이며 전량 공식 파일 목록 확보를 대신하지 않는다. A/B 수준과 홀짝형 선지 배열은 별도 축이다.

## 핵심 이론과 실증 문헌

### T01 — Construction-Integration 원출처

Kintsch, W. (1988). *The role of knowledge in discourse comprehension: A construction-integration model*. **Psychological Review, 95**(2), 163-182. [DOI](https://doi.org/10.1037/0033-295X.95.2.163), [PubMed](https://pubmed.ncbi.nlm.nih.gov/3375398/).

접근: `metadata`. 원논문 대학 공개 PDF의 실제 요청은 404; 검색 색인 문단을 원문 정독으로 승격하지 않았다. 보조 저자 장 Kintsch (2004), *The Construction-Integration Model of Text Comprehension and Its Implications for Instruction*, Ruddell & Unrau 편 **Theoretical Models and Processes of Reading**, 5판은 [대학 PDF](https://verbs.colorado.edu/~mpalmer/Ling7800/Kintsch.pdf)가 열리지만 `full_available_unreadable`이다. 1988 원출처 전체 확인은 미완료. CI가 특정 수능 교수법의 효과를 직접 입증하지 않는다.

### T02 — 문맥과 구문을 통한 의미 구성

Kintsch, W., & Mangalath, P. (2011). *The Construction of Meaning*. **Topics in Cognitive Science, 3**, 346-370. [출판사 본문·DOI](https://onlinelibrary.wiley.com/doi/10.1111/j.1756-8765.2010.01107.x).

접근: `full_sections` (§§1, 3, 4 및 한계). CI 관련 계산 모형에서 문맥·의존 구문·명제 관계가 의미 구성에 관여한다. 저자들은 복잡한 문장으로의 확장과 대표 문장 자료의 체계적 검증 미완료를 명시한다. 계산 모형은 한국 학생의 실제 처리 순서나 교수 효과를 확정하지 않는다.

### T03 — Situation Model

Zwaan, R. A., & Radvansky, G. A. (1998). *Situation Models in Language Comprehension and Memory*. **Psychological Bulletin, 123**(2), 162-185. DOI 10.1037/0033-2909.123.2.162. [저자 연구실 PDF](https://memorylab.nd.edu/assets/257368/zwaan_radvansky_1998_psychological_bulletin_.pdf).

접근: `full_sections` (정의, 5차원, 모형 한계). 통합 상황 표상을 다룬 문헌 리뷰. 시간·공간·인과·의도·주체의 상호작용과 과제 의존성을 인정한다. 내러티브 중심 틀을 추상 설명문에 강제하거나 다섯 차원에 고정 가중치를 주지 않는다.

### T04 — L2 읽기의 구성 변인

Jeon, E. H., & Yamashita, J. (2014). *L2 Reading Comprehension and Its Correlates: A Meta-Analysis*. **Language Learning, 64**, 160-212. [출판사·DOI](https://onlinelibrary.wiley.com/doi/10.1111/lang.12034).

접근: `abstract`. 지문 수준 L2 이해와 10개 구성 변인의 상관 메타분석. 어휘·문법 지식의 강한 연관과 측정·언어 거리 등의 조절을 보고한다. 상관을 교수 순서나 구문 해부 효과의 인과 증거로 사용하지 않는다. 표본·측정 세부 전량 확인은 미완료.

### T05 — Rhetorical Structure Theory

Mann, W. C., & Thompson, S. A. (1988). *Rhetorical Structure Theory: Toward a functional theory of text organization*. **Text, 8**(3), 243-281. [출판사·DOI](https://www.degruyterbrill.com/document/doi/10.1515/text.1.1988.8.3.243/html). [1987 기술보고서 PDF](https://www.sfu.ca/rst/pdfs/Mann_Thompson_1987.pdf), [공식 관계 정의](https://www.sfu.ca/rst/01intro/definitions.html).

접근: 1988 `metadata/paywall`, 1987 `full_available_unreadable`, 공식 정의 `full_sections`. 기능적 관계를 기술하는 틀. 대조·양보·반대 논증·조건·인과·예시를 구분한다. 관계 표지 하나로 확정할 수 없다. 분석자의 저자 의도 추정은 공식 출제 기록이 아니다. 공식 웹 정의에는 후대 추가 관계도 있어 1988판과 동일하다고 쓰지 않는다.

### T06 — 일관성과 배경지식의 상호작용

McNamara, D. S., Kintsch, E., Songer, N. B., & Kintsch, W. (1996). *Are Good Texts Always Better? Interactions of Text Coherence, Background Knowledge, and Levels of Understanding in Learning From Text*. **Cognition and Instruction, 14**(1), 1-43. [출판사 초록·DOI](https://www.tandfonline.com/doi/abs/10.1207/s1532690xci1401_1).

접근: `abstract_indexed`; 실제 open 실패. 과학 텍스트의 일관성·배경지식·이해 수준을 조사한 두 실험. 중학생 생물 텍스트 및 회상·질문·분류 과제가 초록에 있다. 세부 효과 방향·크기는 원문 확보 전 확정하지 않는다. 시간제한 수능 선택형과 직접 동일시하지 않는다.

### T07 — 설명문 구조 지도

Hebert, M., Bohaty, J. J., Nelson, J. R., & Brown, J. (2016). *The Effects of Text Structure Instruction on Expository Reading Comprehension: A Meta-Analysis*. **Journal of Educational Psychology, 108**(5), 609-629. DOI 10.1037/edu0000082. [ERIC 저자 원고](https://files.eric.ed.gov/fulltext/ED648909.pdf).

접근: `full_sections` (대상·방법·전이·한계). 2-12학년 45개 연구의 메타분석. 비교집단 강도와 측정의 근접성에 따라 결과가 달라지고 먼 전이는 작고 불안정하다. 원연구의 충실도·무작위화·교사 수 보고 한계가 있다. 한국 EFL 수능과 Vocaflow 효과의 직접 증거가 아니다.

### T08 — Evidence-Centered Design

Mislevy, R. J., Steinberg, L. S., & Almond, R. G. (2003). *On the Structure of Educational Assessments*. **CSE Technical Report 597**. [CRESST](https://cresst.org/publication/on-the-structure-of-educational-assessments/), [ERIC 원문](https://files.eric.ed.gov/fulltext/ED480557.pdf).

접근: `full_sections` (주장·학생·과제·증거 모형, 언어평가 예시). 평가 설계의 규범적 틀. 능력 주장, 과제 특성, 관찰 반응 및 연결 추론을 구분한다. 논리적 해결 요구를 실제 수험생 인지 과정으로 바꾸거나 설계 개연성을 타당도 검증 완료로 쓰지 않는다.

### T09 — 언어평가 점수 해석의 타당도

ETS & Norris, J. M. (2020). *Validity Evidence Supporting the Interpretation and Use of TOEFL iBT Scores*. **TOEFL Research Insight Series, 4**(1), 3rd ed. [ETS 원기관](https://www.ets.org/research/policy_research_reports/publications/periodical/2020/kgqi.html).

접근: `abstract`, 연결 PDF 실패. 점수 해석·사용의 주장과 이를 뒷받침하는 자료를 별도로 설정하는 지속적 검증 프로그램을 설명한다. TOEFL 타당도 증거를 수능으로 이전하지 않는다. 문항 논리·실제 풀이 과정·교수 효과·대학 읽기 능력 주장은 별도로 관리한다.

### T10 — 공식 출제 기본 방향

한국교육과정평가원장·수능출제위원장 (2025-11-13). *2026학년도 대학수학능력시험 출제 기본 방향 브리핑*. [정부 공식 속기](https://www.korea.kr/briefing/policyBriefingView.do?newsId=156728023).

접근: `full_sections` (출제 기본 방향; holdout 문항 원문 미열람). 영어 어휘 범위 및 듣기·간접 말하기·읽기·간접 쓰기의 언어 사용 능력 측정 방향을 명시한다. 연도 전체 공식 방향이며 개별 문항의 실제 출제 의도 또는 측정 타당도를 입증하지 않는다. **2026 학습 방법 안내 원기관 본문 직접 확인은 미완료**다.

### T11 — 빈칸 문항과 실제 풀이 과정

김정은·김현진·이선빈 (2025). *수능 영어 빈칸추론 문항은 수험생들의 추론 능력을 측정하는가?* **영어학, 25**, 562-579. DOI 10.15738/kjell.25..202504.562. [KCI 초록](https://www.kci.go.kr/kciportal/mobile/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003202030).

접근: `abstract`. 대학생 51명의 사고구술 및 정답률·시간·추론·숙련도·주제 친숙성 관계를 조사했다. 초록에서는 주제 친숙성만 유의한 예측 변인이라고 보고한다. 비유의성은 무관함의 증명이 아니다. 문항 선정·검정력·코딩 원문 확인 전 고등학생 전체나 전 유형으로 일반화하지 않는다.

### T12 — 이독성과 오답률

Kim, J., & Jung, Y. (2025). *The Relationship Between Text Readability, Item Types, and Their Impact on Student Performance on CSAT English Reading Items*. **Modern English Education, 26**, 68-83. DOI 10.18095/meeso.2025.26.1.68. [학회 PDF](https://journal.kci.go.kr/meeso/archive/articlePdf?artiId=ART003173986).

접근: `full_sections` (방법·결과·한계). 23개 본시험·모평의 EBSi 오답률 상위 항목만 분석했다. 이독성의 설명력은 이 선택 표본에서 낮았다. 335는 독립 지문 수가 아니며 41/42를 유형별로 분석했다. 응답은 자발 제출이고 43-45 서사는 제외됐다. 전 유형 분포·공식 오답률로 전용하지 않는다.

### T13 — 공식 학습 방법 안내: 2023판

한국교육과정평가원. *2023학년도 대학수학능력시험 학습 방법 안내*. 수능 CAT2022-1-1. [전남교육청 공식 배포 PDF](https://www.jne.go.kr/upload/jinro/na/bbs_395/ntt_5042031/doc_7d745d0e-7f3b-435a-a040-bcab2fd06af61653a2669b48838.pdf).

접근: `full_sections`, **총괄 에이전트 직접 확인**; 발행기관 표지 확인, 교육청 mirror. 로컬 파일 23,712,716 bytes, SHA256 `1e086d373493670f2455f28fc8c506380db98cbaa7948ee9290f1fdb64a0b213`. 본문 96쪽의 평가 목표, 113쪽 목적 학습, 118쪽 간접쓰기 전개 구조 안내를 확인했다. 중심·세부·논리·맥락·언어형식·간접쓰기 구분의 공식 근거다. 개별 문항 의도·교육 효과 증거가 아니며 2026판이라고 표기하지 않는다.

## 강사·시중 교재 비교 자료

- [EBS 주혜연의 해석공식 논리 구조편](https://www.ebsi.co.kr/ebs/pot/potg/retrieveCourseDetailNw.ebs?bookId=LB00000005373): 공식 소개와 2024-01-25 발행일 직접 확인. 논리를 통한 예측·유추를 강조한다. 소개만 확인했으며 교재·강의 전체 정독과 효과 검증은 미완료다.
- [이투스 NEW 2027 주혜연 한줄독해 기본편](https://www11.etoos.com/lecture/LectureDetailN.asp?lecture_id=L70711): 공개 소개·목차 직접 확인. 문법·구문 연계, 누적 예문, 정확한 해석을 강조한다. 교육과정 설명과 효과 홍보 문구를 분리한다.
- [이지영 (2025), One-Blank/Main Idea 비교](https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003211346), **중등영어교육, 18**(3), 21-45: 초록에서 대학생 44명 집단 비교 확인. 원문을 확보한 뒤 추가 실증 문헌으로 편입할 후보다.

인기·판매·수강 후기·홍보 문구는 효과 근거로 쓰지 않는다. 대립 찾기·중심문장·선택적 읽기·직독직해·구문 해부의 구체적인 절차 비교는 직접 확보한 방법 설명 범위에 한정하고 나머지는 미확정으로 둔다.
