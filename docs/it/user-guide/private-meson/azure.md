# Azure (Meson privato)

Registra un’app Entra ID e concedile i diritti sulla subscription o sul resource group. Id provider: **`azure`**.

## 1. Annota il Subscription ID

Cerca → apri la subscription di destinazione → copia **Subscription ID** da Overview → `AZURE_SUBSCRIPTION_ID`.

![Subscription ID Azure](../../../user-guide/assets/private-meson-azure-1-subscription.png)

## 2. Crea l’App Registration

Cerca → **Microsoft Entra ID** → **App registrations** → **+ New registration**.

- **Name:** qualcosa di riconoscibile, ad esempio `elemento-meson-<cliente>`
- **Supported account types:** Accounts in this organizational directory only (single tenant)
- **Redirect URI:** lascia vuoto
- Fai clic su **Register**

In Overview, copia:

- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`

![Overview App Registration Azure](../../../user-guide/assets/private-meson-azure-2-app-reg.png)

## 3. Crea un client secret

App Registration → **Certificates & secrets** → **Client secrets** → **+ New client secret**.

- Imposta descrizione e scadenza (Azure limita a 24 mesi — metti un promemoria per la rotazione).
- Fai clic su **Add**.
- Copia subito la colonna **Value** (non Secret ID). Azure la mostra una sola volta. → `AZURE_CLIENT_SECRET`

![Client secret Azure](../../../user-guide/assets/private-meson-azure-3-secret.png)

## 4. (Consigliato) Crea un resource group

Cerca → **Resource groups** → **+ Create**. Scegli subscription e regione, assegna un nome (ad esempio `elemento-byoc-<cliente>`). Opzionale — se lo salti, il meson ne crea uno col nome dell’org — ma crearlo prima permette di limitare meglio l’assegnazione dei ruoli. → `AZURE_RESOURCE_GROUP_NAME`

## 5. Concedi all’app i permessi di gestione

Senza questo passo l’autenticazione riesce ma ogni chiamata API fallisce con **403**.

1. Apri quel **resource group** (o la subscription, se l’app deve gestire più di un RG).
2. **Access control (IAM)** → **+ Add** → **Add role assignment**.
3. Ruoli: **Contributor** e **Storage Blob Data Contributor**.
4. **Members** → **+ Select members** → cerca l’App Registration col nome del passo 2 (non compare sotto Users) → **Select**.
5. **Review + assign**.

## Completa in Electros

1. **Connections** → **Add Provider** → **Private** → **Azure**.
2. Inserisci subscription, tenant, client id, client secret e resource group opzionale.
3. **Conclude**, poi abilita il target in **Active Connections**.
