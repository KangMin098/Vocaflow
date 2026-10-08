# BC Reads 2015: independent pre-admission rating and Korean mapping review

This is a new, external-file-bound **review evidence revision** for the paired PDF files in [the file report](./bc-reads-file-evidence-20261008.md). It is **not** an admission analysis receipt, calibration decision, Korean-grade distribution, or update to prior seals. Raw source text, rating packets, CLI outputs and the create-only audit record remain outside Git at `C:\Users\Administrator\Documents\영어\공개참조\bc-reads-screen-20261008`.

## Source and packet binding

The 2015 Reader PDF, Course Pack PDF, and their prose/item/key intervals retain the hashes in the file report. The same institutional repository also provides a Reader HTML export (SHA-256 `6b253e03c47c80adaf73c3193a1769eece52f37e9583c10bf929b8a129412b76`) and Course Pack HTML export (SHA-256 `3050b0e86c10c636397bf0375af87e8dfb074c8999c42ff0fa5b0ea5763ad6d6`). Their named chapter and question headings were checked against the PDF interval anchors. The HTML restores four prose paragraphs and question structure for rating, but full cross-format text equivalence has **not** been certified. The answer-key interval was hashed separately and **excluded from both rater packets**.

The first packet, derived from flattened PDF text, was scored by both clients but designated **exploratory / non-validating** after both noted repeated prompts, inserted page headers, lost punctuation and paragraph flattening. Its hash is `ecd6b04b1d24a45ac0d6f9ba0172989ebf9a92b36df52f47a6baa540b8742688`; those scores were not combined with the revision below.

A fresh HTML-structured packet was created from the same archived pair and checked for the four objective question headings in the PDF extraction. Packet SHA-256 `7719e57058a6371036d6c9e8f10d3cb6d7da45ae6b144878214e58f4ad0cad0f`; nine-axis codebook SHA-256 `03cc30baeaa27f67c5ce35d300e86321422b9af37a9b8d4e0530722c051170b5`. The codebook uses the prior ordinal 0–4 axes; its background-knowledge anchor speaks of outside science knowledge, relevant to this brain-themed passage. Objective comprehension items 1–4 were rated; opinion item 5 was excluded. The two clients received byte-identical packets and neither received the answer key or the other's score. Local client-output evidence does not attest what any provider actually processed.

## Independent scores and adjudication

| Axis | Claude Code | Codex CLI | Resolved |
|---|---:|---:|---:|
| lexical | 2 | 2 | 2 |
| syntax | 2 | 2 | 2 |
| information density | 2 | 2 | 2 |
| discourse | 2 | 1 | 1 |
| inference | 1 | 1 | 1 |
| background knowledge | 2 | 0 | 1 |
| abstraction | 2 | 2 | 2 |
| item difficulty | 2 | 2 | 2 |
| processing load | 2 | 2 | 2 |

Seven axes agreed. A separate Claude Code Opus invocation received the two disagreement scores, reasons, passage and items under adjudication packet hash `2eddf374ad473821088b162c8be127b4a7391b4260a6e95abc67675dbd1e6b5b`. It resolved discourse to 1 because the paragraph roles and sequence are explicitly marked and the objective items do not require substantial cross-paragraph relation building. It resolved background knowledge to 1: the prose defines its main neuroscience terms, although prior familiarity modestly reduces burden. This is a **third local client call**, not a distinct third provider family or a human expert decision.

Both raters and the adjudicator flagged remaining source issues: question 3e asks about “smarter” whereas the text compares computational power; question 4c asks about speed while the passage says power. The archived HTML also contains replacement question marks for some punctuation and flattens a purpose/example table. Scientific assertions were rated as written and were not fact-checked. These issues require item-grounding and text-quality review before any canonical analysis receipt; the resolved vector is **provisional pre-admission evidence**.

## Korean-grade mapping review

A separate packet, hash `dc2d277e704830de88900a5ab46b085f5f7fcdf377334032228056639b9c304c`, gave two blind reviewers the publisher's Adult Literacy Level 5 description, its approximate Canadian K–12 comparison, the Korean Ministry of Education's [2022 curriculum notice](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&boardSeq=93458&lev=0&searchType=null), the provisional nine-axis vector and the **zero** Korean comparison-cohort count. Both independently returned `pending`, `korean_band=null`, `confidence=none`. The Ministry notice establishes a Korean implementation schedule, not a conversion between BC adult-literacy and Korean school reading difficulty. A relative M1–M2 candidate would be an unsupported guess here.

## Audit and state

External `review-audit.json` SHA-256: `602c3f04f85c566448739f3f108db49578380738faccb15229d1e6af1085962c`. Packet generation rechecked the two PDF hashes and computed the HTML hashes. The local audit checked the bound packet, identical blind copies, all nine integer/rationale fields, output and adjudication hashes, exact disagreement set, and completed Codex CLI event logs. The requested Claude aliases were Sonnet for rater A and Opus for adjudication; Codex used its local default. Returned provider model IDs and provider-signed prompt receipts were not available. This establishes a **locally auditable cross-client review**, not provider attestation.

Current status: `pre_admission_rating_review=complete_provisional`; `Korean-grade mapping=pending`; `item-grounding review=pending`; new admission **unopened**; calibration-eligible N=0; real Korean-grade distribution N=0; commercial benchmark N=0; Gold-S=0; DB seed=0; `production_verified=false`.

Before promotion, independently inspect the exact 2015 passage/item/key for text accuracy and item grounding; seal a new selection/screening/manifest and source rights decision; re-run the canonical analysis against that receipt; and compare with an independently admitted Korean-grade reference cohort. Preserve these preliminary outputs under their current hashes if any input changes.
