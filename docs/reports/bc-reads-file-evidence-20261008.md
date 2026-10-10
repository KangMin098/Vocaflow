# BC Reads Level 5: paired file evidence (2026-10-08)

This is a **new evidence revision** after the [initial source screen](./bc-reads-calibration-source-screen-20261008.md). It does not alter that earlier screen or any sealed benchmark selection, screening, manifest, admission, or calibration decision. Both source PDFs, extracted text, scripts, and the create-only boundary record remain outside Git at `C:\Users\Administrator\Documents\영어\공개참조\bc-reads-screen-20261008`.

## File identity and scope

| Artifact | Download source | SHA-256 | Pages |
|---|---|---|---:|
| 2015 Reader 5 PDF | [eCampusOntario OER repository record](https://openlibrary-repo.ecampusontario.ca/xmlui/handle/123456789/382) | `e8b250feb85883e5ce23ad7d4c8ef129999faecfe72f69a534d8f3bf0d6f9bea` | 50 |
| 2015 Course Pack 5 PDF | [eCampusOntario OER repository record](https://openlibrary-repo.ecampusontario.ca/xmlui/handle/123456789/375) | `7e2e88aacfede2513a180495465df95eaab7b104d429008a39719fb6ae9d54d0` | 173 |
| Current publisher Reader PDF, cross-check only | [BCcampus collection](https://collection.bccampus.ca/textbook/YRUgfCf8/) | `0c5e1da8d6aaf364bcfbb942052e2e982dd1a73bc45bdb0f5a7c88aea24b7775` | 43 |

All three local files have PDF signatures and were parsed with the repository's `pdfjs-dist` 6.3.289. The paired **2015 repository copies** are the only inputs to the boundary record. They must not be silently substituted with the newer publisher PDF: the Reader has a different file hash and pagination. The [Reader publisher version history](https://opentextbc.ca/abealfreader5/back-matter/versioning-history/) records later changes, including audio; the [Course Pack version history](https://opentextbc.ca/abealf5/back-matter/versioning-history/) is separate. The repository copies are identified by repository item and exact bytes; a specific internal version number has not been asserted for those PDFs.

Both PDFs identify Shantel Ivits and BCcampus and print a CC BY 4.0 notice with exceptions. The Reader's selected prose is in its own chapter; credited pictures and audio are outside the extracted passage. The Course Pack links its chapters to the Reader and supplies questions and answers for the same named chapter. This establishes a plausible paired text/exercise lineage for **internal analysis**; downstream reuse still needs per-excerpt rights review and attribution handling. [Publisher Reader](https://opentextbc.ca/abealfreader5/), [publisher Course Pack](https://opentextbc.ca/abealf5/).

## Extraction boundary record

External `boundary-evidence-v2.json` SHA-256: `d7eb675e283357bbfccc0b8417964b82f0d2d672aab1002919bcc81d2408f855`. It records exact direct-download URLs, file hashes, PDF page numbers, unique start/end anchors, and SHA-256 of NFC-normalized whitespace-collapsed `pdfjs-dist` text. This is a **candidate evidence record**, not the engine's sealed passage candidate or admission receipt.

| Interval in 2015 PDFs | PDF page(s), 1-based | Extracted text SHA-256 |
|---|---|---|
| Reader chapter prose, first to last paragraph | 8–9 | `6d10a801b47bc35e4a9439171feae3758a738f8b96436569bd326db904848801` |
| Course Pack “Check Your Understanding” questions | 12–15 | `4ebda4941143130891d3abd92088b344d50578b3060cbf73046a84829f68964f` |
| Course Pack matching answer-key section | 22–23 | `cd9eed396ff7273efbf5623311c15892c24d68cd04302a7bc9231ba1358b8e2d` |

The interval hashes bind a reproducible extraction, but the engine's passage/item boundary receipt, independent selection recomputation, and new two-stage manifest have **not** been issued. The older PDFs include formatting and OCR-like spacing differences from the current online chapters; no cross-version text equality is presumed.

## Korean-grade mapping decision

The publisher defines Level 5 as **adult literacy** and says it is roughly equivalent to Canadian K–12 grades 6–7.5. [Reader description](https://opentextbc.ca/abealfreader5/). The [Korean Ministry of Education's 2022 curriculum notice](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&boardSeq=93458&lev=0&searchType=null) establishes the implementation schedule for Korean school grades; it does not map this Canadian adult-literacy passage to M1, M2, or any other Korean grade. These are two distinct systems, not two independent corroborations of a conversion. No Korean-grade comparison passage set, two blind mapping reviews, or adjudication exists for the selected text. Mapping remains `hold`; no relative M1–M2 band or confidence is recorded.

Current gate state: file bytes and provisional passage/item/key boundaries **recorded**; source-version match to current publisher distribution **unresolved**; passage-level rights review **pending**; Korean-grade mapping **hold**; independent nine-axis rating for this exact pair **unopened**. BC Reads remains a held candidate. Open-reference admitted N=1 (NASA), calibration-eligible N=0, real Korean-grade distribution N=0, commercial benchmark N=0, Gold-S=0, DB seed=0, `production_verified=false`.
