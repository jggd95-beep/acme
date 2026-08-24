# Acme HVAC Quotes — GitHub / Vercel deploy

Built: Sun Aug 23, 2026 ~8:10 PM PDT
Label: ACME-HVAC-GITHUB-20260823-2010

## Deploy (Vercel)

1. Unzip this archive
2. Push folder contents to a new GitHub repo (do NOT commit node_modules)
3. Vercel → Import repo → Framework Vite → Deploy
4. Send partner the live URL

```bash
unzip ACME-HVAC-GITHUB-*.zip
cd <folder-with-package.json>
npm install
npm run build   # optional local check
```

```bash
git init
git add .
git commit -m "Acme HVAC Quotes partner demo"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## Included

- Full source (src/, public/, scripts/, server/, migrations/)
- package.json + lockfile, vite, vercel.json
- Package fixes: one outdoor + indoor head per card, option +$ deltas, splash cleanup

## Not included

- node_modules — run npm install after unzip

Quotes save in browser localStorage (per device) until a backend is wired.
