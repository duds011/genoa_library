# GENOA Library — where things stand

Paste the block at the bottom into a new Claude Code session to pick this up.

---

## Done and live at genoa-library.com

Everything below is merged to `main`, pushed, and deployed. `main` is level with
`origin/main`; there is no unpushed or uncommitted work.

**The portal now runs on Lesson Studio's actual components,** not an imitation of
them. They live in `components/koku/` (LessonPageTabs, DashboardBlocks,
BrandCharts, LessonCorrections, RecapSections, RecapView, VocabByLevel,
VocabLevelBreakdown, LessonPillar, CountUp) with `lib/brand.ts` and
`lib/languages.ts`. Two seams make them fit: `lib/recapShape.ts` turns this
portal's six tables into the single recap object they expect, and the practice
block is injected because this portal's exercises save answers while theirs are
read-only.

**Colour is GENOA's own** — indigo `#4f46e5` into purple `#7c3aed`, Poppins. A
blue build was shipped once and rejected. Do not reintroduce it.

**Old lessons keep their old recap.** `lib/recapEra.ts` draws one line in *time*,
not by pipeline, because lessons also arrive from Google Meet via n8n with no
`source`. `components/student/LegacyRecap.tsx` is the old four-tab page, frozen.

**The student dashboard** leads with the arc (how much of the last lesson the
student spoke, against where they started), then milestone, vocabulary growth,
recent scores. Speaking metrics live once, on Progress. Vocabulary is its own tab
holding the words by level and the grammar map.

**The teacher review page** is the four tabs the student opens, with Save and
Publish in a sticky bar. Progress opens with the voice memo and the materials,
then the numbers, the measured speaking and the corrections. It has Translate
explanations, and publishing writes a note into her Notes grid.

**The recorder works end to end and has been proven by a real lesson** — Duarte
lesson 7, `source='recorder'`, real transcript, full metrics, four corrections.

---

## The recorder

Noa's own build is at `C:\Users\854se\Desktop\genoa-recorder`, v1.2.0, with a Web
Store zip in `store/`. It is the Lesson Studio recorder with only `config.js` and
the manifest changed. **Never repoint the published koku-recorder — Akio uses it.**

It identifies the student on its own: the service worker reads the lesson tab's
title and posts it to `/api/ext/identify`, which uses `lib/matchStudent.ts` and
refuses rather than guesses. Verified against the real roster in production.

**Zero-click recording is impossible.** `chrome.tabCapture.getMediaStreamId`
requires a genuine user gesture. Do not promise it.

**The spoken language is a property of the student, not of the lesson.**
`students.spoken_language` (migration 007, default English) is what Whisper is
told the hour sounds like — a different question from `students.language`, what
they are learning. It is set on the add-student form and from the control in
the admin row of a student's page; `/api/ext/complete` reads it from the row and
ignores what the extension sends. The recorder's language dropdown is gone with
it (v1.3.0), replaced by a line saying what it will use.

---

## Open items

1. **Google Calendar** — half-configured, blocked. There is a Cloud project on
   `noanoayo46@gmail.com` with the Calendar API enabled, an OAuth client created,
   and both scopes added. It is still in **Testing**, which expires the refresh
   token every 7 days. Publishing needs the Branding home-page and privacy-policy
   fields plus `genoa-library.com` as an authorized domain, which needs Search
   Console ownership. Once `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
   `GOOGLE_REDIRECT_URI` exist, port `lib/google.ts` and
   `app/api/google/{auth,callback,disconnect,select-calendar}` from Lesson Studio.
   It stores its token in KV; this portal needs a Supabase table instead.
2. **Vercel plan** — this project is Hobby, so functions cap at 300s and the
   deploy is refused outright above it. `/api/ext/complete` is capped there and a
   long lesson may time out. The transcript is cached, so a retry is cheap and the
   recorder retries once on 502/504. Pro removes it.
3. **Rebuild from recording** — Lesson Studio has it, this portal does not. Worth
   porting, especially given the cap above.
4. **Editable vs read-only figures** — the review page keeps editable score and
   talk sliders where Lesson Studio shows read-only figures. Deliberate; the user
   was offered the swap and has not answered.
5. **Bad data** — Duarte's lesson 5 is titled "Francesco Zampardi — Lesson 5".
   Pre-existing, not introduced by this work.

---

## Traps that cost time

- Running `npm run build` while `next dev` is running wipes `.next` underneath it.
  The page then renders but never hydrates, clicks do nothing, and **no console
  error names the cause**. Restart the dev server after any production build.
- The Browser pane's screenshot is flaky on this machine and sometimes returns the
  favicon. Assert through the DOM with `javascript_tool` instead.
- To view a page as a real user, drop a temporary `app/dev-login/route.ts` that
  mints a magic link with the admin client and consumes it server-side with
  `verifyOtp`. Delete it before committing.
- Scratch scripts that read `.env.local` are ignored via `.gitignore`; one was
  committed by accident once.

---

## Paste this into the new session

> Continue work on GENOA Library at `C:\Users\854se\Desktop\teacher-portal-noa`
> (repo `duds011/genoa_library`, live at genoa-library.com, Vercel project
> `teacher-portal` under `genoa-s-projects`). Read `HANDOFF.md` in the project
> root first, and my memory files for `genoa-library-koku-redesign` and
> `genoa-recorder-extension`.
>
> State: the redesign, the recorder and the new review page are all deployed and
> `main` is clean. A real lesson has been recorded through the extension
> successfully.
>
> Do not reintroduce Lesson Studio's blue — this portal is indigo into purple on
> Poppins. Do not restyle `components/student/LegacyRecap.tsx`; lessons taught
> before the cutoff in `lib/recapEra.ts` must keep it. Never repoint the published
> koku-recorder extension, only the GENOA build at `Desktop\genoa-recorder`.
>
> Deploying is expected as part of a change: build, commit, push, `vercel --prod`.
> Verify against real data before deploying, and restart `next dev` after any
> production build or the page will silently stop hydrating.
