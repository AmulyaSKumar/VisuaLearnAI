# Turnitin Fallback Audit

This is not a Turnitin report. Turnitin access is not available in this workspace, so this audit uses local text extraction, AI-writing pattern checks, repetition checks, and targeted exact-phrase web searches.

## Files Checked

- `IDP_IEEE_Conference_Template/Visualearn-Paper(NoauthornReferences).pdf`
- `IDP_IEEE_Conference_Template/conference_101719_anonymous_no_refs.tex`

## AI-Writing Pattern Scan

Detected terms:

| Pattern | Count | Notes |
|---|---:|---|
| robust | 1 | Appears in an academic/statistical context. Low concern. |
| significant | 2 | Used for statistical significance and limitations. Low concern. |

Not detected:

- delve
- realm
- underscore
- tapestry
- landscape
- testament
- seamless
- transformative
- crucial
- furthermore
- moreover
- in conclusion
- it is important to note
- plays a vital role
- not only

## Repetition Scan

Repeated phrases were mostly technical lists or repeated terms that are expected in the paper:

- cognitive state, engagement level, topic status, performance trend, confidence, topic difficulty
- correctness, engagement, completion, and retention
- prompt enforcement, delayed reward attribution
- Transformer Attention, CPU Scheduling, Blockchain, Neural Networks

No suspicious repeated boilerplate paragraph pattern was found.

## Targeted Plagiarism Web Search

Exact-search checks were run for distinctive phrases from the paper, including:

- "This work studies response-level strategy selection for an LLM tutor"
- "The first version uses six actions rather than a larger menu of teaching moves"
- "The system keeps policy decisions inspectable, stores delayed reward signals"
- "Can contextual bandits support practical response-level pedagogical strategy selection"

No exact copied source was found in the search results. General LinUCB and contextual bandit pages appeared, but they did not match the paper wording.

## Risk Assessment

- AI-content risk after the recent edits: low to moderate.
- Plagiarism risk from exact-match search: low.
- Remaining limitation: this is not a substitute for Turnitin or iThenticate because it cannot compare against closed student-paper repositories, subscription databases, or Turnitin's internal corpus.

## Recommendation

The paper is cleaner than before and does not show obvious copied text in the checked passages. If Turnitin still flags content, edit only the newly highlighted sentences rather than rewriting the full paper.
