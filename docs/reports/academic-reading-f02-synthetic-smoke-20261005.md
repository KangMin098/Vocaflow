# F02 Synthetic Classroom Smoke v1

F02의 실제 학생 pilot은 미봉인 상태로 보존하고 새 **합성 진단 경로**를 추가했다. 14개 epistemic profile × 고정 본문 2개에서 blind 패킷 28개를 재현 가능하게 내보낸다. 생성/응답/채점을 같은 모델 계열이 혼자 수행하지 않도록 응답 import에서 모델 계열 분리를 요구한다. 문항 ID·답변·0/0.5/1 점수, 현재 채점키 해시를 확인한 뒤 지문 언어 지표와 합성 문항 기술 통계만 낸다. [실행 계약](../../scripts/textbook/frym-synthetic/README.md).

이 smoke에는 아직 모델 응답, 외부 benchmark, 실제 학생 데이터가 없다. `student N=0`, `synthetic response N=0`, `gold=0`, `DB seed=0`이다. 따라서 자동 seal은 **입력 동일성**만 뜻하며 학년별 절대 난도, IRT 모수, `TARGET_FIT`, `LEVEL_SEPARATION`, Gold-S 또는 seed 자격을 부여하지 않는다. 응답이 들어와도 외부 기준에 대한 예측력과 모델 간 일치도를 재기 전까지 판정 상태는 `synthetic_diagnostic_unbenchmarked`다.

근거의 적용 범위를 분리했다. [Que et al.](https://aclanthology.org/2026.findings-acl.302/)은 능력별 단일 LLM의 편향을 보고했고, [Acquaye et al.](https://aclanthology.org/2026.findings-acl.1807/)은 **수학 객관식/NAEP**에서 합성 응답 기반 난도 추정 가능성을 시험했다. 이 결과를 F02 영어 독해나 한국 중1·고1의 정답률로 직접 옮기지 않는다. [Olivera-Aguilar et al.](https://aclanthology.org/2026.aimecon-wip.9/)은 합성 자료의 문항 모수 복원이 불충분할 수 있음을 보고했다. 이에 v1에서는 IRT를 계산하지 않고, 향후 외부 기준과 대조한 예측 성능이 확보될 때 별도 revision으로 판정 기준을 정한다.
