# 0021. Athars as the search over tafsir books, with Shamela links built from its results

- Status: Accepted
- Date: 2026-11-05
- Issue: #43 (Sprint 1 documentation)

## Context

Chat answers are written from passages in tafsir books ([decision record: stored explanations, generated chat answers](0020-stored-explanations-and-generated-chat-answers.md)). Something has to find the passages closest to a reader's question, across many long Arabic books, and say where each passage is, so the answer can cite it.

Building that search ourselves means getting the books' text, splitting it into passages, storing them, and ranking them by how close they are to a question. The proposal plans this as several steps of its own (section 3).

Athars is a chatbot built by another Minerva student. It searches a library of tafsir books by meaning, takes questions in any language, and cites the book and page of each passage. It came out best of the five platforms the proposal compares (proposal, section 2.5). Its developer agreed to give this project access to its search through an API.

On the surah page, a source chip already opens the cited page on Shamela, an online library of Islamic books. Those links have the form `https://shamela.ws/book/<book>/<page>`, for example `https://shamela.ws/book/23604/47` for Ibn Kathir's tafsir.

## Decision

- **Athars is the search.** The question-answering service sends a reader's question to the Athars search and gets back the closest passages from tafsir books. It does not keep its own copy of the books or its own search index.
- **Links to Shamela are built from each result.** For each passage, Athars returns the Shamela id of the book (`book_id`) and the id of the page where the passage starts (`start_page_id`). The service builds the link as `https://shamela.ws/book/<book_id>/<start_page_id>`, the same form as the links in the content files, so a chat answer's source chip opens the book at the right page, just as the surah page's chips do.
- **The rest stays in this project:** writing the answer from the passages, in the reader's language, and declining when they don't support one.

## Alternatives

- **Build our own search over the tafsir books**, as the proposal's plan first broke it down: choose a model, store the passages, retrieve them. Full control over the books and the ranking, but it means collecting the books' text and tuning the search ourselves, within one five-week sprint and without experience of a model this size. It stays the fallback if Athars stops fitting.
- **A public tafsir API organized by verse** (such as the one Quran.com offers). It gives the tafsir of a given verse, but it can't find passages by the meaning of a question, and its results don't point to a book and page on Shamela.
- **Ask a model with no search behind it.** The answer would have no passages to cite, which breaks the rule that every answer shows its sources.

## Consequences

- The chat gets a search that already works well on the books, without the project storing them.
- The project depends on a service it doesn't run. If Athars is down or changes its results, the chat can't answer. The service then declines with a message, and the reading pages keep working because they don't use Athars.
- The link depends on `book_id` and `start_page_id` keeping their meaning. The service has to check that both are present, and that the link it builds is an `https://shamela.ws` link, before showing it. A result without them is cited without a link, as on the surah page.
- The books are in Arabic, so the answer in Korean or English, and its wording, is this project's responsibility. That includes the check for Islamic terms and the bias checks planned in the proposal.
