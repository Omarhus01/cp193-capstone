# 0008. Islamic terms follow the Arabic word

- Status: Accepted
- Date: 2026-10-23
- Issue: #1 (the glossary follows in #8)

## Context

Existing Korean translations render الله as 하나님 (hananim), the term Korean Christians use for God, which missionaries introduced in the late nineteenth century. This gives the verse a Christian connotation and changes its context (proposal §2.1, Baker [12]). Allah is a name, while "god" is a general word for any deity. The platform exists to explain the verses correctly, so the terms it uses are a content rule, not a style choice.

The first version of this rule was "always Allah, never God". That is too broad. Arabic itself has different words, and the translation has to follow the word in the text.

## Decision

The term follows the Arabic word:

- **الله** is a name: always "Allah" in English and 알라 in Korean, never "God" or 하나님.
- **إله** means god or deity, so "god" is correct: لا إله إلا الله = "there is no god but Allah".
- **رب** means Lord: وهو رب العرش العظيم = "He is the Lord of the Mighty Throne".
- **하나님** is banned everywhere.

The Korean terms for إله and رب come from the Islamic terms glossary once the owner's reviewers approve it (#8). Until then, no Korean rendering of them is added.

`findBannedTerms` in `apps/web/src/lib/services/terminology.ts` enforces what can be checked mechanically: it flags 하나님, and capitalized "God" used as a name. Lowercase "god" passes. A unit test runs it over both message files, and #8 extends it to all published content.

## Alternatives

- **"Never write God" in any form (the earlier rule):** it would ban the correct translation of إله and make the shahada untranslatable.
- **Leave terms to each translator:** this is how 하나님 ended up in the existing translations.
- **Transliterate every term (ilah, rabb):** learners who don't read Arabic would need a glossary for every sentence. Translating by the Arabic word keeps the meaning and stays readable.

## Consequences

- Translators and reviewers check which Arabic word a term translates, not only how it reads in English or Korean.
- The check can't tell whether a lowercase "god" really translates إله. Reviewers catch that during Arabic review (#7).
- A sentence that starts with "God" is flagged even when it means a deity. Rephrase it, for example "A god …".
