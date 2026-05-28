# IEEE Paper Audit

## Scope

Audited `IDP_IEEE_Conference_Template/conference_101719.tex` and regenerated `conference_101719.pdf`.

## Final Fixes Applied

- Added explicit novelty paragraph in the Introduction.
- Added participant-exclusion accounting: five responses were excluded because of incomplete or unmatched records.
- Replaced strong significance wording with cautious preliminary wording.
- Added ethics sentence: participant data were anonymized and collected with informed consent.
- Reworked figure placement so Fig. 1 is the adaptation pipeline, Fig. 2 is the evaluation-design diagram, and no figures appear after References.
- Added recent 2025--2026 references covering LLM education agents, large-scale bandit tutoring, RL-DKT learning-path optimization, and centralized learner modeling.
- Updated the empirical participant count to 25 matched participant pairs.
- Added a preliminary baseline comparison table for fixed guided steps, uniform random, non-contextual bandit, and LinUCB.
- Strengthened the reward-weight justification by stating that the weights are educational-priority initializations requiring future calibration.
- Consolidated the graphical results into a compact research-style summary with pre/post confidence intervals.
- Split the combined graphical summary into three focused figures:
  - pre-test/post-test comparison with 95% confidence intervals,
  - topic distribution as a horizontal bar chart,
  - user feedback scores.
- Added `N` to the baseline comparison table.
- Reframed functional testing as component-level validation with metric and outcome columns.
- Expanded participant characteristics with education level, department, and approximate age range.
- Added an implementation configuration table covering frontend, backend, database, LLM service, bandit algorithm, temperature, and token limit.
- Replaced "participant pairs" with "matched participant sessions" in the abstract.

## Formatting Audit

- PDF compilation completed with Tectonic.
- Generated PDF has 6 pages.
- No overfull box warnings remained in the final compile.
- Remaining warnings are underfull hbox warnings typical of narrow IEEE columns.
- PDF text check confirmed:
  - empirical section present,
  - updated participant accounting present,
  - ethics sentence present,
  - old health-template content absent,
  - no figures after References.

## Originality / Detector-Risk Audit

This is not a formal Turnitin/iThenticate report. No local tool can honestly certify plagiarism percentage or AI-content percentage.

Actions performed:

- Exact-phrase web spot checks were run on distinctive sentences from the paper.
- No obvious exact-match external source was found for sampled unique phrases such as:
  - "response-level pedagogical strategy selection"
  - "The context vector encodes eight measurable pre-generation features"
  - "The paper formalizes a closed-loop design that connects context extraction"
  - "Each row records an auditable trace: context version, selected action, enforcement status"
  - "The weights were initialized based on educational priorities"
  - "Unlike prior educational bandit approaches that adapt curriculum sequencing"
- Local stale-claim scan found no remaining statements such as "no pilot data" or "absence of empirical results".
- Generic overclaiming language was reduced around empirical significance and educational superiority.
- Common detector-risk phrases were scanned, including "delve", "realm", "crucial", "seamless", "cutting-edge", "as an AI", and similar boilerplate wording. No actionable boilerplate remained except citation-title text and standard academic terminology.
- The LaTeX source was scanned for Unicode em dashes and en dashes. Counts were zero in the source file.
- A PDF text-extraction pass showed dash-like replacement characters in mandatory IEEE labels such as "Abstract" and "Index Terms", and in bibliography page ranges. These are formatting artifacts from the IEEE class and citation metadata, not prose-level AI-writing patterns.
- Wording was revised to remove generic claims such as "promising improvement", "positive learner perception", and "strongest systems contribution"; these were replaced with more specific academic wording.

## Remaining Academic Caveats

- Empirical study size remains small.
- Open-ended responses were scored using a heuristic completeness method.
- Results should be presented as preliminary, not definitive proof of educational superiority.
- A formal plagiarism report still requires Turnitin, iThenticate, or an institution-approved checker.
- A formal AI-content score cannot be guaranteed by rewriting alone because detector scores vary across tools and are not stable evidence of authorship.
