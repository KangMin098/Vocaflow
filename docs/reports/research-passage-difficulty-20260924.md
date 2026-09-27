# 지문 난이도 측정·게이트 문헌 조사 (2026-09-24)

범위: 공개 원천(PLOS·VOA 등)에서 뽑은 지문을 한국 고등학생·수능 대비용으로 쓸 때 난이도를 어떻게 재고, 어디서 막을지.
표기: **[출처]** = 인용한 문헌에 적힌 내용 · **[추론]** = 이 메모 작성자의 해석. 문헌에서 인용한 수치는 초록이나 2차 요약에서 가져왔다. 본문 PDF까지 확인한 것은 따로 적었다.

현재 방식 요약: CEFR = 어휘 신호 0.5(불용어를 뺀 내용어 lemma 토큰의 80%를 덮는 CEFR 수준) + Flesch Reading Ease 0.3 + LLM 0.2. V≤4이면 B1까지, V≥5이면 B2까지 허용한다. 같은 자로 잰 결과는 수능 C1 17.8%, 고2–3 교재 C1 26–32%, 고1 교재 C1 약 6%다.

---

## 1. Flesch류 공식이 L2·학술 텍스트에도 맞는가

**발견**
- [출처] 고전 공식이 EFL에서 얼마나 맞는지는 연구마다 다르게 나온다. Brown(1998)은 EFL 난이도를 잘 맞히지 못한다고 봤다. Greenfield(1999, 2004)는 일본 대학생 자료에서 고전 공식이 모국어 화자에게만큼은 맞는다고 보고했다. — *Readability Formulas for EFL*, JALT Journal: https://jalt-publications.org/jj/articles/2622-readability-formulas-efl
- [출처] Crossley, Greenfield & McNamara(2008)의 Coh-Metrix L2 Reading Index는 단어 빈도·문장 간 유사도·내용어 중첩을 쓴다. 일본 학습자의 cloze 점수를 Flesch Reading Ease보다 잘 예측했다. — *Assessing Text Readability Using Cognitively Based Indices*, TESOL Quarterly: https://www.researchgate.net/publication/242202421
- [출처] Crossley, Allen & McNamara(2011)는 고전 공식이 표면 특징(음절 수·문장 길이)만 본다는 한계를 지적했다. 인지 기반 지표가 L2 단순화 수준을 더 잘 분류했다. — *Text readability and intuitive simplification*: https://files.eric.ed.gov/fulltext/EJ926371.pdf
- [출처] 수능 지문(2015–2022, 136지문)에 Flesch·FKGL·Fog·Dale-Chall을 적용한 연구가 있다. 결과는 문항마다 가독성 수준이 들쭉날쭉했고, 너무 쉬운 지문과 수험생 수준을 넘는 지문이 섞여 있었다. — *대학수학능력시험 영어 독해지문의 어휘다양성 및 가독성 분석*: https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002898744

**알려진 편향** [추론, 공식 구조에서 바로 나오는 것]
- Flesch는 문장당 단어 수와 단어당 음절 수만 본다. 그래서 쉬운 단어로 쓴 긴 문장은 과대평가하고, 짧지만 전문어가 많은 문장은 과소평가한다. 학술 텍스트는 다음절 전문어와 긴 명사구 때문에 대체로 C2 쪽으로 쏠린다.
- 100단어 안팎의 짧은 발췌에서는 문장 몇 개가 점수를 크게 흔든다.

**확신도**: 중. "L2에서는 고전 공식이 약하고 어휘·응집성 지표가 낫다"는 여러 연구가 같은 방향이다. 다만 개선 폭은 연구마다 다르다. Greenfield는 차이가 거의 없다고 봤다.

**함의**: Flesch에 가중치 0.3은 과하다. 보조 신호나 문장 길이 경고로 낮추는 편이 낫다 [추론].

## 2. 어휘 기반 난이도: 커버리지 임계, 대역 프로파일, 기능어 포함 여부

**발견**
- [출처] Hu & Nation(2000): 모르는 단어 밀도와 이해도를 실험했다. 98%를 알면 대부분 독해가 가능하고, 95%는 최소 수준의 이해선이다. — https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2000-Hu-Density-and-comprehension.pdf · 재현 연구: Kremmel et al.(2023), *Language Learning*: https://onlinelibrary.wiley.com/doi/10.1111/lang.12622
- [출처] Laufer & Ravenhorst-Kalovski(2010): 최적선은 8,000 word family로 98% 커버리지, 최소선은 4,000–5,000 family로 95% 커버리지다. 두 수치 모두 **고유명사 포함** 기준이다. — https://files.eric.ed.gov/fulltext/EJ887873.pdf
- [출처] Schmitt, Jiang & Grabe(2011): 661명을 조사했다. 아는 단어 비율과 이해도는 대체로 선형 관계였고, 뚜렷한 임계점은 없었다. 학술 텍스트라면 98%가 합리적인 목표라고 봤다. — https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf
- [출처] 이 커버리지 연구들은 모두 텍스트의 **전체 running words**(기능어 포함)를 분모로 쓴다.
- [출처] 2015 개정 교육과정은 학교급별 기본어휘 3,000개를 제시한다. — https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002253588
- [출처] CEFR-J Wordlist는 CVLA(CEFR-based Vocabulary Level Analyzer)에 쓰인다. — http://cvla.langedu.jp/

**현재 방식과 비교** [추론]
- 내용어만 넣고 **80%** 지점을 보는 방식은 문헌의 95/98% 커버리지와 다른 척도다. 기능어를 포함하면 한 단계쯤 내려간다는 실측(수능 C1 0.6%)이 이를 뒷받침한다. 문헌에 맞추려면 분모에 기능어와 고유명사를 넣고, 95%나 98% 지점을 봐야 한다.
- 대안은 "학습자 가정 어휘 목록 밖 토큰의 비율"을 직접 재는 것이다. 예를 들어 V6은 교육과정 3,000개에 CEFR B1–B2 lemma를 더한 목록으로 잡는다. 이 비율이 2–5% 안이면 적합이고, 98%를 넘기려면 글로스(주석)를 달아야 한다. 수능 지문이 어휘 주석(*표 단어)을 다는 관행과도 맞는다.
- 80% 지점 방식은 문턱 효과가 크다. 드문 전문어 몇 개로 등급이 바뀌거나, 반대로 전문어 밀도가 높아도 등급이 안 바뀐다.

**확신도**: 높음. 95/98% 임계와 기능어를 포함한 분모는 이 분야의 표준이다. 다만 Schmitt 등의 연구대로 이해도는 연속적으로 변하므로 임계를 절대선으로 쓰면 안 된다.

## 3. 텍스트 CEFR 자동 분류의 현황

- [출처] Xia, Kochmar & Briscoe(2016): Cambridge 시험 지문 등 CEFR 등급이 붙은 텍스트를 썼다. 어휘·통사·담화 특징 모델에 도메인 적응을 더해 정확도 0.797, 상관 0.938을 냈다. — https://aclanthology.org/W16-0502.pdf
- [출처] Uchida & Negishi의 CVLA 회귀모형은 4개 특징을 쓴다. B레벨 대 A레벨 내용어 비율(BperA), ARI, 문장당 동사 수(VperSent), 그리고 CEFR-J 어휘 비율이다. — http://cvla.langedu.jp/ · https://www.researchgate.net/publication/341998576
- [출처] Arase, Uchida & Kajiwara(2022), CEFR-SP: 전문가가 등급을 매긴 문장 17k개로 **문장 단위** CEFR 모델을 만들었다. 모델이 공개돼 있다. — https://aclanthology.org/2022.emnlp-main.416/ · https://github.com/yukiar/CEFR-SP
- [출처] LLM의 텍스트 CEFR 판정은 아직 약하다. ChatGPT-4o 연구에서 사람 판정과 일치한 비율은 58.5%(175/299)였고, B1–C2에서 크게 어긋났다. — https://files.eric.ed.gov/fulltext/EJ1466280.pdf. 반면 GPT-4는 L2 에세이 채점에서 보정 예시를 주면 기존 자동채점 수준에 근접했다. — https://aclanthology.org/2023.bea-1.49.pdf
- [출처] 청해 텍스트에 임베딩과 SVM을 쓴 모델은 정확도 0.81이었다. — https://www.sciencedirect.com/science/article/abs/pii/S2772766125000552
- Text Inspector나 Duolingo CEFR checker 같은 상용 도구의 정확도 공개치는 이번 조사에서 1차 출처를 찾지 못했다(미확인).

**중요한 특징** [출처 종합]: 어휘 수준 비율(B/A 비율, 빈도 대역)이 가장 강하다. 그다음이 문장당 동사 수 같은 통사 복잡도이고, 전통 가독성 공식은 보조 역할이다.

**확신도**: 중. 대부분 "CEFR 교재 지문"처럼 도메인이 맞는 데이터에서 잰 결과다. 학술 원문(PLOS)에 옮겨 쓰면 정확도가 떨어질 가능성이 크다 [추론].

**함의** [추론]: LLM 가중치 0.2는 적절하거나 더 줄여야 한다. 쓰려면 등급별 기준 예시(보정 예시)를 반드시 준다.

## 4. 수능 영어 지문 난이도 연구(국내)

- [출처] 교과서·EBS·수능의 어휘 수준과 이독성 비교 연구가 있다. 교과서는 가독성 59.89–66.24로 미국 8–9학년 수준이고, EBS와 수능은 **12학년 이상**이다. 수능은 3개년 어휘 3,625 type으로 교과서(1,650–1,906)의 약 2배다. 저자는 교과서와 시험 사이의 "심각한 단절"을 지적했다. — https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002131887
- [출처] 수능과 EBS 연계 교재의 어휘 분석이 있다. 어휘 세련도(lexical sophistication)에서 유의한 차이가 있었고, 2011년 이후 난이도 상승은 수능 자체 문항에서 왔다. — https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002617144
- [출처] 수능·모의고사 지문(2014–2018)의 Coh-Metrix 지표와 문항 난이도의 상관을 본 연구가 있다. — https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002580941
- [출처] 절대평가(2018) 이후 지문의 어휘·통사 복잡도 연구(2018–2021)가 있다. — https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002822578
- [출처] 2015–2022 수능 136지문은 20,698 토큰, 1,036문장이다. 평균 약 150단어, 문장당 약 20단어다(작성자 계산). — ART002898744 (위 1절)
- 평가원(KICE)이 지문 어휘 수준에 대한 공식 수치를 담은 보고서는 이번 조사에서 1차 원문을 확보하지 못했다(미확인).

**확신도**: 중상. "수능은 교과서보다 확연히 어렵고, 가독성은 원어민 12학년 이상"이라는 결론은 여러 연구가 같다.

**함의** [추론]: 수능 자체가 전통 공식으로는 대학 수준이다. 따라서 "고3 = B2까지만"은 수능 실물과 모순된다. 우리 자로 재도 수능의 17.8%가 C1이다.

## 5. 학술 원천에서 학습자 지문을 고르는 방법

- [출처] 단순화한 텍스트가 이해도를 높인다는 연구가 다수 있다. 직관적 단순화(intuitive simplification)는 어휘·통사 세련도를 낮추고 응집성 장치를 늘린다. — Crossley, Allen & McNamara(2012), *Language Teaching Research*: https://journals.sagepub.com/doi/abs/10.1177/1362168811423456 · *What's so simple about simplified texts?*: https://files.eric.ed.gov/fulltext/EJ1031308.pdf
- [추론] 수능 지문도 원문을 발췌하고 개작한 것으로 알려져 있다(업계 통념이며 1차 출처는 미확인). 그래서 비교 대상은 "원문 그대로"보다 "발췌·개작 뒤의 지문"이 맞다.
- [추론] 선택 단위: 학습자가 실제로 읽는 것은 150–250단어짜리 창이다. 전문을 잰 난이도는 서론(쉬움)과 방법·결과 절(어려움)의 평균이 되어 오판을 낳는다. CEFR-SP처럼 문장 단위 모델이 있으므로 창 단위나 문장 분포(최대·상위 분위)로 재는 것이 가능하다.

**확신도**: 단순화가 이해를 돕는다는 점은 중상이다. 창 단위 측정이 낫다는 점은 추론이지만 논리적 근거가 강하다.

---

## 결론: 현재 설계에 주는 함의

**(a) CEFR 상한을 유지할지, 자를 바꿀지**
- CEFR 라벨 자체는 유지해도 된다. 문제는 자의 보정이다 [추론].
  1. 어휘 신호를 "기능어·고유명사를 포함한 전체 토큰 중 목표 어휘 목록 밖 비율"로 바꾼다. 문헌의 95/98% 틀에 맞추는 것이다.
  2. Flesch 가중치를 줄인다(0.3 → 0.1 이하, 또는 문장 길이 경고로 전환).
  3. 등급 경계를 **수능·교재 실측 분포의 분위수로 보정**한다. 기준은 절대 CEFR이 아니라 "수능 지문 대비 백분위"다.

**(b) V6 이상에서 방어 가능한 상한**
- [추론] 우리 자로 잰 수능 C1 17.8%, 고2–3 교재 C1 26–32%와 국내 문헌(수능은 12학년 이상, 교과서의 2배 어휘)을 함께 보면, V6+에 B2 상한을 두면 실제 수능과 같은 지문의 약 1/5을 배제한다.
- 방어 가능한 안: V6은 C1 허용(단 수능 난이도 분포 90백분위 이내), V7+는 C1 허용(수능 최대치 이내), C2는 전 구간 차단(수능과 교재 모두 0%).
- 대안: 상한은 B2로 두고, C1은 "목록 밖 어휘 ≤ 5%이며 주석으로 98% 달성 가능"할 때만 통과시킨다.

**(c) 발췌 창 단위로 측정할지**
- 예 [추론]. 게이트는 학습자에게 보여 줄 발췌 창(수능 길이 약 150–250단어)에서 잰다. 원문 전체 점수는 후보를 거르는 데만 쓴다.
- 창 안에서 문장 단위 CEFR의 최댓값이나 상위 분위를 함께 본다. 짧은 창에서 Flesch는 불안정하므로 창 단위에서는 가중치를 더 낮춘다.
