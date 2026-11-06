# User flow

How a reader moves through the site in Sprint 1. Every page exists in English (`/en/…`) and Korean (`/ko/…`). Opening the site without a language goes to English.

```mermaid
flowchart TD
    Start([Reader opens the site]) --> Home["Home page<br/>'Start reading' button"]
    Home -->|Start reading| Check{Logged in?}

    Check -->|No| Login["Log in page<br/>remembers the page they wanted"]
    Check -->|Yes| Surah

    Login -->|No account yet:<br/>'Sign up' in the header| Signup["Sign up page<br/>email and password"]
    Home -->|'Sign up' in the header| Signup
    Signup --> CheckEmail["'Check your email' message"]
    CheckEmail --> Email["Reader opens the confirmation link<br/>in the email"]
    Email --> Confirm{Link valid?}
    Confirm -->|Yes: logged in| Surah
    Confirm -->|No: expired or already used| LoginRetry["Log in page<br/>'try logging in' message"]
    LoginRetry --> Login

    Login -->|Correct email and password| Surah

    subgraph SurahPage ["Surah page (Al-Fatiha)"]
        Surah["Surah header and introduction"] --> Controls["Reading switches<br/>English (Korean pages), pronunciation"]
        Surah --> Sections["Reading sections, in order<br/>sidebar on wide screens, menu on phones"]
        Sections --> Section["One section: Arabic verses,<br/>then its explanation<br/>or 'explanation coming soon'"]
        Section -->|Tap an underlined word| Popover["Word popup<br/>meaning in this verse, use elsewhere, sources"]
        Section --> Chip
        Popover --> Chip["Source chip<br/>full citation on hover"]
        Chip -->|Passage has a link| Shamela(["Book page opens on Shamela<br/>in a new tab"])
        Chip -->|No link| Cited["Citation shown, no link"]
        Section --> QA["Questions panel<br/>fixed questions of the section in view"]
        QA -->|Choose a question| Answer["Prepared answer<br/>with its source chips"]
        Answer --> Chip
        QA -.-> Ask["'Ask your own question'<br/>disabled, coming soon"]
        Surah --> Feedback{Feedback form set up?}
        Feedback -->|Yes| Form(["Feedback form opens in a new tab"])
        Feedback -->|No| Soon["'Feedback form coming soon'"]
    end

    Lang["Language switch in the header<br/>English / 한국어"] -.->|Same page,<br/>other language| Home
    Lang -.-> Login
    Lang -.-> Surah
```

## The steps in words

1. **Home page.** The reader lands on the home page, which introduces the site and has a "Start reading" button that goes to the first surah. A reader who isn't logged in also sees a note that reading needs an account.
2. **Log in first.** The surah pages are for logged-in readers only. A reader who isn't logged in is sent to the log in page, which remembers where they were going and sends them back there afterwards.
3. **Sign up and confirm the email.** A new reader uses the "Sign up" link in the header, on any page, and signs up with an email and a password. Like the log in page, sign up remembers the page they came from. The site then asks them to check their email. The link in that email confirms the address, logs them in and takes them to the page they wanted. If the link has expired or was already used, they land on the log in page with a message that their address may already be confirmed and they can try logging in.
4. **Surah page.** The page opens with the surah's name and a short introduction. Switches show or hide the English text (on Korean pages; English pages always show it) and the pronunciation. The reader's choices are remembered in the browser.
5. **Reading sections.** The surah is split into sections read in order. The sidebar (a menu on phones) lists them and highlights the one on screen. Each section shows its Arabic verses and then its explanation. A section whose explanation is still in review says "explanation coming soon".
6. **Word popup.** Words with a meaning are underlined. Tapping or clicking one opens a small popup with what the word means in this verse, how it is used elsewhere, and the sources.
7. **Source chips.** Every point of an explanation, every word meaning and every answer ends with small "Source" chips. Hovering one shows the full citation: the book, the volume and the pages. Clicking it opens that page of the book on Shamela, an online library of Islamic books, in a new tab. A passage without a link is cited without one.
8. **Fixed questions.** The questions panel lists the prepared questions for the section on screen (on phones they appear under each section). Choosing a question opens its answer and the sources behind it. These answers are written and reviewed like the explanations. The box for asking your own question is shown, but turned off and marked "coming soon", until the AI service arrives in Sprint 2.
9. **Language switch.** The header on every page has an English / 한국어 switch. It opens the same page in the other language, so a reader can compare the two.
10. **Feedback form.** During user testing, the surah page has a button that opens the feedback form in a new tab (at the end of the page on phones). If no form has been set up for the site, the button says the form is coming soon.
