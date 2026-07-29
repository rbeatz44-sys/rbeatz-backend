# RP-Rbeatz44 — Full Backend Setup Guide

This gives you a **permanent** music site — uploads are visible to every visitor on every device, forever, for **$0/month, no credit card required anywhere**.

You need 3 free accounts. Follow these steps in order.

---

## Step 1 — Create your free database (Neon.tech) ✅ Already done!

You already created this. Your `DATABASE_URL` is:
```
postgresql://neondb_owner:npg_xPVN0haov5Ht@ep-shiny-mud-zab3ubjg.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require
```
Keep this safe — you'll paste it into Render in Step 4.

---

## Step 2 — File storage (Backblaze B2) ✅ Already done!

You already created this. Your values are:
```
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
B2_KEY_ID=bfa5de62d407
B2_APPLICATION_KEY=0053060bac17e8ec3b30cbff06026b04297bca9cc9
B2_BUCKET_NAME=Rbeatzmusic
B2_PUBLIC_URL=https://f005.backblazeb2.com/file/Rbeatzmusic
```
Keep these safe — you'll paste them into Render in Step 4.

---

## Step 3 — Push this code to GitHub

1. Go to **github.com** → create a free account if you don't have one
2. Click **"New repository"** → name it `rbeatz-backend` → Create
3. On your computer, extract this zip folder, then in a terminal inside the folder run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/rbeatz-backend.git
   git push -u origin main
   ```
   (Replace `YOUR_USERNAME` with your actual GitHub username)

**Don't have git installed or unsure how?** You can also just drag-and-drop upload all the files directly on GitHub's website — click "uploading an existing file" on your new repo page. Make sure the files land at the TOP LEVEL of the repo (not inside another folder).

---

## Step 4 — Deploy to Render

1. Go to **render.com** → sign up free (use GitHub login for the easiest setup)
2. Click **"New +"** → **"Web Service"**
3. Connect your `rbeatz-backend` GitHub repo
4. Render will auto-detect Node.js. Confirm:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Scroll to **Environment Variables** — add these one by one:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://neondb_owner:npg_xPVN0haov5Ht@ep-shiny-mud-zab3ubjg.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require` |
   | `B2_ENDPOINT` | `s3.us-east-005.backblazeb2.com` |
   | `B2_KEY_ID` | `bfa5de62d407` |
   | `B2_APPLICATION_KEY` | `0053060bac17e8ec3b30cbff06026b04297bca9cc9` |
   | `B2_BUCKET_NAME` | `Rbeatzmusic` |
   | `B2_PUBLIC_URL` | `https://f005.backblazeb2.com/file/Rbeatzmusic` |
   | `CREATOR_EMAIL` | `rbeatz44@gmail.com` |
   | `CREATOR_PASSWORD` | `rele@2008` |

6. Click **"Create Web Service"**
7. Wait 2–3 minutes for the first deploy. You'll get a live URL like:
   ```
   https://rbeatz-backend.onrender.com
   ```

That URL **is your new permanent website** — share that link instead of the old Netlify one.

---

## Important notes

- **Free Render web services "sleep" after 15 minutes of no visitors.** The first visitor after a quiet period may wait ~30 seconds for the site to wake up — totally normal, no cost, no action needed.
- Backblaze B2 free tier = **10GB storage forever**, no card, no expiry — roughly 1,000-2,000 songs depending on file size.
- To upload as creator: **Ctrl+Shift+L** or triple-click the logo, same as before.
- Booking form still uses Web3Forms → straight to your Gmail, unchanged.

## Updating the site later

Whenever you want to change the code (design tweaks, new features):
1. Edit the files
2. `git add . && git commit -m "update" && git push`
3. Render automatically redeploys within a minute — no manual redeploy needed
