# Production Deployment Guide

ApexSDR is designed for deployment on modern cloud platforms (Vercel, AWS, GCP, Cloudflare) without refactoring core business logic.

---

## 1. Vercel Deployment

1. Push your repository to GitHub or GitLab:
   ```bash
   git init
   git add .
   git commit -m "feat: complete ApexSDR enterprise platform"
   ```
2. Import project into Vercel Dashboard.
3. Configure Environment Variables:
   - `DEMO_MODE`: `false` (or `true` for a public showcase instance)
   - `GROQ_API_KEY`: Groq Cloud API key
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret
   - `RESEND_API_KEY`: Resend API key
   - `WHATSAPP_ACCESS_TOKEN`: Meta Cloud API token
   - `WHATSAPP_PHONE_NUMBER_ID`: Meta phone number ID
4. Deploy! Next.js 14 App Router static and dynamic routes deploy seamlessly.

---

## 2. Docker & Infrastructure Deployment

For containerized hosting (AWS ECS, GCP Cloud Run, or on-premise VPS):
- Use the included `docker/docker-compose.yml` for self-hosted n8n and background workers.
- Set up Supabase via Supabase Cloud or self-hosted PostgreSQL 15+ with `pgvector` enabled.
