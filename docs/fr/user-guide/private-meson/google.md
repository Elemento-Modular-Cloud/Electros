# Google (Meson privé)

Créez un compte de service Google Cloud et une clé JSON pour Electros. Identifiant fournisseur dans Electros : **`google`**.

## Créer un compte de service

Utilisez un projet GCP existant, ou créez-en un.

1. Ouvrez **IAM** → **Service Accounts** et créez un nouveau compte de service.

![Créer un compte de service Google Cloud](../../../user-guide/assets/private-meson-google-1-service-account.png)

2. Continuez et accordez ces rôles :

- **API Keys Admin**
- **Compute Admin**
- **Databases Admin**
- **Kubernetes Engine Admin**
- **Kubernetes Engine Default Node Service Account**

3. Continuez et enregistrez le compte de service.

## Créer une clé JSON

1. Sur le compte de service, ouvrez **Manage keys**.

![Gérer les clés du compte de service](../../../user-guide/assets/private-meson-google-2-manage-keys.png)

2. Créez une nouvelle clé **JSON**.

![Créer une clé JSON](../../../user-guide/assets/private-meson-google-3-json-key.png)

Le fichier se télécharge automatiquement. Conservez-le en sécurité. La forme ressemble à ceci (valeurs masquées) :

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

Collez le contenu JSON dans le formulaire d’identifiants Google Meson d’Electros.

## Activer les API requises

Dans le même projet, activez :

- **Compute Engine API**
- **Cloud SQL Admin API**
- **Kubernetes Engine API**

![Activer les API Google Cloud](../../../user-guide/assets/private-meson-google-4-apis.png)

## Terminer dans Electros

1. **Connections** → **Add Provider** → **Private** → **Google**.
2. Définissez un **Target name** et collez le JSON du compte de service.
3. **Conclude**, puis activez la cible dans **Active Connections**.
