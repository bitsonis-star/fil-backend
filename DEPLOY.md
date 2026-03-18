# FiL · Deployment Guide

## Recommended: Railway (easiest, ~10 min)

Railway gives you a Node server + MySQL database in one place, with free SSL and auto-deploys from GitHub.

---

### 1. Push code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create fil-app --private --push
```

### 2. Create Railway project
1. Go to https://railway.app → New Project
2. **Deploy from GitHub repo** → select your repo
3. Railway auto-detects Node.js and sets `npm run build && npm start`

### 3. Add MySQL database
1. In your Railway project → **+ New** → **Database** → **MySQL**
2. Copy the `DATABASE_URL` from the MySQL service → Variables tab

### 4. Set environment variables
In Railway → your service → **Variables**, add everything from `.env.example`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | From Railway MySQL service |
| `APP_URL` | Your Railway domain (e.g. `https://fil-app.up.railway.app`) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Step 5 below |
| `SENDGRID_API_KEY` | SendGrid Dashboard → Settings → API Keys |
| `FROM_EMAIL` | Your verified SendGrid sender |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `AWS_ACCESS_KEY_ID` etc. | AWS IAM console (for photo uploads) |

### 5. Set up Stripe webhook
1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://your-railway-domain.com/webhook/stripe`
3. Events to select:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** → paste as `STRIPE_WEBHOOK_SECRET` in Railway

### 6. Run database migrations
In Railway → your service → **Shell**:
```bash
npx drizzle-kit migrate
```
Or add it to your build command:
```
npm run build && npx drizzle-kit migrate
```

### 7. Set up SendGrid sender
1. SendGrid → Settings → Sender Authentication → **Verify a Single Sender**
2. Use the same email you set as `FROM_EMAIL`

### 8. Deploy
Railway auto-deploys on every git push. Check **Deployments** tab for logs.

---

## Alternative: Render

1. New Web Service → connect GitHub repo
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Add a **PostgreSQL** database (note: schema uses MySQL — switch to `postgres` driver if using Render)
5. Set env vars in Render dashboard

---

## DNS / Custom Domain
1. Railway → Settings → Domains → **Add Custom Domain**
2. Add a CNAME record at your DNS provider pointing to the Railway domain
3. Update `APP_URL` env var to your custom domain
4. Update Stripe webhook URL to match

---

## Collecting first users
- Share the Railway URL directly — no app store needed
- Add a "Join waitlist" button on the home page if you want to collect emails before launch
- Consider a soft launch with 10–20 beta users before opening signups

---

## Cost estimate (Railway)
| Service | Cost |
|---|---|
| Hobby plan (Node server) | ~$5/mo |
| MySQL | ~$5/mo |
| **Total** | **~$10/mo** |

Free tier available for testing (sleeps after inactivity).
