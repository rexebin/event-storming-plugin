# Publishing to VS Code, Chrome, and Edge marketplaces

This repo ships one extension in two forms:
- **VS Code extension** — `dist/vscode-preview.js` + `style.css`, packaged as a `.vsix`.
- **Browser extension** (Chrome & Edge, same Manifest V3 package) — `dist/manifest.json`, `dist/content.js`, `dist/style.css`, `dist/icon.png`.

`.github/workflows/publish-extensions.yml` builds, tests, and publishes all three whenever
you push a tag like `v1.1.0`. Each publish job is skipped automatically until its secrets
exist, so you can set the marketplaces up one at a time.

## Release checklist (once accounts are set up)

1. Bump the version in **both** `package.json` and `manifest.json` (they must match — the
   workflow fails fast if they don't).
2. Commit, then tag and push:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
3. Watch the `Publish Extensions` run in the Actions tab.

---

## 1. VS Code Marketplace

1. Create a **publisher** at https://marketplace.visualstudio.com/manage (sign in with a
   Microsoft account). Use publisher id `rexebin` to match `package.json`'s `publisher` field.
2. Create an Azure DevOps organization at https://dev.azure.com if you don't have one — the
   Marketplace uses Azure DevOps for auth even though the extension isn't an Azure DevOps
   product.
3. Generate a Personal Access Token: Azure DevOps → user settings → **Personal Access
   Tokens** → New Token.
   - Organization: **All accessible organizations**
   - Scopes: **Marketplace → Manage**
4. Add the token as a GitHub repo secret named `VSCE_PAT`
   (Settings → Secrets and variables → Actions → New repository secret).

That's the only secret VS Code needs. First publish can also be done manually as a sanity
check: `npm run build && npx @vscode/vsce publish -p <token>`.

---

## 2. Chrome Web Store

1. Register as a developer at https://chrome.google.com/webstore/devconsole (one-time $5 fee).
2. **First submission must be manual** (the API can only update an existing listing):
   - `npm run build && cd dist && zip -r ../event-storming-plugin-chrome.zip .`
   - Upload `event-storming-plugin-chrome.zip` via the dashboard, fill in the store listing,
     submit for review.
   - Once created, copy the **item ID** from the dashboard URL
     (`.../detail/<ITEM_ID>/edit`) — this is `CHROME_EXTENSION_ID`.
3. Create OAuth credentials for the Chrome Web Store API:
   - Go to https://console.cloud.google.com, create (or reuse) a project.
   - Enable the **Chrome Web Store API**.
   - Credentials → **Create Credentials → OAuth client ID** → Application type: Desktop app.
   - Note the **Client ID** and **Client Secret**.
4. Generate a refresh token (one-time, run locally):
   ```bash
   # Open this URL in a browser, sign in with the developer account, approve, and copy the "code" param from the redirect:
   echo "https://accounts.google.com/o/oauth2/auth?client_id=<CLIENT_ID>&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/chromewebstore&response_type=code"

   # Exchange the code for a refresh token:
   curl -s -X POST https://oauth2.googleapis.com/token \
     -d "client_id=<CLIENT_ID>" \
     -d "client_secret=<CLIENT_SECRET>" \
     -d "code=<CODE_FROM_REDIRECT>" \
     -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob" \
     -d "grant_type=authorization_code"
   ```
   The response's `refresh_token` field is `CHROME_REFRESH_TOKEN`.
5. Add four GitHub repo secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`,
   `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.

---

## 3. Microsoft Edge Add-ons

1. Register as a developer at https://partner.microsoft.com/dashboard/microsoftedge
   (no fee).
2. **First submission must be manual**, same package as Chrome:
   - Upload `event-storming-plugin-chrome.zip` via the dashboard, fill in the store listing,
     submit for review.
   - Copy the **Product ID** from the dashboard — this is `EDGE_PRODUCT_ID`.
3. Register an API client: in Partner Center, go to **Publish API** access settings and
   create credentials. This gives you:
   - `EDGE_CLIENT_ID`
   - `EDGE_CLIENT_SECRET`
   - `EDGE_ACCESS_TOKEN_URL` (an Azure AD tenant-specific token endpoint, looks like
     `https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token`)
4. Add three GitHub repo secrets: `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_CLIENT_SECRET`,
   `EDGE_ACCESS_TOKEN_URL`.

---

## Notes

- All three marketplaces require the **first** listing to be created manually through their
  web dashboards — the APIs only update an existing product. The workflow automates every
  release *after* that.
- Review turnaround varies: VS Code Marketplace publishes near-instantly; Chrome Web Store
  and Edge Add-ons both run manual/automated review that can take hours to a few days,
  especially for the very first submission.
- If a marketplace's secrets aren't set yet, its job is skipped (not failed) — safe to merge
  this workflow before every account exists.
