# UpCloud (Meson privé)

Créez un sous-compte UpCloud API uniquement et un jeton API pour Electros. Identifiant fournisseur : **`upcloud`**.

## Créer les identifiants dans l’UI UpCloud

1. Connectez-vous à [hub.upcloud.com](https://hub.upcloud.com) avec le compte UpCloud qui doit posséder ces identifiants (compte principal ou un sous-compte créé à cet effet).
2. Allez dans **Account** → **Users / Sub-accounts** → **Add user**.
3. Définissez un **username** et un **password**.
4. Activez **Allow API connections**, et laissez **Allow control panel login** désactivé — accès API uniquement, pas de connexion GUI.
5. Enregistrez. Vous avez maintenant une paire nom d’utilisateur / mot de passe UpCloud.
6. Connectez-vous avec ce sous-compte.
7. Ouvrez la page **Account** et créez une nouvelle **API key**.

![Clé API UpCloud](../../../user-guide/assets/private-meson-upcloud-1-api-key.png)

8. Définissez une expiration longue. Sans jeton valide, Elemento perd l’accès à votre compte.
9. Copiez le jeton pour Electros.

## Terminer dans Electros

1. **Connections** → **Add Provider** → **Private** → **UpCloud**.
2. Saisissez le nom d’utilisateur, le mot de passe et le jeton API selon le formulaire.
3. **Conclude**, puis activez la cible dans **Active Connections**.
