# HouseConnect Pulse — Smart Feedback & Growth Engine

A full-stack customer intelligence platform for residential estate ISPs.

## Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Charts:** Recharts

## Setup

### 1. Supabase Project
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:
   - `supabase/migrations/20260223134643_*.sql`
   This creates all tables, RLS policies, indexes, and seeds all 35+ questions.

### 2. Create Admin User
1. In Supabase → **Authentication** → **Users** → **Invite User** → enter your admin email
2. In **SQL Editor**, run:
```sql
INSERT INTO public.admin_users (id, email, full_name, role)
VALUES (
  '<your-auth-user-uuid>',
  'your@email.com',
  'Your Name',
  'super_admin'
);
```

### 3. Environment Variables
Create a `.env` file (or set in Lovable/Vercel settings):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

> ⚠️ **In Lovable:** Go to Project Settings → Environment Variables and add both values.

### 4. Deploy
- **Lovable:** Connect your GitHub repo and it will auto-deploy
- **Vercel/Netlify:** Connect repo, set env vars, deploy

## Routes
| Route | Description |
|-------|-------------|
| `/` | Public customer feedback form |
| `/admin/login` | Admin login |
| `/admin` | Dashboard with KPI cards + live feed |
| `/admin/analytics` | 7 analytics charts |
| `/admin/responses` | Response viewer + CSV export |
| `/admin/forms` | Dynamic form builder |
| `/admin/settings` | Estate & user management |

## Form Paths
| Path | Trigger |
|------|---------|
| PATH_A | Improve Speed / Streaming |
| PATH_B | Suggest Better Plans |
| PATH_C | Report Signal Issue |
| PATH_D | Report Urgent Problem (sets priority_flag) |
| PATH_E | Refer Friends & Earn Rewards |
| PATH_F | New Resident Profile (from legacy Google Forms survey) |
| UNIVERSAL | Always shown (name, WhatsApp, sentiment, churn signal) |

## Intelligence Flags (auto-set on submission)
- `priority_flag` — PATH_D or frequent network issues
- `churn_risk_flag` — "Not bothered" if service stops
- `high_referrer_flag` — Can refer 5+ friends
- `upsell_candidate` — High spend + upgrade interest

## Customer Tiers (auto-computed)
- `high_value` — WTP ≥ ₦10k AND usage ≥ 25GB
- `budget` — WTP < ₦5k
- `standard` — Everyone else
