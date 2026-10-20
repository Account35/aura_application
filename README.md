# Aur.a — AI Career Assistant

Aur.a is a full-stack AI-powered career platform that helps job seekers write tailored cover letters, build ATS-optimised CVs, practise with a live AI mock interviewer, and develop professional skills through a curated video Learning Hub — all in one place.

Live app: **[aura-application.netlify.app](https://aura-application.netlify.app)**

---

## Features

- **AI Cover Letter Generator** — Paste a job description and your CV to generate a tailored, professional cover letter in seconds, with background generation so you can keep browsing while it runs.
- **ATS Compatibility Scoring** — Receive a 0–100 score showing how well your CV matches the job description, with detailed reasons on eligible plans.
- **AI Refinement Chat** — Iterate on a generated cover letter through a multi-turn AI chat without leaving the page.
- **CV Builder** — A structured form that saves your profile and exports a single-column, ATS-readable CV as a formatted PDF or Word (.docx) file.
- **AI Mock Interviews** — Start a live video interview with an AI interviewer (powered by Tavus), optionally tied to a saved application, and receive a personalised feedback report on completion.
- **Learning Hub** — Curated YouTube video playlists across five career categories (Interview Prep, CV Writing, Job Strategies, Salary Negotiation, Professional Communication) with per-category progress tracking.
- **Application History** — Browse, review, and manage all previously generated cover letters with status tracking and follow-up reminders.
- **Tiered Subscription Plans** — Free trial, Pro, and Career Accelerator plans with Paystack payment integration (inline popup and server-side fallback).
- **Dark / Light Mode** — System-aware theme switching via `next-themes`.
- **Fully Type-Safe** — End-to-end TypeScript across the frontend and Supabase Edge Functions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend framework** | React 18, TypeScript 5, Vite (rolldown-vite) |
| **Routing** | React Router v7 |
| **Styling** | Tailwind CSS v3, tailwindcss-animate, Radix UI primitives, shadcn/ui components |
| **Animations** | Motion (Framer Motion successor) |
| **Forms** | React Hook Form + Zod validation |
| **Backend / Database** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **AI / LLM** | Supabase Edge Functions calling external LLM APIs (streaming via `eventsource-parser`) |
| **Video interviews** | Tavus conversational video API |
| **Payments** | Paystack (inline popup + server-side initialisation) |
| **PDF export** | jsPDF |
| **Word export** | docx |
| **Charts** | Recharts |
| **Linting / formatting** | Biome |
| **Deployment** | Netlify (continuous deployment) |

---

## Prerequisites

Make sure the following are installed before you begin:

- **Node.js** ≥ v20.18.3
- **pnpm** ≥ v9 (recommended) or npm ≥ v10

Verify your versions:

```bash
node -v
pnpm -v
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Account35/aura_application.git
cd aura_application
```

### 2. Install dependencies

```bash
pnpm install
```

Or with npm:

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find both values in your Supabase project under **Settings → API**.

> The app will not connect to the database or authenticate users without these two variables.

### 4. Run the development server

```bash
pnpm dev
# or
npm run dev -- --host 127.0.0.1
```

Open your browser at `http://localhost:5173`.

### 5. Build for production

```bash
pnpm build
# or
npm run build
```

The optimised output is written to `dist/`.

### 6. Preview the production build locally

```bash
pnpm preview
```

---

## Project Structure

```text
aura_application/
├── public/                     # Static assets served as-is
│   ├── images/                 # Logos, error illustrations, shapes
│   └── _redirects              # Netlify SPA redirect rule
├── src/
│   ├── components/
│   │   ├── common/             # Shared utility components (RouteGuard, NotificationBell, etc.)
│   │   ├── layouts/            # App shell and sidebar layout
│   │   └── ui/                 # shadcn/ui primitive components
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Supabase auth state and helpers
│   │   ├── ChatContext.tsx     # Global AI refinement chat state
│   │   └── GenerationContext.tsx # Background cover letter generation state
│   ├── db/
│   │   ├── api.ts              # All Supabase database and Edge Function calls
│   │   └── supabase.ts         # Supabase client initialisation
│   ├── hooks/                  # Reusable React hooks (debounce, mobile detection, etc.)
│   ├── lib/
│   │   ├── coverLetterUtils.ts # Cover letter markdown stripping and Word export helpers
│   │   ├── pdfUtils.ts         # ATS PDF and Word CV export (jsPDF + docx)
│   │   ├── planUtils.ts        # Plan access guards and feature flags
│   │   └── utils.ts            # General utility functions
│   ├── pages/
│   │   ├── LandingPage.tsx     # Public marketing page
│   │   ├── LoginPage.tsx       # Authentication
│   │   ├── SignUpPage.tsx      # Registration
│   │   ├── DashboardPage.tsx   # User dashboard and quick actions
│   │   ├── GeneratePage.tsx    # Cover letter generation and ATS scoring
│   │   ├── CVBuilderPage.tsx   # Structured CV builder with PDF/Word export
│   │   ├── MockInterviewPage.tsx # AI video mock interview
│   │   ├── HistoryPage.tsx     # Cover letter history list
│   │   ├── HistoryDetailPage.tsx # Single cover letter detail and chat
│   │   ├── LearningHubPage.tsx # Curated video learning content
│   │   ├── PlansPage.tsx       # Subscription plan selection and Paystack checkout
│   │   └── SettingsPage.tsx    # Account and subscription management
│   ├── types/
│   │   └── types.ts            # All shared TypeScript interfaces and types
│   ├── App.tsx                 # Root component with providers and router
│   ├── routes.tsx              # Centralised route configuration
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles and Tailwind base layer
├── supabase/
│   ├── functions/              # Supabase Edge Functions (AI generation, payments, etc.)
│   └── migrations/             # PostgreSQL migration files
├── .env                        # Local environment variables (not committed)
├── biome.json                  # Biome linter and formatter configuration
├── components.json             # shadcn/ui component configuration
├── tailwind.config.js          # Tailwind CSS theme and plugin configuration
├── tsconfig.json               # TypeScript project references
├── vite.config.ts              # Vite build configuration
└── package.json                # Dependencies and scripts
```

---

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | Run TypeScript check, Biome lint, Tailwind CSS check, and build smoke test |

---

## Subscription Plans

| Feature | Free (Trial) | Pro | Career Accelerator |
|---|---|---|---|
| Cover letter generations | 10 / month | Unlimited | Unlimited |
| AI refinement chat | Trial only | 3 messages / letter | Unlimited |
| ATS score | Trial only | Score only | Score + full reasons |
| CV Builder & export | Trial only | — | ✓ |
| Mock interviews | Trial only | 5 / month | Unlimited |
| Learning Hub | — | Add-on | Included |
| Trial period | 5 days | 5 days | 5 days |

Payments are processed securely via **Paystack** in ZAR.

---

## Deployment

The application is deployed on **Netlify** with continuous deployment from the production branch. Every merged push triggers a new build automatically.

The `public/_redirects` file contains the Netlify SPA redirect rule that routes all paths to `index.html`, enabling client-side routing.

To deploy your own instance:

1. Fork or clone the repository.
2. Connect the repository to a new Netlify site.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Netlify dashboard under **Site configuration → Environment variables**.
4. Set the build command to `npm run build` and the publish directory to `dist`.

---

## License

This project is open-source and available under the [MIT License](https://opensource.org/licenses/MIT).
