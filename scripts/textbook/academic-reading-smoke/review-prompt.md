Read only `{{WORK}}/F02-review-packet.json`. Independently compare F02-middle1 and F02-high1 with the complete FYM source, full target profile, article-specific rights evidence, and preservation rule. Do not inspect another reviewer's response or alter files.

Return **only** a valid JSON array, one object per adaptation, with:

- `id`: exact adaptation ID;
- `verdict`: `pass`, `reject`, or `insufficient_evidence`;
- `dimensions`: boolean values for `claim_preserved`, `relation_preserved`, `scope_preserved`, `epistemic_strength_preserved`, `no_hallucinated_content`, `lexical_target_fit`, `syntax_target_fit`, `reasoning_target_fit`, `age_appropriateness`, `overall_level_fit`, `rights_and_attribution`, and `item_evidence_supported`;
- `distortions`: only taxonomy codes from `CAUSE_REVERSAL`, `SCOPE_EXPANSION`, `SCOPE_REDUCTION`, `CLAIM_STRENGTHENING`, `CLAIM_WEAKENING`, `CONTRAST_LOSS`, `CONDITION_LOSS`, `ADDED_CAUSALITY`, `UNSUPPORTED_DETAIL`, and `KEY_DETAIL_OMISSION`;
- `source_quote` and `passage_quote`: exact substrings of the supplied source and adaptation;
- `rationale`: specific explanation of meaning, target fit, rights, and question evidence;
- `concerns`: array of additional observations.

Mark a failed dimension false and reject a material semantic distortion. Use `insufficient_evidence` if the packet cannot establish a required dimension; describe that uncertainty in `rationale`. Do not treat the proposed age/V-Level target or an agent's impression as measured student difficulty.
