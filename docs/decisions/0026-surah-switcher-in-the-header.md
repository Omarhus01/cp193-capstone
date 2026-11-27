# 0026. Switching surah from the surah page header

- Status: Accepted
- Date: 2026-11-26
- Issue: #6

## Context

Since the whole Quran was imported ([0025](0025-every-verse-shows-grouped-by-mushaf-page.md)), every surah can be opened, but the surah page had no way to reach another one. In user testing, readers got stuck: to move from one surah to the next they had to go back to the home page and find it in a list of 114. The surah page needs a way to jump to any surah, by number or by name, and to the surahs before and after. It has to work on phones and on desktop, and from the keyboard.

## Decision

- **An "All surahs" button in the surah header** ("수라 목록" in Korean), beside the Arabic name. It opens a panel with a search box and the list of surahs. Each one shows its number, its name in the page's language (else English) and its Arabic name, and the page's own surah is marked.
  - **The search finds a surah by number or by Arabic, English or Korean name**, whatever the page's language. Digits find the surahs whose number starts with them, the exact number first. Names are compared without case, accents, Arabic vowel marks, hyphens, apostrophes or spaces, with every form of alif as a plain alif and doubled Latin letters as one, so "imran" finds "Aal-i-Imraan" and "بقرة" finds "البقرة". This logic is pure, in `lib/services/surah-search.ts`, with unit tests.
  - **The panel opens inside the header's width**, so it never goes past the edge of a phone screen. It closes with Escape (focus goes back to the button), a press outside, or opening a surah.
  - **Keyboard:** Enter or Space opens it with focus in the search box, Down arrow moves to the results, Up and Down move through them, and Enter opens one.
  - The list is in the page only while the panel is open, so a closed page doesn't carry 114 hidden links.
- **Previous and next links** at the bottom of the header, and again after the last section, for a reader who has finished a surah. The first surah has no previous link and the last no next one.
- **Both use the surahs in the database**, from the same cached list as the home page. The next surah is the next one in that list, not the number plus one, so a link never leads to a surah the site doesn't have.

## Alternatives

- **A native drop-down (`<select>`) of the 114 surahs:** simple and familiar on phones, but it can't search by name: typing jumps by the first letters of the option text only. Opening a page when its value changes also misbehaves from the keyboard: in some browsers the arrow keys change the value, and so the page, at every key press.
- **A separate surah index page with search:** one more page to reach and come back from. The home page already lists every surah; what readers lacked was a way to switch without leaving the surah page.
- **Search in the top bar:** the top bar's search box is kept for searching verses and asking questions (sprint 2), which is a different thing from picking a surah.
- **Number plus or minus one for previous and next:** with a database that doesn't hold every surah (as in the end-to-end test data), those links would lead to missing pages.

## Consequences

- The surah page now also reads the list of surahs, through the same cached call as the home page, so it costs a database query only when that cache entry has expired.
- The approved page designs (`docs/design/`) don't show the button or the links; they weren't redrawn.
- The home page list stays as it is. A search box there could reuse `filterSurahs` later.
