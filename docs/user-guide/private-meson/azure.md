# Azure (private Meson)

Register an Entra ID app and grant it rights on your subscription or resource group. Provider id: **`azure`**.

## 1. Note the Subscription ID

Search → open your target subscription → copy **Subscription ID** from Overview → `AZURE_SUBSCRIPTION_ID`.

![Azure subscription ID](../assets/private-meson-azure-1-subscription.png)

## 2. Create the App Registration

Search → **Microsoft Entra ID** → **App registrations** → **+ New registration**.

- **Name:** something recognizable, for example `elemento-meson-<customer>`
- **Supported account types:** Accounts in this organizational directory only (single tenant)
- **Redirect URI:** leave blank
- Click **Register**

On Overview, copy:

- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`

![Azure app registration overview](../assets/private-meson-azure-2-app-reg.png)

## 3. Create a client secret

App Registration → **Certificates & secrets** → **Client secrets** → **+ New client secret**.

- Set a description and expiry (Azure caps this at 24 months — set a reminder to rotate it).
- Click **Add**.
- Immediately copy the **Value** column (not Secret ID). Azure shows it only once. → `AZURE_CLIENT_SECRET`

![Azure client secret](../assets/private-meson-azure-3-secret.png)

## 4. (Recommended) Create a resource group

Search → **Resource groups** → **+ Create**. Pick the subscription and a region, name it (for example `elemento-byoc-<customer>`). Optional — if you skip it, the meson creates one named after the org — but pre-creating it lets you scope the role assignment tightly. → `AZURE_RESOURCE_GROUP_NAME`

## 5. Grant the app permission to manage resources

Without this step, authentication succeeds but every API call fails with **403**.

1. Open that **resource group** (or the subscription, if the app should manage more than one RG).
2. **Access control (IAM)** → **+ Add** → **Add role assignment**.
3. Roles: **Contributor** and **Storage Blob Data Contributor**.
4. **Members** → **+ Select members** → search for the App Registration by the name from step 2 (it does not appear under Users) → **Select**.
5. **Review + assign**.

## Finish in Electros

1. **Connections** → **Add Provider** → **Private** → **Azure**.
2. Enter subscription, tenant, client id, client secret, and optional resource group.
3. **Conclude**, then enable the target on **Active Connections**.
