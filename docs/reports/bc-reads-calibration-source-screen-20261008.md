# BC Reads Level 5 calibration source screen (2026-10-08)

Status: **hold; no selection, admission, or calibration decision issued**. This is a primary-source screen for one matched passage and exercise set, not a new sealed screening revision. Existing NASA admission and all prior seals remain unchanged.

| Evidence | Primary source | Finding |
|---|---|---|
| Reader identity and license | [Reader 5](https://opentextbc.ca/abealfreader5/) | Shantel Ivits, BCcampus, 2015, eBook ISBN 978-1-989623-93-0. The book states CC BY 4.0 except where otherwise noted and calls its nine stories original adult-literacy texts. |
| Passage | [The Most Amazing Structure on Earth](https://opentextbc.ca/abealfreader5/chapter/chapter-1/) | One chapter contains the prose passage. Third-party images/audio are separately identified; the candidate would include prose only. The chapter links the matching Course Pack chapter. |
| Matched items and key | [Course Pack 5 chapter](https://opentextbc.ca/abealf5/chapter/chapter-1/) | “Check Your Understanding” items and an Answer Key appear in the same named chapter. The Course Pack also states CC BY 4.0 except where otherwise noted. |
| Reader version | [Versioning history](https://opentextbc.ca/abealfreader5/back-matter/versioning-history/) | Reader 5 lists version 1.02, with the 2022 change adding audio. |
| Course Pack version | [Versioning history](https://opentextbc.ca/abealf5/back-matter/versioning-history/) | Course Pack 5 lists version 1.02, with a 2021 front-matter change. Reader and Pack have **separate** version histories. |
| Native level | [Reader 5](https://opentextbc.ca/abealfreader5/) | Adult Literacy Fundamental English Level 5, described as roughly equivalent to Canadian K–12 grades 6–7.5. It was written for adults. This is **not** a Korean middle-school label or evidence that Korean students experience the same difficulty. |

The linked passage/item/key and source license make this a stronger *intake candidate* than the previously held sources. They do not by themselves satisfy the file-backed contract. Direct retrieval of the publisher HTML from the local execution host returned a Cloudflare JavaScript challenge. Consequently, this screen has **no trustworthy local source-file hash, passage hash, item hash, boundary hash, or version-bound snapshot**. A web-search rendering is useful for discovery but cannot substitute for the bytes the admission engine checks. No passage candidate, new screening revision, sample manifest, nine-axis assessment, or admission receipt was created.

Gate decisions for this screen:

- `source_version_verified`: **hold** until a retrievable Reader and Course Pack artifact is fixed by separate byte hashes and chapter locators.
- `passage_level_rights`: **hold for the file-backed decision** until the chosen text and exercises are each verified against their CC BY statements and third-party exclusions in those exact artifacts. The publisher pages provide strong preliminary license evidence; the candidate excludes images, audio, and logo.
- `boundary_verified`: **hold** until paragraph/item/key ranges are identified in the fixed artifacts and their hashes are recorded.
- `Korean-grade mapping`: **hold**. Canadian adult-literacy/K–12 equivalence cannot be promoted to a Korean school grade without independent mapping evidence and review.
- `independent nine-axis rating`: **unopened**; no sealed passage or reviewer packet exists for this candidate.

The Reader passage also contains dated or simplified science claims. Any later use as an Academic Reading reference should include content-accuracy review; the license and reading-level labels do not establish scientific correctness.

Next admissible action: obtain the publisher's downloadable Reader 5 and Course Pack 5 artifacts through an authorized browser/download path, preserve them outside Git, verify both hashes and chapter boundaries, then issue a **new** selection/screening/manifest revision before rating. Separately gather two independent Korean-grade anchors and a reviewed mapping rule. Do not import this adult-literacy level as a Korean grade by conversion alone.

No state changed: open-reference admitted N=1 (NASA), calibration-eligible N=0, Korean-grade distribution N=0, commercial benchmark N=0, Gold-S=0, DB seed=0, `production_verified=false`.
