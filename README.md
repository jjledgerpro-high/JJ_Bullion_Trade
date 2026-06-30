# JJ Bullion Trade — Ledger App

A simple digital ledger for JJ Bullion Trade to manage customer accounts, track gold/silver/cash transactions, and send WhatsApp reminders.

---

## What This App Does

- **Add customers** and keep track of what they owe you (or you owe them)
- **Record every transaction** — cash, gold grams, silver grams across Retail, Bullion, Silver, and Chit categories
- **See live balances** — every customer's running balance, updated instantly
- **Send WhatsApp reminders** — one tap sends the customer their balance with last 5 transactions
- **Due date tracking** — see who is overdue and for how long
- **Daily & Weekly email reports** — automatically sent to the owner every night and every Sunday morning with an Excel file attached
- **Export all data** — download the full ledger as an Excel file anytime from Settings

---

## Who Can Log In

There are 3 roles:

| Role | What They Can Do |
|---|---|
| **Owner** | Full access — add/view/delete everything, change passcodes, export data, see all reports |
| **Staff** | Add transactions and view ledger. Cannot delete or export |
| **View** | Read-only. Can see balances and transactions but cannot add anything |

---

## How to Access the App

The app runs in any browser or can be installed on your phone as an app (PWA).

**To install on phone:**
- Open the app link in Chrome (Android) or Safari (iPhone)
- Tap "Add to Home Screen"
- The app icon appears on your home screen like a normal app

---

## How the Data is Stored

- All data is saved in **Supabase** (secure cloud database)
- Works on multiple devices at the same time — phone and desktop stay in sync automatically
- If internet is unavailable, the app shows last known data and syncs when back online

---

## Automatic Email Reports

| Report | When | What's Inside |
|---|---|---|
| **Daily Report** | Every night at 11:45 PM IST | Today's transactions, summary totals, all customer balances + Excel file |
| **Weekly Report** | Every Sunday at 8:00 AM IST | Full week's transactions, customer balances, overdue customers + Excel file |

Reports go to: **pj070596@gmail.com**
Sent from: **jjledgerpro@gmail.com**

---

## Jama and Nave — What They Mean

| Word | Meaning |
|---|---|
| **Jama** | Money / gold / silver that came IN to you (you received) |
| **Nave (balance)** | Money / gold / silver that went OUT from you (you gave) |

---

## Key Pages

| Page | What It Does |
|---|---|
| **Home** | Live summary of total cash, gold, silver positions |
| **Customers** | All customers and their balances |
| **Transactions** | Add a new transaction |
| **Ledger** | Full transaction history with filters and search |
| **Dues** | Customers with pending balances — tap WhatsApp to send reminder |
| **Settings** | Change passcodes, export all data (owner only) |

---

## Accounts & Services Used

| Service | Account | Purpose |
|---|---|---|
| GitHub | jjledgerpro@gmail.com | Stores all code |
| Netlify | jjledgerpro@gmail.com | Hosts the live app |
| Supabase | jjledgerpro@gmail.com | Database, real-time sync, email cron jobs |
| Gmail SMTP | jjledgerpro@gmail.com | Sends automated daily/weekly reports |

---

## Built With

- React (app frontend)
- Supabase (database + real-time sync + scheduled jobs)
- Netlify (hosting, auto-deploys from GitHub)
- Gmail SMTP (automated email reports)
- SheetJS (Excel export)
