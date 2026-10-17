# Sunstone Coding Profiles

A dashboard of Sunstone students' coding profiles across LeetCode, GeeksforGeeks,
HackerRank, Codeforces, CodeChef and GitHub, filterable by campus, batch and course.

The student list comes from a Google Sheet (a Google Form response sheet). There is no
backend service and no database: the sheet is the only store.

## Run

```bash
npm install
cp .env.example .env.local   # then set SHEET_ID
npm run dev                  # http://localhost:3002
npm run build                # tsc -b && vite build
npm run lint
npm run format
```

Stack: React 18 + Vite + TypeScript, TanStack Router (file-based, `src/routes/`) and
TanStack Query, Tailwind v4. Same conventions as the InterviewCafe `frontend` and `upcurve`
repos.

## Pages

- `/` lists students with one number per platform and a total, ranked by problems solved.
  Campus, batch, course, name search and sort order live in the URL, so any view can be
  bookmarked or shared.
- `/profile` is the detailed view of one person (badges, topic-wise counts, activity
  calendar). Clicking a student opens it; it also works as a manual lookup by username.

## The sheet

Set `SHEET_ID` to the id in the sheet's URL. The sheet must be shared as "Anyone with the
link can view". Columns are matched by header name, in any order:

| Header contains                                                               | Used for                |
| ----------------------------------------------------------------------------- | ----------------------- |
| `Name`                                                                        | Student name (required) |
| `Campus`                                                                      | Campus filter           |
| `Course`                                                                      | Course filter           |
| `Year` / `Batch` / `Passing`                                                  | Batch filter            |
| `LeetCode`, `GeeksForGeeks`, `Hackerrank`, `Codeforces`, `CodeChef`, `GitHub` | Usernames               |
| `Email`                                                                       | De-duplication only     |

A username cell may hold a username or a profile link. `No`, `NA`, `Nil` and blanks mean no
account. Anything else (an email address, an unrelated link) is flagged as "Check entry" in
the table. A student who submits the form twice is counted once, using the later row.

The page re-reads the sheet every minute and whenever the tab regains focus, so a new or
edited row shows up without a reload.

### Privacy

The sheet also contains mobile numbers and email addresses. `api/students.ts` reads it
server-side and returns only name, campus, course, batch and usernames; the sheet id and
the contact columns never reach the browser. Keep `SHEET_ID` in environment variables, not
in code. Note that link-sharing means anyone who has the sheet link can still open the
sheet itself.

The dashboard has no login: anyone with its URL can see student names and coding stats.

## How it works without a backend

Two small stateless functions in `api/` run on the host (Vercel Edge Functions); `vite dev`
and `vite preview` mount the same handlers (see `vite.config.ts`).

- `api/students.ts` reads the sheet as described above.
- `api/relay.ts` forwards requests to the platforms that refuse browser requests (LeetCode,
  GeeksforGeeks, HackerRank, CodeChef, and GitHub's contributions page). It only accepts
  an allow-list of profile endpoints.
- Codeforces and the GitHub REST API send CORS headers, so the browser calls them directly.

Platform numbers are fetched in the visitor's browser, a few at a time per platform, and
kept in `localStorage` for a day so a reload is instant. They are treated as fresh for 30
minutes; "Refresh stats" refetches everything.

Table fetching is in `src/lib/coding-profiles/summaries.ts`; the detailed per-platform
parsing is in `src/lib/coding-profiles/adapters.ts`.

## Sharing

Every student in the sheet has a short link, `/s/{name}-{4 characters}`, and a coding card
at `/s/{slug}/card` (Download PNG, copy link, WhatsApp/LinkedIn/X), modelled on
InterviewCafe's profile card.

- `api/share.ts` serves `/s/...` on Vercel (see `vercel.json`) and rewrites the page's
  link-preview tags for that student, so WhatsApp, LinkedIn and X show their name, numbers
  and image. Only crawlers wait for the numbers; people get the page at once.
- `api/stats.ts` works the numbers out server-side through the same adapters and relay,
  cached at the edge for 6 hours (5 minutes if a platform failed to load).
- `api/og.ts` (1200×630 preview) and `api/card.ts` (1080×1350 card, navy or light) draw
  the images with `@vercel/og`. They run on the Node.js runtime because the edge runtime
  will not compile the renderer's WebAssembly; their helpers are in the import-free
  `api/_render.ts`.

## Zones and PDF reports

Students are placed in practice zones by problems solved on LeetCode, or on the next usable
platform (GeeksforGeeks, Codeforces, CodeChef, HackerRank; never GitHub): green 100+,
yellow 50–99, orange 25–49, red under 25, and "Not linked" when no username is usable. The
rules live in `src/lib/students/zones.ts`.

- **Campus report:** choose a campus on the students page and use "Download campus
  report" once every profile has loaded. With no campus chosen, "Download all-campus
  report" creates one PDF: an overall summary, a campus comparison page, then each campus's
  own summary and zone lists (largest campus first). It is a landscape PDF with a summary page and one
  section per zone.
- **Student report:** "Download PDF" on any profile.

The PDFs are drawn in the browser with `@react-pdf/renderer` (`src/reports/`), loaded only
when a report is downloaded.

## Staff login

Everything needs a login except students' own share links and coding cards (`/s/...`) and
what those pages and link previews need. `middleware.ts` enforces this on Vercel before
every request (and on the Vite dev server); `api/login.ts` checks passwords and sets a
signed, HttpOnly session cookie valid for 7 days.

Accounts live in two environment variables (Vercel → Settings → Environment Variables):

- `AUTH_USERS`: comma-separated entries, one per person, each made with
  `npm run hash-password -- <username> <password>` (the password itself is never stored).
- `AUTH_SECRET`: a long random string that signs the cookie. Changing it logs everyone out.

To add or remove someone, edit `AUTH_USERS` and redeploy. Removing an entry ends that
person's access at once, even with a live cookie.

## Deploy

Import the repo in Vercel with the Vite preset and set `SHEET_ID` (and optionally
`SHEET_GID`) in the project's environment variables. Link previews (WhatsApp, LinkedIn, Slack) need
absolute URLs, which the build fills in from Vercel's production domain; set `SITE_URL`
(e.g. `https://profiles.example.com`) if the site is served from a custom domain. The host must be able to run the
functions in `api/`: a purely static host cannot serve this app.

## Known limits

- Rate limits are per platform and per IP. CodeChef is the tightest, so its column is
  fetched one profile every three seconds and fills in last; rate-limited cells retry on
  their own and otherwise show a "Retry" button.
- CodeChef has no API. Its numbers are read from the public profile page and that parsing
  will need fixing when the markup changes. Its activity calendar is not in the public page.
- GeeksforGeeks and CodeChef publish no topic-wise counts. Codeforces and GeeksforGeeks
  have no badges. GitHub achievements have no API.
- HackerRank has no single "solved" total; the number shown is the sum across its badge
  domains.
- The detailed profile page uses the GitHub REST API (60 requests an hour per visitor IP)
  and a community endpoint for the contribution calendar.
