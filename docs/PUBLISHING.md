# Publishing to VS Code, Chrome, and Edge marketplaces

This repo ships one extension in two forms:
- **VS Code extension** — `dist/vscode-preview.js` + `style.css`, packaged as a `.vsix`.
- **Browser extension** (Chrome & Edge, same Manifest V3 package) — `dist/manifest.json`, `dist/content.js`, `dist/style.css`, `dist/icon.png`.

Two CI systems are involved:
- **`.github/workflows/publish-extensions.yml`** (GitHub Actions) — builds, tests, and
  publishes to Chrome Web Store and Edge Add-ons.
- **`azure-pipelines.yml`** (Azure Pipelines) — builds, tests, and publishes to the VS Code
  Marketplace using Microsoft Entra ID workload identity federation instead of a Personal
  Access Token (VS Code Marketplace PATs retire **2026-12-01**, so this is the path
  Microsoft recommends going forward — see [their docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)).
  This requires an Azure DevOps pipeline as the OIDC client; it can't be done from GitHub
  Actions directly.

Both are triggered by the same version tag, so `git push origin v1.1.0` kicks off both.
Each publish job/step is skipped automatically until its credentials exist, so you can set
the marketplaces up one at a time.

## Release checklist (once accounts are set up)

1. Bump the version in **both** `package.json` and `manifest.json` (they must match — both
   pipelines fail fast if they don't).
2. Commit, then tag and push:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
3. Watch the `Publish Extensions` run in the GitHub Actions tab, and the pipeline run in
   Azure DevOps.

---

## 1. VS Code Marketplace (Azure Pipelines + Entra ID workload identity federation)

This setup is one-time and has more moving parts than the others because it avoids ever
storing a Marketplace credential as a plain secret. Steps 2–6 use the Azure CLI
(`az login` first) and the Azure DevOps web UI together — keep both open.

1. **Create the publisher.** https://marketplace.visualstudio.com/manage → sign in with a
   Microsoft account → create publisher id `rexebin` (must match `package.json`'s
   `publisher` field).

2. **Create an Azure DevOps org + project** at https://dev.azure.com if you don't have one,
   and connect this GitHub repo to it as the pipeline's source (Pipelines → New pipeline →
   GitHub → select `rexebin/event-storming-plugin`, but don't save/run yet — you need the
   service connection first).

3. **Create a resource group and user-assigned managed identity in Azure:**
   ```bash
   az login
   RESOURCE_GROUP="event-storming-plugin-rg"
   LOCATION="eastus"
   IDENTITY_NAME="event-storming-plugin-vsce-publisher"

   az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
   az identity create --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP"
   az identity show --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" \
     --query "{clientId:clientId, principalId:principalId, tenantId:tenantId, id:id}"
   ```
   Save the `clientId`, `principalId`, `tenantId`, and `id` (resource ID) from the output.

   Grant it the Reader role so it's a valid identity for the service connection:
   ```bash
   RG_ID=$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)
   az role assignment create --assignee "<principalId>" --role Reader --scope "$RG_ID"
   ```

4. **Create the Azure DevOps service connection, in draft mode, to collect the federation
   values:**
   - Azure DevOps project → Project Settings → Service connections → New service connection
     → Azure Resource Manager → **Workload Identity Federation (manual)**.
   - Fill in the subscription ID/name and the managed identity's `clientId`/`tenantId` from
     step 3.
   - Save as **draft** — this generates an **Issuer** and **Subject identifier** without
     needing the Azure side to exist yet.

5. **Link the two sides — add a federated credential to the managed identity** using the
   Issuer/Subject from step 4:
   ```bash
   az identity federated-credential create \
     --name "ado-event-storming-plugin" \
     --identity-name "$IDENTITY_NAME" \
     --resource-group "$RESOURCE_GROUP" \
     --issuer "<ISSUER_FROM_STEP_4>" \
     --subject "<SUBJECT_FROM_STEP_4>" \
     --audiences "api://AzureADTokenExchange"
   ```
   Then go back to the draft service connection in Azure DevOps and complete/verify it.
   Grant it access to the pipeline you created in step 2 when prompted (or via Service
   connections → ⋯ → Security → add the pipeline).

6. **Authorize the identity in the Marketplace.** In the Marketplace publisher management
   page (step 1), go to the `rexebin` publisher → members → add member using the managed
   identity's resource ID (`id` from step 3) → role **Contributor**.

   To get the identity's Marketplace-facing profile ID, run a one-off pipeline step (or
   local `az` call while impersonating isn't possible — use a throwaway pipeline run with
   the `AzureCLI@2` task shown below) that calls:
   ```bash
   az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me \
     --resource 499b84ac-1321-427f-aa17-267ca6975798
   ```

7. **Finish creating the pipeline.** Point it at `azure-pipelines.yml` in this repo, and
   replace the `<SERVICE_CONNECTION_NAME>` placeholder in that file with the name you gave
   the service connection in step 4. Save and run once manually to confirm auth works, then
   it will trigger automatically on future `v*.*.*` tags.

No GitHub secret is needed for VS Code — the Azure DevOps pipeline is a separate CI system
from `.github/workflows/publish-extensions.yml`.

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
  web dashboards — the APIs only update an existing product. Automation handles every
  release *after* that.
- Review turnaround varies: VS Code Marketplace publishes near-instantly; Chrome Web Store
  and Edge Add-ons both run manual/automated review that can take hours to a few days,
  especially for the very first submission.
- If a marketplace's secrets/service connection aren't set up yet, its job or pipeline step
  is skipped — safe to merge this automation before every account exists.
- Two separate CI systems are in play only because of the VS Code Marketplace's
  Entra-ID-via-Azure-DevOps requirement — Chrome and Edge are plain API calls and stay in
  GitHub Actions.
