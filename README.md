# bci-web-portal

Internal-facing web portal used by office/registrar staff, accountants,
the principal, and the director to manage day-to-day school operations:
admissions review, student records, staff & duty assignment, timetable,
attendance oversight, fee/finance management, payroll, expenses, the
guardian wallet withdrawal flow, stationery order fulfillment, and
announcements — plus the director's real-time cash-flow dashboard.

Not for guardians/students/teachers day-to-day — that's `bci-mobile-app`.

## Stack
Vite + React + TypeScript, TanStack Query for data fetching, talks to
`bci-backend-api` over REST.

## Getting started
```bash
cp .env.example .env
npm install
npm run dev
```

## Module layout (`src/modules/`)
`admissions`, `students`, `staff`, `academics`, `attendance`, `finance`,
`payroll`, `expenses`, `wallet`, `stationery`, `announcements`,
`director-dashboard` — mirrors the backend's module split and the
roadmap phases in the `bci-docs` repo.
