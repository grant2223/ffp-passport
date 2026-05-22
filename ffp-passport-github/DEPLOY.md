# Deploy FFP Passport to Vercel + GitHub

## Step 1: Create GitHub Repo

1. Go to [github.com/new](https://github.com/new)
2. Name: `ffp-passport`
3. Description: `UAE Active Lifestyle Passport 2026`
4. Public repo
5. Click **Create repository**

## Step 2: Push Code to GitHub

```bash
# Clone your new repo
git clone https://github.com/YOUR_USERNAME/ffp-passport.git
cd ffp-passport

# Copy all FFP files into this directory
# (Copy all files from the folder I provided)

# Initialize git and push
git add .
git commit -m "Initial FFP Passport launch"
git push origin main
```

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **New Project**
3. Select **Import Git Repository**
4. Paste your GitHub repo URL: `https://github.com/YOUR_USERNAME/ffp-passport`
5. Click **Import**
6. Vercel auto-detects the config (uses `vercel.json`)
7. Click **Deploy**

✅ **Live in ~30 seconds**

## Step 4: Connect Custom Domain

1. In Vercel dashboard, go to **Domains**
2. Add `ffppassport.com`
3. Update your domain registrar DNS to point to Vercel
4. DNS propagation takes 5–30 minutes

---

## What's Configured

✅ Static HTML deployment (no build needed)  
✅ Route redirects (/, /login, /member, /provider, /admin)  
✅ Caching headers for performance  
✅ Ready for custom domain  

---

## Environment

- **No dependencies** — Pure HTML/CSS/JavaScript
- **No build step** — Deploy as-is
- **Auto-scaling** — Vercel handles traffic

---

Need help? Check [vercel.com/docs](https://vercel.com/docs)
