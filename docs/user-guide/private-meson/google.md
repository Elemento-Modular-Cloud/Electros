# Google (private Meson)

Create a Google Cloud service account and JSON key for Electros. Provider id in Electros: **`google`**.

## Create a service account

Use an existing GCP project, or create one.

1. Open **IAM** → **Service Accounts** and create a new service account.

![Create a Google Cloud service account](../assets/private-meson-google-1-service-account.png)

2. Continue and grant these roles:

- **API Keys Admin**
- **Compute Admin**
- **Databases Admin**
- **Kubernetes Engine Admin**
- **Kubernetes Engine Default Node Service Account**

3. Continue and save the service account.

## Create a JSON key

1. On the service account, open **Manage keys**.

![Manage keys on the service account](../assets/private-meson-google-2-manage-keys.png)

2. Create a new **JSON** key.

![Create a JSON key](../assets/private-meson-google-3-json-key.png)

The key file downloads automatically. Store it safely. The shape looks like this (values redacted):

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

Paste the JSON contents into the Electros Google Meson credential form.

## Enable required APIs

In the same project, enable:

- **Compute Engine API**
- **Cloud SQL Admin API**
- **Kubernetes Engine API**

![Enable Google Cloud APIs](../assets/private-meson-google-4-apis.png)

## Finish in Electros

1. **Connections** → **Add Provider** → **Private** → **Google**.
2. Set a **Target name** and paste the service-account JSON.
3. **Conclude**, then enable the target on **Active Connections**.
