# Tangents

A personal listening library. It interviews you for your interests, then goes
and does real research and writes narrative briefings you can **listen to** in
the browser. New episodes arrive automatically on a schedule, deliberately
mixing topics near what you love (about 70%) with the occasional wild card
(about 30%) so you keep encountering things you would not have gone looking for.

Built as a plain static site: no framework, no build step, no server.

## How it works

- **`profile.md`** is the seed: your interests, format preferences, and a topic
  queue. Edit it any time your curiosity shifts.
- **`episodes.js`** is the content library. Each episode is one
  `window.EPISODES.push({ ... })` block (title, summary, sources, and a markdown
  `body`). New episodes are added by appending another block.
- **`index.html` + `app.js` + `styles.css`** are the reading/listening app. Open
  an episode and hit play. The player uses your browser's built-in
  text-to-speech, with adjustable voice and speed, sentence highlighting, and
  scrub controls. Works on phone and desktop.
- **The research Routine** (a scheduled Claude Code trigger) wakes on a cadence,
  reads `profile.md`, picks the next topic while keeping the 70/30 balance,
  researches it on the web, writes a new episode into `episodes.js`, moves the
  topic to Done, and commits.

## Reading / listening

Open `index.html`. On the live site you can browse the library, filter by
"in your wheelhouse" vs "wild cards," open an episode, and press play.

Text-to-speech runs entirely in the browser (the Web Speech API), so it needs no
API keys and costs nothing. Chrome and Safari have the best voices.

### Optional upgrade: real audio (podcast-style MP3s)
The browser voices are fine but robotic. If you want natural, downloadable audio,
we can wire up a TTS API (for example OpenAI or ElevenLabs) so each episode also
ships an `.mp3`. That needs an API key and is a clean follow-up; the site is
built to add an `audioUrl` per episode without other changes.

## Publishing (one-time)

The site is static, so GitHub Pages hosts it for free:

1. Push to the default branch.
2. Repo **Settings -> Pages -> Source: Deploy from a branch -> `main` / root**.
3. Give it a minute; it will be live at `https://<user>.github.io/<repo>/`.

Then open that URL on your phone and add it to your home screen.

## Adding an episode by hand

Append a block to `episodes.js`:

```js
window.EPISODES.push({
  id: "0002-some-slug",
  title: "Title",
  subtitle: "One-line hook",
  date: "2026-08-01",
  category: "close",            // "close" or "wild"
  topics: ["cycling"],
  readingTimeMin: 11,
  summary: "Card blurb.",
  sources: [{ title: "Source name", url: "https://..." }],
  body: `Markdown. Use ## for section headings.`
});
```
