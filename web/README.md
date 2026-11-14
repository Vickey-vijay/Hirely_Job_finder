# Hirely Web

React 18 + Vite + TypeScript website. Plain CSS (`src/styles.css`), animations with Framer Motion.

```
npm install
npm run dev        # http://localhost:5173, needs the API running on port 4000
npm run build      # typecheck and production build to dist/
```

```
src/
  App.tsx            routes, first-load screen, animated page switching
  api.ts             every call to the server, with user-facing error messages
  auth.tsx           sign-in state
  account.tsx        site settings + the signed-in user's profile and plan
  components/        Aurora, Orb, Splash, Transition, Nav, ui.tsx (score ring, chips input, plan cards, footer...)
  pages/             Landing, Login, Onboarding, Plans, Dashboard, Matches, Tailored, Settings, Legal, Admin
  styles.css         colours and all styles (change the palette at the top)
```

There is no `.env` for the website. Settings such as the Google client ID and plan prices come from the server (`/api/public/config`). Publishing is done by `deploy/push.sh` from the repo root.
