# ApexSDR Local Setup & Development Guide

Follow this guide to get ApexSDR running locally on your workstation in under 2 minutes.

---

## 1. Zero-Cost Quickstart (`DEMO_MODE=true`)

By default, the platform boots with `DEMO_MODE=true` configured in `.env.local`.

```bash
# 1. Enter repository
cd ai-sdr

# 2. Install dependencies
npm install

# 3. Launch local Next.js dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### What works in Demo Mode?
- **AI Reasoning**: Full simulation of Groq Llama-3.3-70B response generation for research, scoring, personalization, intent classification, and sales brief creation.
- **Pre-loaded Indian B2B Ecosystem**: 50+ realistic Indian companies and 100+ leads across Bangalore, Mumbai, Pune, NCR, Hyderabad, Chennai, and Ahmedabad.
- **Interactive Multi-Channel Dispatch**: Simulated Email and WhatsApp queues with human approval gates.
- **Inbound Conversation Lab**: Interactive prospect reply simulator testing buying intent, objection handling, and automatic AE handoff.
- **Verified Meetings**: Calendar slot generator and Google Meet links.

---

## 2. Production Mode (`DEMO_MODE=false`)

When you are ready to connect live external APIs:

1. Open `.env.local` or duplicate `.env.example`:
   ```env
   DEMO_MODE=false

   # Groq API
   GROQ_API_KEY=gsk_your_actual_groq_key

   # Resend Outbound Email
   RESEND_API_KEY=re_your_resend_key
   EMAIL_FROM="Arjun Mehta <arjun@sales.apexindus.in>"

   # Meta WhatsApp Cloud API
   WHATSAPP_ACCESS_TOKEN=your_meta_access_token
   WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id

   # Supabase Database & Auth
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. Run Database Migrations:
   Execute `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor.
   Optionally load seed records via `supabase/seed.sql`.

3. Re-launch:
   ```bash
   npm run dev
   ```

---

## 3. Running Background Automations with n8n

```bash
cd docker
docker compose up -d
```
Access the n8n editor at `http://localhost:5678` with credentials:
- Username: `admin`
- Password: `ApexEnterprise2026!`
