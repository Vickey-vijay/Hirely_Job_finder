# Hirely Web

React 18 + Vite + TypeScript front end. Minimal UI, animated page transitions.

## Run on Windows (PowerShell)

1. Install Node 22 LTS (https://nodejs.org) and Git for Windows.
2. Keep the project in a path without spaces, for example `C:\dev\Hirely_Job_finder`.
3. Then:

```powershell
git config --global core.longpaths true
git clone https://github.com/Vickey-vijay/Hirely_Job_finder.git
cd Hirely_Job_finder
git checkout feat/web-ui
cd web
npm install
npm run dev
```

Open http://localhost:5173.

## Scripts
- `npm run dev` — dev server
- `npm run build` — typecheck and production build to `dist/`
- `npm run preview` — serve the production build

## Structure
```
src/
  App.tsx            routes + splash + animated route switching
  auth.tsx           DEMO auth (localStorage); replaced by Google OAuth later
  data.ts            demo matches; replaced by API
  components/        Aurora, Orb, Splash, Transition (curtain), Nav
  pages/             Landing, Login, Dashboard, Matches, Settings
  styles.css         palette tokens and styles
```

## Deploy
`vercel.json` rewrites all routes to `index.html` for the SPA. Import the repo in Vercel (root directory `web`), or run `npx vercel` from this folder. Not deployed yet.

See `../docs/DEVLOG.md` and `../docs/DECISIONS.md`.
