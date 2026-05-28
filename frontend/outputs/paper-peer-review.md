# Peer Review: Response-Level Pedagogical Strategy Selection Using Contextual Bandits in LLM-Based Tutoring Systems

## Verdict
Borderline workshop / systems short-paper. The manuscript is substantially stronger than the earlier whole-app paper because it has a precise niche, restrained claims, measurable hypotheses, and a clear evaluation protocol. It is not Q1-ready because it still lacks empirical evidence.

## Technical Validation
- LaTeX compilation with Tectonic succeeded.
- PDF output generated successfully.
- No fatal LaTeX errors found.
- No undefined citations found.
- No overfull boxes found.
- All `\cite{...}` keys have matching `\bibitem{...}` entries.
- No uncited bibliography entries found.
- Rendered PDF is 4 pages.
- Page 1 renders title, abstract, research question, and hypotheses.
- Page 3 renders the closed-loop pipeline figure clearly.
- Remaining warnings are font-substitution warnings from the local TeX environment; they do not block PDF generation.

## Strengths
- The paper has a defensible research question: response-level pedagogical strategy selection under sparse online feedback.
- Novelty is now positioned correctly against prior educational bandit work: curriculum sequencing and feedback targeting are distinguished from response-form selection.
- The hypotheses are explicit and measurable.
- The manuscript avoids unsupported claims of learning gains.
- Prompt enforcement is a distinctive systems contribution and is framed as an audit layer rather than proof of pedagogical quality.
- The delayed reward attribution discussion is important and relevant to deployed tutoring systems.
- The threat model improves reviewer trust by naming reward hacking, policy collapse, telemetry sparsity, and learner risk.

## Major Weaknesses
1. No empirical results are present. This is the dominant rejection risk for any strong conference or journal submission.
2. Reward weights remain heuristic. The paper acknowledges this, but reviewers can still ask why the specific 0.4/0.3/0.2/0.1 weighting should be trusted.
3. The context vector is interpretable but coarse. Cognitive state, engagement, topic status, and performance trend are plausible, but not validated against learning outcomes.
4. LLM tutor related work is still compact for journal style. It is acceptable for a short systems paper, but a journal version needs a deeper literature survey.
5. The evaluation protocol is strong as a plan, but it is still a plan. The paper should not be submitted as empirical research without at least a pilot study.

## Rejection Risks
- Reviewer says the paper is "architecture only" and lacks evidence that the bandit improves either operational reward or learning.
- Reviewer says response-level strategy selection is interesting but not sufficiently novel without experiments.
- Reviewer challenges reward validity and notes that engagement can be optimized without comprehension.
- Reviewer asks whether prompt enforcement only forces formatting rather than real pedagogical quality.
- Reviewer asks whether the LinUCB linear assumption is appropriate for learner-state interactions.

## Highest-Impact Next Fixes
1. Add a small pilot evaluation, even if limited to operational metrics.
2. Report at least descriptive statistics: action distribution, enforcement failures, reward resolution rate, and average reward by action.
3. Add a calibration section or appendix explaining why the current reward weights are starting values, not final educational measures.
4. Expand related work with more LLM tutor evaluation papers if targeting a journal.
5. Add a table mapping each threat to a concrete mitigation.

## Publishability Estimate
- Workshop: high chance.
- SIGCSE short/demo: moderate to high chance.
- EDM/LAK short: moderate if framed as systems/evaluation infrastructure.
- AIED full: low without experiments.
- Q1 journal: low without empirical validation.

## Bottom Line
The paper is now credible as an evaluation-ready systems contribution. It is not yet validated research. The current version should be submitted only to venues that accept architecture, tooling, or early-stage systems papers, unless a pilot or controlled evaluation is added.
