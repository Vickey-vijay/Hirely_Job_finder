# Google Login — Setup and How It Works

## How it works
1. The browser shows Google's own "Continue with Google" button (Google Identity Services).
2. Google returns a signed **ID token** to the page.
3. The page POSTs the token to `POST /api/auth/google`.
4. The API verifies it with Google's library (signature, expiry, issuer, and that it was issued for **our** client ID), requires a verified email, then creates or finds the user.
5. The API sets a **httpOnly, SameSite=Lax** session cookie (7 days; `Secure` in production). JavaScript can't read it.
6. `GET /api/auth/me` returns the signed-in user on every page load; `POST /api/auth/logout` clears the cookie.

Security measures: server-side token verification, httpOnly cookie, origin allow-list on POSTs, rate limit (20/min) on login, `helmet` headers, 10 KB body limit, fail-fast config validation. Users are keyed by Google's stable `sub`, not email.

Users live in PostgreSQL (see `docs/DATABASE.md`). The same email signing in with Google or with an emailed code lands on one account. For the full production setup on your VPS follow **`docs/VPS_DEPLOY.md`**; this page covers only the Google side.

## One-time Google Cloud setup (only you can do this)
1. Go to https://console.cloud.google.com and create a project (e.g. "Hirely").
2. **APIs & Services → OAuth consent screen**: choose External, app name "Hirely", your support email. Scopes: the defaults (email, profile, openid). While in Testing mode, add your own Gmail under **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. **Authorized JavaScript origins:** `http://localhost:5173` (add your production domain later). No redirect URIs are needed for this button flow.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). It is not a secret; you don't need the client secret.

## Configure
```powershell
# api/.env  (copy from api/.env.example)
DATABASE_URL=                            # leave empty in development: embedded database, nothing to install
GOOGLE_CLIENT_ID=<your client id>        # optional: leave empty to use email login only
JWT_SECRET=<48+ random bytes, see below>
ALLOWED_ORIGINS=http://localhost:5173
# SMTP_* left empty in development: the email code is printed in the API console

# web/.env  (copy from web/.env.example)
VITE_GOOGLE_CLIENT_ID=<same client id>
```
Generate the secret:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Run (two terminals, Windows PowerShell)
```powershell
cd api ; npm install ; npm run dev     # http://localhost:4000
cd web ; npm install ; npm run dev     # http://localhost:5173
```
Open **http://localhost:5173** (must be `localhost`, see below).

## Testing on your phone
Google only accepts `localhost` or a real HTTPS domain as an origin, so `http://192.168.x.x:5173` will **not** work for Google sign-in. Use a tunnel:
1. Run `cloudflared tunnel --url http://localhost:5173` (or ngrok). You get an `https://something.trycloudflare.com` URL.
2. Add that URL to the OAuth client's **Authorized JavaScript origins** and to `ALLOWED_ORIGINS` in `api/.env`, then restart the API.
3. Open the tunnel URL on your phone.

## Troubleshooting Google errors
| Google says | Cause and fix |
|---|---|
| **401 invalid_client — "The OAuth client was not found"** | The Client ID the app is sending doesn't exist in Google. In development the login page prints the ID it loaded (small text under the button); compare it character by character with Google Cloud → Credentials. Common causes: ID copied from a different Google Cloud project; client was deleted; value truncated, has quotes or spaces; `web/.env` saved as `.env.txt` by Notepad; `npm run dev` not restarted after editing `.env`; you pasted the *Client secret* or a project number instead of the *Client ID*. |
| **400 origin_mismatch** | `http://localhost:5173` (exact, no trailing slash) is missing from *Authorized JavaScript origins*. Wait a few minutes after saving. |
| **403 access_denied / app not verified** | Consent screen is in *Testing*: add your Gmail under *Test users*. |
| Button missing | `VITE_GOOGLE_CLIENT_ID` is empty. A dev note on the login page tells you. |

## Tests
`cd api ; npm test` runs 10 tests against an in-memory Postgres with a fake Google verifier and fake mailer (cookie flags, bad token, bad origin, tampered cookie, same user via Google and email, code single-use, lockout, expiry, rate limit, config validation). Real Google tokens can only be tested in a browser with your client ID.

## Before going public
- Set `NODE_ENV=production` (turns on `Secure` cookies) and serve over HTTPS.
- Publish the OAuth consent screen (move from Testing to In production) so non-test users can sign in.
- Add a privacy policy URL on the consent screen.
- Everything above, plus server hardening, backups and Nginx: `docs/VPS_DEPLOY.md`.
