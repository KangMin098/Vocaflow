// apps/web/src/lib/textfit/sample.ts
//
// `/fit` 예시 지문 — **서버와 클라이언트가 같은 문장을 봐야 한다.**
//
// 왜 상수를 따로 뺐나 (2026-09-05): 원래 `PublicFitClient.tsx` 안에 있었다. 이제 서버가 도착 전에
// 이 지문을 분석해 결과를 내려주므로(`sample-profile.ts`), 서버가 분석한 문장과 화면의 입력칸에
// 미리 채워지는 문장이 **글자 하나까지 같아야** 한다. 두 곳에 각각 적으면 언젠가 갈라지고,
// 그때 방문자는 자기가 보고 있는 지문이 아닌 다른 지문의 숫자를 보게 된다.
//
// 자체 작성 문장이다(인용 아님). 러닝 워드 약 100 · `MIN_CHARS`(120자)를 넉넉히 넘는다.

export const FIT_SAMPLE = `Scientists have long assumed that memory decays at a predictable rate, but recent evidence
suggests the process is far more contingent than that. When learners encounter a word repeatedly in
meaningful contexts, the retrieval pathway is reinforced disproportionately compared with isolated
rehearsal. This has substantial implications for classroom instruction: allocating scarce time to
massed drilling may be considerably less efficient than distributing the same effort across weeks.
Nevertheless, the prevailing curriculum still favours concentrated review, largely because it is
easier to administer and to measure.`
