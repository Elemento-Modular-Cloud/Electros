# Google (Meson privato)

Crea un service account Google Cloud e una chiave JSON per Electros. Id provider in Electros: **`google`**.

## Crea un service account

Usa un progetto GCP esistente oppure creane uno.

1. Apri **IAM** → **Service Accounts** e crea un nuovo service account.

![Crea un service account Google Cloud](../../../user-guide/assets/private-meson-google-1-service-account.png)

2. Continua e assegna questi ruoli:

- **API Keys Admin**
- **Compute Admin**
- **Databases Admin**
- **Kubernetes Engine Admin**
- **Kubernetes Engine Default Node Service Account**

3. Continua e salva il service account.

## Crea una chiave JSON

1. Sul service account, apri **Manage keys**.

![Gestisci le chiavi del service account](../../../user-guide/assets/private-meson-google-2-manage-keys.png)

2. Crea una nuova chiave **JSON**.

![Crea una chiave JSON](../../../user-guide/assets/private-meson-google-3-json-key.png)

Il file si scarica automaticamente. Conservalo in modo sicuro. La struttura è simile a questa (valori oscurati):

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "…",
  "private_key": "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n",
  "client_email": "meson-service-account@your-project-id.iam.gserviceaccount.com",
  "client_id": "…",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "…",
  "universe_domain": "googleapis.com"
}
```

Incolla il contenuto JSON nel modulo credenziali Google Meson di Electros.

## Abilita le API necessarie

Nello stesso progetto, abilita:

- **Compute Engine API**
- **Cloud SQL Admin API**
- **Kubernetes Engine API**

![Abilita le API Google Cloud](../../../user-guide/assets/private-meson-google-4-apis.png)

## Completa in Electros

1. **Connections** → **Add Provider** → **Private** → **Google**.
2. Imposta un **Target name** e incolla il JSON del service account.
3. **Conclude**, poi abilita il target in **Active Connections**.
