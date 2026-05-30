# Language Teacher Portal

Automated lesson management for language teachers. Google Meet transcripts → n8n → OpenAI → teacher review dashboard → student progress portal.

---

## Quick Start

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → paste and run `supabase/migrations/001_initial.sql`
3. Go to **Settings → API** → copy `URL` and `anon key`

### 2. Create Teacher Account

In Supabase **Authentication → Users → Add User**. Then run:
```sql
UPDATE profiles SET role = 'teacher', full_name = 'Your Name' WHERE email = 'your@email.com';
```

### 3. Configure Environment

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Run

```bash
npm install
npm run dev

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
