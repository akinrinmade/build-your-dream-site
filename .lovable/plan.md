

# HouseConnect Pulse — Implementation Plan
*Intelligent Feedback & Growth Engine for a Nigerian Estate ISP*

## What We're Building
A customer intelligence platform for HouseConnect (a Nigerian residential ISP) that captures feedback through smart, branching surveys, flags churn risks and upsell opportunities, and gives admins a real-time dashboard to act on customer signals.

---

## Phase 1: Database & Foundation
Set up the Supabase backend — all 8 tables (estates, forms, questions, question_options, logic_rules, responses, answers, admin_users, audit_log) with RLS policies, indexes, and seed data including the full 35+ question set across all 6 paths (Speed, Plans, Signal, Urgent, Referral, Onboarding).

## Phase 2: Customer-Facing Smart Survey
Build the mobile-first survey form engine with:
- **Landing screen** with HouseConnect branding (deep navy #0A1628 + electric blue #0066FF)
- **Entry gate question** — 6 paths rendered as full-screen cards with emoji icons
- **Step-by-step wizard** — one question per screen with smooth transitions
- **Dynamic branching** — logic rules evaluated in real-time to show/hide questions
- **8 question type components**: single choice, multiple choice, text, textarea, rating scale, number, phone (Nigerian validation), dropdown
- **Progress bar**, back button, and validation before advancing
- **Path-aware success screens** with personalized messages per path
- **Silent metadata capture**: device type, session ID, UTM params
- **Honeypot spam prevention**

## Phase 3: Submission Edge Function
Build the `process-submission` Supabase Edge Function that handles:
- Honeypot validation (silent discard)
- Duplicate detection (same WhatsApp within 24 hours)
- Response + batch answer insertion
- Flag evaluation from logic rules (priority, churn risk, high referrer, upsell)
- Customer tier computation (high_value / standard / budget)
- IP + user agent parsing

## Phase 4: Admin Auth & Dashboard Overview
- **Login page** with Supabase email/password auth
- **Route guard** on all `/admin/*` routes with role-based access (super_admin, editor, viewer)
- **Overview dashboard** with 8 KPI cards (total submissions, urgent issues, churn risk, referrers, avg speed rating, weekly trend, upsell candidates, tier breakdown)
- **Live activity feed** showing last 10 submissions via Supabase Realtime, color-coded by flag type

## Phase 5: Response Viewer
- **Sortable, paginated table** with all submission data
- **Filter panel**: date range, path, flags, tier, estate, source, reviewed status
- **Search**: by name, WhatsApp number, or keyword in open-text answers
- **Response detail modal**: full Q&A pairs, flag badges, metadata, admin notes, mark as reviewed
- **Bulk actions**: export CSV, mark reviewed, delete (super_admin only)
- **CSV export** with all active filters applied

## Phase 6: Analytics Dashboard
14 chart components built with Recharts, all filterable by date range and estate:
- Submissions over time, intent distribution (donut), churn signal tracker, device breakdown, signal strength, payment preferences, speed ratings, referral potential, top reported issues, willingness to pay, usage heatmap, device count, tier breakdown over time, pre-launch vs post-launch comparison

## Phase 7: Dynamic Form Builder
- **Form list** with create, duplicate, activate/deactivate
- **Question manager** with drag-and-drop reordering
- **Option manager** per question with emoji + value fields
- **Visual logic rule builder** (sentence-style: "Show [question] when [question] answer [operator] [value]")
- **Live form preview** mode

## Phase 8: Settings & Admin Management
- **Admin user management**: invite by email, set roles, assign estates
- **Estate management**: add/edit estates, assign forms
- **Google Forms CSV import**: column mapping UI, preview, bulk import with legacy flags
- **Notification config** (Phase 2 placeholder fields for WhatsApp/email alerts)

---

## Design Direction
- **Colors**: Deep navy `#0A1628`, electric blue `#0066FF`, soft cyan glow `#00C2FF`, white
- **Feel**: Nigerian fintech meets professional ISP — mobile-first, trust-building
- **Mobile-first**: Fully functional at 375px, one-question-per-screen wizard
- **Accessible**: ARIA labels, keyboard navigation, WCAG AA contrast

## Tech Stack
- React + Vite + TypeScript + Tailwind CSS
- Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- Recharts for analytics charts
- React Hook Form + Zod for validation
- @dnd-kit for drag-and-drop in form builder

