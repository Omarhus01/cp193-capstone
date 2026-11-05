# 0018. Fixed Q&A is stored, reviewed content, not a mock AI answer

- Status: Accepted
- Date: 2026-11-04
- Issue: #5

## Context

The surah page's Q&A panel should show each reading section's fixed questions and, when a reader chooses one, the prepared answer with its sources (proposal §3.1). Asking your own question comes later, through the RAG service (#10).

Issue #5 planned to route the fixed questions through `RetrievalProvider` (`lib/ai`), with a mock serving prepared answers from `content/`. That would make the owner's answers look like AI output and keep them outside the content pipeline. They would skip the review steps, the validation, the passage records behind the source chips, and the row level security that hides unpublished text.

The owner's Al-Fatiha draft (`docs/content-drafts/al-fatiha.md`) writes eight questions, two per reading section. Each has an English and a Korean answer and cites the same sources as the explanations.

## Decision

- **Content:**
  - Fixed questions live in `content/surahs/NNN/qa.json`, one entry per question.
  - Each entry has a span of whole verses, the question and answer in English and Korean, its citations, and a status with a review history.
  - They go through the same review steps as explanations: `draft → en_approved → ko_drafted → ko_approved → published`.
- **Validation:**
  - Every answer cites at least one passage that exists in `content/sources/`, at every status, not only once published.
  - The span covers whole verses of its own surah.
  - Banned terms (ADR 0008) are checked as in all content.
- **Database:**
  - New tables `qa_question`, `qa_question_citation` and `qa_question_review`, seeded by `seed_content`.
  - Readers see only published questions and their citations.
  - The review history is private.
  - A passage becomes readable once a published question cites it.
- **Attachment:** a question attaches to text (a span, as in ADR 0012), not to a reading section id. The page lists it under the section that holds the first verse of its span. Sections can then move without editing the questions.
- **Page:**
  - `lib/data/content.ts` (`getSurahQuestions`) loads the published questions.
  - `lib/services/qa.ts` groups them by section.
  - `QaPanel` lists the questions of the section in view, and choosing one opens its answer with source chips, as the explanations have.
  - A question with no visible source is left out, so an answer is never shown without its sources.
- **AI provider:** `RetrievalProvider` stays in `lib/ai` for questions a reader types (#10). The free-text box stays disabled as "Coming soon".

## Alternatives

- **Prepared answers through the mock `RetrievalProvider`, as #5 first planned:** no new tables, but the answers would bypass review, RLS and the passage records. The page would also treat the owner's validated text and future generated text the same way.
- **Questions as a part of each reading section's explanation:** no new tables either, but a question's status would be tied to the explanation's. A question also isn't one of the four explanation parts the proposal defines.
- **Attach questions to a reading section id:** simpler grouping, but a change to the reading sections would mean editing every question.

## Consequences

- The owner writes and reviews questions like explanations, and the seed loads them. No code change is needed to add one.
- `seed_content` reads the `qa_*` payload keys as empty lists when they are missing, so a seed from code that predates this decision still runs. It leaves no questions in that case. Every other key is still required.
- Issue #5's acceptance criteria about the mock serving prepared answers are replaced by this record. The mock and its "decline without citations" rule remain for #10.
- When the RAG service arrives, the panel shows two kinds of answer: stored answers to fixed questions, and generated answers to typed ones. The UI should keep them visibly distinct.
