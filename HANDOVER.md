# JJ Bullion Trade — Customer Handover Document

**Project:** JJ Bullion Trade Ledger App
**Handover Date:** 30 June 2026
**Handed over to:** JJ Bullion Trade (Owner)
**Prepared by:** Developer

---

## Accounts Being Handed Over

All four accounts below are linked to one Gmail: **jjledgerpro@gmail.com**
Make sure you have the password for this Gmail before signing off.

---

## 1. GitHub Account Handover

**What it is:** Stores all the app's code. Every update to the app goes through here and automatically publishes to the live site.

**Account:** github.com → logged in as jjledgerpro@gmail.com

### Checklist

- [ ] You can log in to [github.com](https://github.com) with jjledgerpro@gmail.com
- [ ] You can see the repository: **JJ_Bullion_Trade** under organisation **jjledgerpro-high**
- [ ] You can see recent commits (code changes) listed under the repository
- [ ] You understand: **do not delete this repository** — deleting it will take down the live app

> **What you need to do with GitHub:** Nothing day-to-day. It runs automatically. Only needed if you hire a developer to make changes later.

---

## 2. Netlify Account Handover

**What it is:** Hosts the live app on the internet. Every time code is pushed to GitHub, Netlify automatically updates the live site within 2–3 minutes.

**Account:** netlify.com → logged in as jjledgerpro@gmail.com

### Checklist

- [ ] You can log in to [netlify.com](https://netlify.com) with jjledgerpro@gmail.com
- [ ] You can see the project **JJLedger_Pro** in the dashboard
- [ ] The site status shows **Published** (green)
- [ ] You can click the live URL and the app loads correctly
- [ ] You understand: **do not disconnect GitHub from Netlify** — that will stop auto-deploys

> **What you need to do with Netlify:** Nothing day-to-day. It runs automatically.

---

## 3. Supabase Account Handover

**What it is:** The database where all your customer data, transactions, and balances are stored securely in the cloud.

**Account:** supabase.com → logged in as jjledgerpro@gmail.com
**Project name:** JJLedger_Pro
**Project ID:** qluvdjfgcjvlktxmnjgo

### Checklist

- [ ] You can log in to [supabase.com](https://supabase.com) with jjledgerpro@gmail.com
- [ ] You can see the project **JJLedger_Pro** in the dashboard
- [ ] Go to **Table Editor** — you can see tables: customers, transactions, organizations, profiles, chit_schemes
- [ ] Go to **Edge Functions** — you can see **send-report** listed and deployed
- [ ] Go to **Edge Functions → Secrets** — you can see these 4 secrets are set (values hidden, that's normal):
  - `GMAIL_USER`
  - `GMAIL_PASS`
  - `GMAIL_PASS`
  - `REPORT_TO`
  - `CRON_SECRET`
- [ ] Go to **Database → Extensions** — pg_cron and pg_net are enabled
- [ ] Go to **Database → Cron Jobs** (or SQL Editor → run `select jobname, schedule from cron.job`) — you see 4 jobs:
  - `daily-report` — schedule `15 18 * * *`
  - `weekly-report` — schedule `30 2 * * 0`
  - `test-daily-report` — one-time (can be deleted after testing)
  - `test-weekly-report` — one-time (can be deleted after testing)

### Important — Supabase Free Plan Limits

Your plan is **Free tier**. Stay within these limits to avoid restrictions:

| Resource | Free Limit | What Uses It |
|---|---|---|
| Egress (data transfer) | 5 GB/month | App syncing data to devices |
| Database Size | 500 MB | All your customer + transaction data |
| Monthly Active Users | 50,000 | Number of people logging in |

The app has been optimised to keep egress low. If you ever see a warning email from Supabase about limits, contact your developer.

> **What you need to do with Supabase:** Nothing day-to-day. Check it once a month to make sure the project is running (green status).

---

## 4. Gmail Account Handover

**What it is:** jjledgerpro@gmail.com is used to send the daily and weekly email reports to pj070596@gmail.com automatically.

**Account:** Gmail → jjledgerpro@gmail.com

### Checklist

- [ ] You have the password for **jjledgerpro@gmail.com**
- [ ] You can log in and see the inbox
- [ ] 2-Step Verification is turned ON (required for App Password to work)
- [ ] The App Password for "JJ Ledger Reports" is already set up — **do not revoke it** or emails will stop sending
- [ ] You have received the test daily report email at pj070596@gmail.com
- [ ] You have received the test weekly report email at pj070596@gmail.com
- [ ] Both emails had an Excel file (.xlsx) attached
- [ ] The Excel file opens correctly in Excel or Google Sheets

> **What you need to do with Gmail:** Nothing day-to-day. If you ever change the Gmail password, you must regenerate the App Password and update the `GMAIL_PASS` secret in Supabase.

---

## 5. App Sign-Off Checklist

These are the basic checks the customer must verify before signing off the project.

### Login & Access

- [ ] Owner can log in with Owner passcode
- [ ] Staff can log in with Staff passcode
- [ ] View can log in with View passcode
- [ ] Staff cannot see the Export All Data button (owner-only)
- [ ] View cannot add transactions

### Customer Management

- [ ] Can add a new customer with name and mobile number
- [ ] Customer appears in the customer list immediately
- [ ] Customer's balance starts at zero

### Transactions

- [ ] Can add a Bullion Cash transaction (jama and nave)
- [ ] Can add a Bullion Gold transaction (in grams)
- [ ] Can add a Bullion Silver transaction (in grams)
- [ ] Balance updates correctly after each transaction
- [ ] Transaction appears in the Ledger page
- [ ] Last 5 transactions show correctly under the customer

### WhatsApp

- [ ] In Dues page, tapping the WhatsApp button opens WhatsApp with the correct message
- [ ] Message shows customer balance with jama/nave labels (not CR/DR)
- [ ] Message shows last 5 transactions at the bottom

### Due Dates & Dues Page

- [ ] Can set a due date on a customer
- [ ] Overdue customers show in red on the Dues page
- [ ] Days overdue count is correct

### Email Reports (after test emails received)

- [ ] Received daily report email at pj070596@gmail.com
- [ ] Received weekly report email at pj070596@gmail.com
- [ ] Both emails have Excel file attached
- [ ] Excel file has correct sheets: Customer Balances, Transactions, Summary, Overdue Customers
- [ ] Numbers in Excel match what you see in the app

### Export All Data

- [ ] Log in as Owner → go to Settings
- [ ] Click "Download Full Dump (.xlsx)"
- [ ] File downloads automatically
- [ ] File opens and shows all 4 sheets with correct data

### Multi-Device Sync

- [ ] Add a transaction on the desktop browser
- [ ] Open the app on your phone — the transaction appears within a few seconds
- [ ] (This confirms Realtime sync is working)

### Settings

- [ ] Owner can change the Owner passcode
- [ ] Owner can change the Staff passcode
- [ ] New passcode works immediately on next login

---

## What to Do If Something Breaks

| Problem | First Step |
|---|---|
| App not loading | Check [netlify.com](https://netlify.com) — is the site Published? |
| Data not syncing | Check [supabase.com](https://supabase.com) — is the project running? |
| Email reports not arriving | Check spam folder first. Then check Supabase Edge Functions → send-report logs |
| Login not working | Check the passcode. If forgotten, go to Settings and reset it |
| Need a code change | Contact your developer with the GitHub repo link |

---

## Developer Contact

For any issues with the app, provide the developer with:
- The GitHub repository: **github.com/jjledgerpro-high/JJ_Bullion_Trade**
- The Supabase Project ID: **qluvdjfgcjvlktxmnjgo**
- A description of the problem and a screenshot if possible

---

*Handover completed on 30 June 2026.*
*Both parties confirm all checklists above have been verified and signed off.*

**Customer sign-off:** _________________________ Date: _____________

**Developer sign-off:** _________________________ Date: _____________
