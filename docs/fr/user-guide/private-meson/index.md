# Identifiants Meson privé

Un **Meson privé** permet à votre organisation d’utiliser son propre compte cloud (bring your own credentials) au lieu d’une démo Meson publique partagée.

Vous enregistrez le compte une fois sous [Connexions](../04-connections) → **Add Provider** → **Private**, puis vous l’activez dans [Connexions actives](../03-my-clouds) quand vous en avez besoin.

## À quoi sert cette page

Ces guides expliquent comment créer les identifiants que Electros demande. Choisissez votre cloud, suivez les étapes dans sa console, puis collez les valeurs dans le formulaire Electros. Traitez chaque clé et secret comme confidentiels.

## Comment connecter dans Electros

1. Ouvrez **Connections** → Targets → **Add Provider**.
2. Choisissez **Private**.
3. Sélectionnez **un** fournisseur.
4. Saisissez un **Target name**.
5. Remplissez les champs d’identifiants (voir le guide du fournisseur ci-dessous).
6. **Conclude**.
7. Dans **Active Connections**, activez la nouvelle cible (ou un scénario qui l’inclut).

## Fournisseurs

| Fournisseur | Guide |
|-------------|--------|
| Google | [google](./google) |
| Azure | [azure](./azure) |
| OVH | [ovh](./ovh) |
| UpCloud | [upcloud](./upcloud) |
| Scaleway | [scaleway](./scaleway) |
| AWS | [aws](./aws) |

N’envoyez pas les identifiants par e-mail ou chat. Saisissez-les uniquement dans Electros.
