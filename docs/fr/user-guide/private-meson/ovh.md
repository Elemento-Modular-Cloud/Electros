# OVH (Meson privé)

Créez un jeu de jetons API OVH et un ID de projet pour Electros. Identifiant fournisseur : **`ovh`**.

## Champs requis par Electros

| Champ | Description |
|-------|-------------|
| `OVH_APPLICATION_KEY` | Clé d’application du compte OVH |
| `OVH_APPLICATION_SECRET` | Secret d’application |
| `OVH_CONSUMER_KEY` | Clé consommateur autorisée sur ce compte/projet |
| `OVH_PROJECT` | ID du projet Public Cloud OVH |

## ID de projet

L’ID du projet Public Cloud (`OVH_PROJECT`) se trouve sous **Public Cloud → [nom du projet]**. C’est l’ID dans l’URL (`/public-cloud/projects/<project-id>/…`) et dans les paramètres du projet — pas le nom lisible.

![ID de projet OVH](../../../user-guide/assets/private-meson-ovh-1-project.png)

## Clé d’application, secret et clé consommateur

1. Connectez-vous au compte OVH auquel appartiennent les identifiants.
2. Ouvrez [https://api.ovh.com/createToken/](https://api.ovh.com/createToken/) (ou `api.us.ovhcloud.com` / `api.ca.ovh.com` pour d’autres endpoints) tout en étant connecté à ce compte.
3. Remplissez :
   - **Application name :** par exemple `elemento-meson`
   - **Application description :** texte libre
   - **Validity :** illimitée sauf si vous voulez que le jeton expire
   - **Rights :** ce formulaire crée aussi une clé consommateur, donc définissez les droits ici

| Méthode | Chemin |
|---------|--------|
| GET | `/cloud/project/{serviceName}/capabilities/kube/flavors` |
| GET, POST, DELETE | `/cloud/project/{serviceName}/kube` |
| GET, POST, DELETE | `/cloud/project/{serviceName}/kube/*` |
| GET, POST | `/cloud/project/{serviceName}/network/private` |
| GET | `/cloud/project/{serviceName}/network/private/*` |
| GET, POST, DELETE | `/cloud/project/{serviceName}/region/*/gateway` |
| GET, DELETE | `/cloud/project/{serviceName}/region/*/gateway/*` |
| GET | `/cloud/project/{serviceName}/operation/*` |

Un équivalent plus simple est `GET`, `POST`, `PUT`, `DELETE` sur `/cloud/project/{serviceName}/*`.

4. Validez. OVH renvoie **Application Key**, **Application Secret** et **Consumer Key** une seule fois — copiez-les immédiatement.

![Résultat du jeton API OVH](../../../user-guide/assets/private-meson-ovh-2-token.png)

5. Visitez l’**URL de validation** envoyée par OVH (e-mail ou à l’écran). La clé consommateur n’est pas utilisable tant que vous n’avez pas confirmé en étant connecté au même compte.

## Terminer dans Electros

1. **Connections** → **Add Provider** → **Private** → **OVH**.
2. Saisissez la clé d’application, le secret, la clé consommateur et l’ID de projet.
3. **Conclude**, puis activez la cible dans **Active Connections**.
