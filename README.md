# Chaitanya Tyagi — Portfolio

A personal portfolio website for **Chaitanya Tyagi**, Data Engineer.
**React (Vite)** frontend + **Express / MongoDB** backend. All content is stored in
MongoDB and editable through a built-in **admin panel at `/admin`** — no code
changes needed to update the site.

Clean, light-minimalist design · orange accent (`#ff6b35`) · Space Grotesk / Geist / JetBrains Mono.

---

## Features / sections

| Section | Status | Notes |
|---|---|---|
| Hero | ✅ | Intro + animated data-pipeline motif + key stats |
| About + Tech stack | ✅ | Bio and grouped skill chips |
| Experience | ✅ | Timeline of job cards — summary, tagged highlights, stack chips |
| Featured Projects | ✅ | Linked to GitHub repos |
| Knowledge Base | ✅ | Design-pattern chapters |
| Course | ✅ | **Working "Notify me"** — emails saved to MongoDB |
| Ask AI | ◷ | Marked **Coming soon** — flip to Live anytime from the admin panel (needs `ANTHROPIC_API_KEY`) |
| 1:1 Connect | ✅ | **Working scheduler** — real calendar, slot booking saved to MongoDB |
| Footer / Contact | ✅ | Links + résumé download |
| **Admin panel** | ✅ | `/admin` — edit every section, view subscribers & bookings |

Site-wide extras: scroll-reveal animations, hover micro-interactions, mobile
hamburger nav, fully responsive layout.

---

## Project structure

```
portfolio-react/
├── index.html                  # Vite entry (fonts + #root)
├── package.json                # Frontend deps & scripts
├── vite.config.js              # Dev server + /api proxy → :3001
├── public/
│   └── Chaitanya-Tyagi-Resume.pdf
├── src/
│   ├── main.jsx                # Routes "/" → site, "/admin" → admin panel
│   ├── App.jsx                 # Composes all sections
│   ├── index.css               # Resets, keyframes, responsive rules
│   ├── data.js                 # Design tokens (colors/fonts) ONLY
│   ├── ContentContext.jsx      # Fetches /api/content (static fallback)
│   ├── components/             # Site sections (all content-driven)
│   │   ├── Nav.jsx  Hero.jsx  About.jsx  Experience.jsx  Projects.jsx
│   │   ├── KnowledgeBase.jsx  Course.jsx  Chatbot.jsx  Scheduler.jsx
│   │   ├── Footer.jsx  Reveal.jsx
│   └── admin/
│       ├── Admin.jsx           # Login + tabbed editor shell
│       ├── sections.jsx        # Per-section content editors
│       └── ui.jsx              # Shared admin UI primitives
└── server/
    ├── index.js                # Express API (content, auth, bookings, chat)
    ├── models.js               # Mongoose models (content, subscribers, bookings)
    ├── defaultContent.js       # Seed/fallback content
    ├── .env                    # DATABASE, ADMIN_PASSWORD, JWT_SECRET, ANTHROPIC_API_KEY
    └── package.json
```

### How content works

- All copy/data lives in **MongoDB** (single `sitecontents` document + `subscribers`
  and `bookings` collections).
- On first run the server **seeds** the DB from `server/defaultContent.js`.
- The frontend renders instantly from the bundled defaults, then swaps in live
  content from `GET /api/content`.
- Edit everything at **`/admin`** (password from `ADMIN_PASSWORD` in `server/.env`).
- `cd server && npm run sync-content` force-pushes `defaultContent.js` into the DB
  (overwrites admin edits — it prints the previous document first as a backup).

### API overview

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/content` | — | Full site content |
| `POST /api/subscribe` | — | Course notify-me email |
| `GET /api/booked?month=YYYY-MM` | — | Booked slots for calendar |
| `POST /api/bookings` | — | Book a 1:1 slot |
| `POST /api/chat` | — | AI assistant (Claude) |
| `POST /api/auth/login` | — | Get admin JWT |
| `PUT /api/admin/content` | JWT | Save edited content |
| `POST /api/admin/content/reset` | JWT | Restore default content |
| `GET/DELETE /api/admin/subscribers[/:id]` | JWT | Manage subscribers |
| `GET/PATCH/DELETE /api/admin/bookings[/:id]` | JWT | Manage bookings (status: pending/confirmed/cancelled) |

---

## Getting started

### 1. Install frontend deps

```bash
cd portfolio-react
npm install
```

### 2. Install & configure the backend

```bash
cd server
npm install
```

Edit `server/.env` (see `.env.example` at the repo root):

```
DATABASE=mongodb+srv://…            # MongoDB Atlas connection string
ADMIN_PASSWORD=…                    # /admin login password
JWT_SECRET=…                        # any long random string
ANTHROPIC_API_KEY=sk-ant-…          # for the AI chatbot
PORT=3001
```

### 3. Run everything

From the project root (`portfolio-react/`):

```bash
npm start        # runs the Express server AND the Vite dev server together
```

Open <http://localhost:5173> — admin panel at <http://localhost:5173/admin>.

> The chatbot needs a valid `ANTHROPIC_API_KEY`. Everything else needs only
> the `DATABASE` connection; if the DB is unreachable the site falls back to
> the bundled default content (admin/bookings/subscribe are disabled).

---

## Build for production

```bash
npm run build    # outputs static site to dist/
npm run preview  # preview the production build locally
```

Deploy `dist/` to any static host and `server/` to a Node host (Render,
Railway, Cloud Run…), and route `/api/*` (and `/admin` → `index.html`) to it.
Because `/admin` is a client route, your static host needs an SPA fallback
rewrite (`/* → /index.html`).

### Security notes

- The Anthropic API key and MongoDB credentials live **only** in `server/.env`
  — never in `src/` or `VITE_`-prefixed vars.
- Change `ADMIN_PASSWORD` and `JWT_SECRET` before deploying. Consider rotating
  the MongoDB password if this repo is ever shared.

---

## Customizing

- **Content / copy:** everything at `/admin` (or `server/defaultContent.js` for seed defaults)
- **Colors & fonts:** the `theme` object in `src/data.js`
- **Résumé file:** replace `public/Chaitanya-Tyagi-Resume.pdf`
- **Chatbot persona:** `SYSTEM_PROMPT` in `server/index.js`

---

© 2026 Chaitanya Tyagi · Data Engineer
