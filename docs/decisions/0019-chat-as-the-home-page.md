# 0019. Chat as the home page in Sprint 2

- Status: Proposed
- Date: 2026-11-05
- Issue: #43 (Sprint 1 documentation)

## Context

In Sprint 1 the home page introduces the site and has one button, "Start reading", which opens the first surah. A reader who arrives with a question ("what does this verse say about patience?") has to know which surah and verse to open first, and a reader who doesn't read Arabic usually doesn't.

Sprint 2 adds questions that readers type themselves, answered from tafsir and hadith books with their sources ([issue: questions answered from tafsir and hadith](https://github.com/Omarhus01/cp193-capstone/issues/10)). In Sprint 1 the surah page already has a box for these questions, shown but turned off and marked "coming soon".

The proposal compares five existing platforms. The one it rates best, Athars, opens straight into a chat: the reader asks, and the answer cites the books it comes from (proposal, section 2.5).

## Decision

Proposed, not yet decided: in Sprint 2 the home page becomes a chat.

- The reader types a question in English or Korean and gets an answer in the same language, with source chips like the ones on the surah page.
- Verses named in an answer link to their place on the surah page, so the chat leads into reading.
- "Start reading" stays on the home page, so a reader who wants to read in order still can.
- The surah pages don't change.

This is decided after the Sprint 1 user tests, from what testers say and what they do on the site. If it is not accepted, the chat stays inside the surah page's questions panel.

## Alternatives

- **Keep the reading home page and put the chat only in the surah page's questions panel.** It needs no new page, and questions stay tied to the verse in view. But a reader still has to find the right surah before they can ask.
- **A separate chat page, linked from the header.** It keeps the home page as it is. But the chat becomes one more place to find, when the proposal's comparison suggests readers start from a question.

## Consequences

If accepted:

- The home page depends on the question-answering service. It needs a clear message when the service is down, and "Start reading" must keep working without it.
- Each question costs a model call, so the chat probably needs a logged-in reader, as the surah pages do today. That is still to be decided, together with whether chats are saved (saved progress is a separate Sprint 2 issue).
- Chat answers are generated, while everything on the surah page is reviewed content. The chat has to make that difference visible ([decision record: stored explanations, generated chat answers](0020-stored-explanations-and-generated-chat-answers.md)).
- The home page's browser tests change with it.
