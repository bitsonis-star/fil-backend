# FiL — Full in Life · Backend

## What is this?
The server for the FiL app. Node.js + tRPC + MySQL.
Hosted on Railway. Auto-deploys when you push to GitHub.

---

## First time? Do this in order.

### 1. Create accounts (do this first, takes ~45 min)

| Service | What for | Link |
|---|---|---|
| Railway | Hosts the backend | railway.app |
| Stripe | Payments £9.99/mo | dashboard.stripe.com/register |
| Agora | Voice & video calls | console.agora.io |
| SendGrid | Emails | signup.sendgrid.com |
| AWS | Photo storage | aws.amazon.com |
| Anthropic | AI matching | console.anthropic.com |
| Google Cloud | Athens events | console.cloud.google.com |

Also buy a domain: namecheap.com (e.g. fil.social)

---

### 2. Fill in your credentials

```bash
cp .env.example .env
# Open .env and fill in every PASTE_HERE value
```

All the values and where to find them are explained inside `.env.example`.

---

### 3. Run the launch script

```bash
bash LAUNCH.sh
```

It checks your tools, installs dependencies, builds, runs database migrations, and pushes to GitHub. Railway auto-deploys from there.

---

### 4. Add custom domain in Railway

Railway → your service → Settings → Domains → Add Custom Domain

Then update `APP_URL` in Railway Variables to match.

---

### 5. Set up Stripe webhook

Stripe Dashboard → Developers → Webhooks → Add endpoint  
URL: `https://api.fil.social/webhook/stripe`  
Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`  
Copy the Signing secret → paste as `STRIPE_WEBHOOK_SECRET` in Railway Variables.

---

### 6. Build the mobile app

```bash
cd ../fil-expo
bash LAUNCH_MOBILE.sh
```

---

## Making changes (once live)

Every change follows the same pattern:

```bash
# 1. Make your change (with Claude's help if needed)
# 2. Test locally:
npm run dev

# 3. Push — Railway deploys automatically:
git add .
git commit -m "describe what you changed"
git push
```

Railway redeploys in ~2 minutes. Check the Deployments tab.

---

## Useful commands

```bash
npm run dev          # Run locally
npm run build        # Build for production
npm run db:push      # Run database migrations
npm run check        # TypeScript type check
npm test             # Run tests
```

---

## File structure

```
fil-backend/
├── server/
│   ├── _core/         Main server entry + tRPC setup
│   ├── routers.ts     All tRPC routes registered
│   ├── db.ts          Database queries
│   ├── calls.ts       Voice/video call signalling
│   ├── events.ts      Athens events engine
│   ├── experience.ts  Survey & experience matching
│   ├── email-service.ts  SendGrid emails
│   └── athens-scraper.ts  Daily/weekly data refresh
├── drizzle/
│   ├── schema.ts      Database table definitions
│   └── 0001–0010*.sql Migration files
├── client/            Web frontend (React)
├── .env.example       All required env vars explained
├── railway.toml       Railway deployment config
├── eas.json           Expo build config
└── LAUNCH.sh          One-shot deploy script
```

---

## Need help?

Paste your error message to Claude at claude.ai and say which step you're on.
