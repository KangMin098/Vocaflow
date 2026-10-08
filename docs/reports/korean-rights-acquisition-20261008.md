# Korean textbook evidence acquisition: focused pair

This is a focused acquisition dossier, **not** a new screening, sample manifest or admission. The prior sealed `hold` records remain authoritative. It narrows the next rights request to locally available material with a publisher ISBN match and a corresponding answer file.

## Local and publisher evidence

The read-only probe first checked each source SHA-256 against inventory `source-review-r3b.json` (SHA-256 `6a2b345ecd436941220f666f7dfba63fe79ba6cc32909b8847498e7fdc080ba6`). It inspected front and final PDF pages for ISBN, edition and grade markers; it did not promote extracted passages to candidates or evaluate their nine-axis difficulty. Original PDFs remain outside Git.

| Local artifact | File evidence | Publisher cross-check | Limit |
| --- | --- | --- | --- |
| `22 리딩인사이드 Level 2_본문_미리보기.pdf` (inventory 13) | SHA-256 `6e4ec22873ddf22fccf452f9f631aa1061df37dc44a47624dcf481542dd9e1a2`; 14 PDF pages; final page has ISBN `979-11-253-4032-4`. | [NE Books product](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000126) lists the same ISBN, 2022 revised Level 2 and middle grades 2–3. Captured HTML outside Git: `readinginside2-official-20261008.html`, SHA-256 `49aa82ade3d63d3ba23071f883131f09e2e6ae3baf65f4ed14817d9191ad9f12`. | ISBN match strengthens product identity. The local preview's precise print/download revision, internal-analysis rights and reviewed passage/item/key boundaries remain unverified. |
| `달곰한 literacy Reading 2권_미리보기.pdf` (inventory 24) | SHA-256 `b884d88700cc5b17189b937000846635c724435a47bad57c9b3daa34ec08f704`; 33 PDF pages; final page has ISBN `979-11-253-4828-3`. Preview metadata contains Unit 1 `Vegan Fashion Saves the Earth` and Unit 3 `Potato Chip Surprise`. | [NE Books product](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000134) lists the same ISBN, January 2025 release, elementary grades 3–4 and an answer/explanation resource. Captured HTML outside Git: `dalgomhan2-official-20261008.html`, SHA-256 `2bbeb9da16195a912c34b324334cb51237eef9c42169e1462c92e9abfa6532dd`. | The file is a partial preview. ISBN and unit titles support product identity, but do not by themselves prove the selected passage, items and key belong to one exact revision. |
| `달곰한 Literacy L2_정답및해설.pdf` (inventory 22) | SHA-256 `c61f8c3895f6dce35111b0a646b0f136dc455762fad7da7f1dbc5546cf483fbf`; 40 PDF pages. The first answer pages name the same Unit 1 and Unit 3 and refer to book page intervals. | The same [NE Books Level 2 page](https://www.nebooks.co.kr/pages/book/view.asp?c=BB07000134) advertises an answer/explanation PDF. | Title and unit alignment is **pairing evidence**, not a verified answer-key download URL, page-by-page item matching or grounding decision. |

The publisher's [research/sample-book notice](https://m.nebooks.co.kr/pages/customer/notice/?nid=1014) was captured outside Git as `nebooks-research-notice-20261008.html`, SHA-256 `38cb5f4c7538de4b00d5509e02508b0994813f9792a5486560e6fbb7410a42db`. It describes a distributor inquiry route; it does **not** grant extraction, model processing, corpus retention or commercial benchmark analysis. A filename search under `C:\Users\Administrator\Documents\영어` found no file named as a purchase agreement, permission, license or terms record for these works. The owner subsequently confirmed that no agreement or written permission covering either named textbook is available. This is a current evidence state, not a claim that permission could never be obtained.

## Gate decision

`달곰한 Literacy Reading Level 2` is the strongest **rights-acquisition target** in this local set: official/local ISBN match plus a corresponding local answer file. `Reading Inside Level 2` has an ISBN match but no corresponding local answer file in the inspected set. Both stay `hold_metadata`:

- `edition_file_binding = partial`: exact ISBN match, but preview/download revision and answer-file origin not yet sealed.
- `grade_scope = publisher_claim_only`: catalog labels are known; local grade-scope review and its file binding are pending. Elementary 3–4 remains a range.
- `analysis_rights = unknown`: no document granting the planned internal extraction and AI-assisted analysis was located.
- `passage_item_key_boundary = pending`: document-level title/unit links do not prove per-item spans or keyed answers.
- `grounding = unopened`; `nine_axis = unopened`; `metadata_eligible = false`.

No new screening revision, selected ID, manifest hash, analysis receipt or admission receipt was issued. This is an evidence refinement on the existing hold, not a change to the prior sealed decision.

## Exact permission needed

The rights holder should identify the covered ISBN(s), whether the local partial preview and answer PDF are included, and whether Vocaflow may: (1) extract and store selected English passage, question and key text for internal comparison; (2) submit those excerpts to Claude Code/Codex or other named external model processors for independent nine-axis and item-grounding review; (3) retain hashes, brief evidence spans, scores and aggregate distributions; and (4) use the resulting metrics in a commercial platform without distributing the original textbook content. The grant should state third-party-content exclusions, attribution, processor/retention limits and expiry. A purchase receipt, teacher-copy access or permission for classroom display alone is insufficient for this specified workflow.

A concise request to the rights holder, **prepared but not sent**, is:

> Vocaflow의 교재 난도 비교 기준 개발을 위해 『달곰한 Literacy Reading Level 2』(ISBN 979-11-253-4828-3)의 일부 영어 지문·문항·정답/해설을 내부적으로 추출하고, Claude Code 및 Codex를 통한 독립 난도·정답 근거 분석에 사용하는 허가 범위를 확인하고 싶습니다. 원문이나 문항을 이용자에게 재배포하지 않고, 출처·해시·측정값·집계 분포만 보관·활용하려 합니다. 제공된 미리보기와 정답 PDF가 이 범위에 포함되는지, 상업 서비스의 내부 연구/검증 사용과 외부 AI 처리, 보관 기간, 제3자 저작물 제외 범위 및 필요한 표시 조건을 서면으로 알려 주시기 바랍니다.

No message to the publisher was sent. If a covered grant or applicable terms already exist, its location and exact scope can be reviewed without placing the document or any secret in Git. After rights verification, the next step is a visual passage/item/key boundary review, a **new** screening revision and independent manifest recomputation; nine-axis rating follows only if that gate passes.

## State

Korean eligible passage N=0; Korean comparison cohort N=0; existing NASA open-reference admission N=1; `CALIBRATION_REFERENCE eligible N=0`; real Korean-grade distribution N=0; Gold-S=0; DB seed=0. The at-least-one eligible-passage target is still open because the external rights grant has not been established.
