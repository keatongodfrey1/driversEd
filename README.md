# Utah Drivers Ed Practice

An interactive, self-scoring practice site for the **Utah written knowledge test**
(learner permit / drivers ed). Built as a plain static site — no backend, no build
step — so it runs by opening a file or from a hosted URL, and works on a phone.

- **258 practice questions** drawn from the **2025–2026 Utah Driver Handbook**, across
  14 topics (licensing, rules of the road, signs, alcohol & drugs, sharing the road, …).
- Mix of **multiple-choice**, **true/false**, and **traffic-sign identification** (with
  real SVG sign graphics).
- **Full practice test** = 50 random questions, **pass at 80%** (mirrors the real exam),
  plus a **practice-by-topic** mode.
- **Instant feedback** with an explanation and handbook reference on every question,
  a **missed-questions review**, and a one-click **"practice the ones I missed"**.
- Remembers your best full-test score in the browser (`localStorage`).

## Use it

**Hosted (recommended):** open the GitHub Pages URL on any phone or laptop and bookmark it:

> `https://keatongodfrey1.github.io/driversed/`

(See "Enabling GitHub Pages" below if the link isn't live yet.)

**Locally:** the page loads `questions.json` with `fetch`, so it needs a web server —
opening `index.html` directly via `file://` won't load the questions. Run:

```bash
cd driversEd
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Enabling GitHub Pages (one time)

In the GitHub repo: **Settings → Pages → Build and deployment → Source: "Deploy from a
branch"**, choose the branch `claude/drivers-ed-practice-tests-8PiWx` (or `main` after
merging) and folder `/ (root)`, then **Save**. The site appears at the URL above within
a minute or two.

## Project layout

| File / folder      | Purpose |
|--------------------|---------|
| `index.html`       | Page shell (home / quiz / results screens) |
| `styles.css`       | Mobile-first styling, color + ✓/✗ feedback |
| `engine.js`        | Pure quiz logic (shuffle, build, grade) — no DOM |
| `app.js`           | Browser UI controller |
| `questions.json`   | The question bank |
| `signs/`           | SVG traffic-sign graphics for `sign` questions |
| `validate.js`      | Schema/coverage validator for the question bank |
| `engine.test.js`   | Node unit tests for the quiz logic |
| `dom.test.js`      | Headless DOM smoke test (requires `jsdom`) |

## Adding or editing questions

Edit `questions.json`. Each question looks like:

```json
{
  "id": 259,
  "topic": "Rules of the Road",
  "type": "mc",                 // "mc" | "tf" | "sign"
  "question": "…",
  "choices": ["…", "…", "…", "…"],
  "answer": 2,                   // index of the correct choice
  "explanation": "…",
  "source": "Sec 9H",
  "anchorLast": true,           // optional: pin "All of the above" as the last choice
  "image": "signs/yield.svg"    // required only for type "sign"
}
```

Rules: `id` must be unique, `topic` must be one of the `topics` listed at the top of
the file, true/false items use `["True","False"]`, and the answer is tracked by value
so shuffling never breaks the key.

## Verifying changes

```bash
node validate.js      # validates questions.json (schema, unique ids, sign images, coverage)
node engine.test.js   # unit-tests shuffle / build / grade logic
node dom.test.js      # drives the full UI in jsdom (npm install jsdom --no-save first)
```

---

*Unofficial study aid. Always confirm current rules on the official
[Utah DLD learner permit page](https://dld.utah.gov/learner-permit/).*
