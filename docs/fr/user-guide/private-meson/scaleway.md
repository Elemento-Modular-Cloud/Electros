# Scaleway (Meson privé)

Rassemblez l’organisation, le projet, l’application et les clés API Scaleway pour Electros. Identifiant fournisseur : **`scaleway`**.

## Ce dont vous avez besoin

| Champ | Comment l’obtenir |
|-------|-------------------|
| `SCALEWAY_ORGANIZATION_ID` | Tableau de bord Organisation → Copy ID |
| `SCALEWAY_PROJECT_ID` | Tableau de bord Projet → Copy ID |
| `SCALEWAY_APPLICATION_ID` | IAM → Applications |
| `SCALEWAY_API_KEY` / `SCALEWAY_SECRET_KEY` | IAM → API keys |

## ID d’organisation

1. Ouvrez **Organization Dashboard** dans la barre latérale gauche.
2. Cliquez sur **Copy ID** à côté du nom de votre organisation.

![Tableau de bord organisation Scaleway](../../../user-guide/assets/private-meson-scaleway-1-org.png)

## ID de projet

1. Ouvrez **Project Dashboard**. Utilisez un projet existant ou créez-en un. Sélectionnez le bon projet dans le menu en haut à côté du nom de l’organisation.
2. Cliquez sur **Copy ID** à côté du nom du projet.

![Tableau de bord projet Scaleway](../../../user-guide/assets/private-meson-scaleway-2-project.png)

## Application, politique et clés API

1. Ouvrez **IAM** dans la barre latérale gauche.

![IAM Scaleway](../../../user-guide/assets/private-meson-scaleway-3-iam.png)

2. Ouvrez **Applications** et créez une application nommée `elemento-meson`.
3. Copiez l’identifiant d’application dans **`SCALEWAY_APPLICATION_ID`**.

![Application Scaleway](../../../user-guide/assets/private-meson-scaleway-4-application.png)

4. Ouvrez **Policies** et créez une politique pour cette application.

![Créer une politique Scaleway](../../../user-guide/assets/private-meson-scaleway-5-policy.png)

5. Ajoutez les règles nécessaires au Meson Elemento sur le projet, puis confirmez.

![Règles de politique Scaleway](../../../user-guide/assets/private-meson-scaleway-6-rules-a.png)

![Règles de politique Scaleway (suite)](../../../user-guide/assets/private-meson-scaleway-7-rules-b.png)

6. Ouvrez **API keys** et créez une clé. Sélectionnez le bon projet sous Object Storage.

![Créer une clé API Scaleway](../../../user-guide/assets/private-meson-scaleway-8-api-key.png)

7. Copiez le **Key ID** et le **secret** lorsqu’ils s’affichent.

## Terminer dans Electros

1. **Connections** → **Add Provider** → **Private** → **Scaleway**.
2. Collez l’organisation, le projet, l’application et les clés API.
3. **Conclude**, puis activez la cible dans **Active Connections**.
