# Account

Account concerne vous et l'organisation, pas les VM. Ouvrez-le depuis la barre latérale.

## Votre profil

![Account](../../user-guide/assets/10-account-account.png)

**Main details** affiche votre e-mail, l'organisation dans laquelle vous êtes, et votre Gravatar. Changez l'image sur Gravatar, pas dans Electros. L'icône d'info sur l'avatar dit la même chose.

| Bouton | Ce qu'il fait |
|--------|----------------|
| **Change Password** | Ouvre la page de mot de passe du portail Elemento dans un navigateur. Electros ne collecte pas lui-même le nouveau mot de passe |
| **Log Out** | Termine cette session. Vous verrez l'écran de connexion |
| **Restart Onboarding** | Rejoue le tour d'introduction |

**Billing details** liste le code fiscal, le code TVA, le nom de l'entreprise, le code SDI, la nationalité, et l'adresse de facturation (adresse, ville, province, code postal). Les cases démarrent verrouillées.

1. Appuyez sur **Edit Details**. Les champs deviennent modifiables, et **Revert Changes** et **Save Details** apparaissent.
2. Modifiez ce dont vous avez besoin.
3. **Save Details** les enregistre. **Revert Changes** remet les valeurs précédentes et verrouille à nouveau le formulaire.

## Préférences e-mail

![Préférences e-mail](../../user-guide/assets/10-account-email-preferences.png)

L'entrée de la barre latérale est là. Dans la version actuelle, le titre de la page est **Email prefs todo** et le canevas est vide. Il n'y a encore rien à enregistrer. Cela ne change pas qui peut se connecter.

## Organisation

![Organisation](../../user-guide/assets/10-account-organisation.png)

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-org-buttons.png" alt="Create Suborganisation, Subscribe Users et Edit Limits" />
  <figcaption>La page organisation est la façon pour un administrateur de faire grandir le tenant. <strong>Create Suborganisation</strong> partage les quotas. <strong>Subscribe Users</strong> invite des personnes sur un niveau payant. <strong>Edit Limits</strong> change les plafonds. La jauge Members compte tout le monde déjà dans l'organisation.</figcaption>
</figure>

Visible lorsque vous pouvez gérer l'organisation.

Les jauges comptent **Members**, **Suborgs**, **Invitations**, **Admins**, **Owners** et **Nodes**.

Les boutons sous le titre sont **Create Suborganization**, **Subscribe Users** et **Edit Limits**. La bande à droite bascule le tableau entre **Members**, **Suborgs** et **Invites**. Les colonnes du tableau des membres sont **User**, **Role**, **Plan** et **Actions**.

| Je veux… | Où |
|------------|--------|
| Donner à une équipe ses propres quotas | **Create Suborganization**. Étapes sous [Créer une sous-organisation](#creer-une-sous-organisation) |
| Inviter quelqu'un et le placer sur un niveau payant | **Subscribe Users**. Étapes sous [Inviter des personnes et les abonner](#inviter-des-personnes-et-les-abonner). Cela ouvre une page de paiement |
| Ajouter un membre existant à une sous-organisation | Ouvrez la sous-organisation, puis [Ajouter des personnes déjà dans l'organisation](#ajouter-des-personnes-deja-dans-lorganisation) |
| Changer les plafonds CPU, RAM ou réseau | **Edit Limits**. Des nombres vides signifient aucun plafond supplémentaire |
| Retirer un membre ou supprimer une sous-organisation | La ligne demande de saisir le nom. Annulez pour le conserver |

### Créer une sous-organisation

Utilisez une sous-organisation lorsqu'une équipe doit avoir ses propres membres et ses propres quotas.

![Créer une sous-organisation](../../user-guide/assets/create-suborg.png)

1. **Name** — ce que les gens verront dans la liste des organisations.
2. **Admin email** — la personne qui administre cette sous-organisation.
3. **Limits** — laissez un nombre vide pour « aucun plafond supplémentaire ». Les interrupteurs démarrent **activés**, ce qui signifie que ce type de réseau est autorisé.
4. Appuyez sur **Create suborganisation** uniquement lorsque le nom et l'admin sont corrects.

Limites que vous pouvez définir :

| Limite | Unité |
|-------|------|
| Maximum VMs | nombre |
| Total CPU slots | nombre |
| Total RAM | Mio |
| Total storage | Gio |
| Combien de réseaux | totaux, locaux et globaux |
| Quels types de réseau sont autorisés | local, global, NAT, bridge, isolated, fully isolated, changements DHCP, routes statiques |
| Plafonds par pilote | ajoutez une ligne pour un pilote réseau spécifique |

---

### Inviter des personnes et les abonner

![Inviter des utilisateurs et choisir un plan](../../user-guide/assets/create-subscribe-users.png)

1. Choisissez **Monthly** ou **Yearly**. Monthly est déjà sélectionné.
2. Chaque ligne est une personne : son **email** et un **tier**. Le niveau affiche le prix par mois et par an.
3. **Add member** pour une autre ligne. **Remove** supprime une ligne dont vous ne voulez pas.
4. **Invite and subscribe users** ouvre une **page de paiement**. Arrêtez-vous avant ce bouton sauf si vous comptez payer.

---

### Ajouter des personnes déjà dans l'organisation

Ouvrez une sous-organisation, puis **Add members**.

Vous ne pouvez ajouter que des e-mails qui appartiennent déjà à l'organisation parente et qui ne sont pas encore dans cette sous-organisation. Le champ suggère ces personnes au fur et à mesure de la saisie. Cet écran n'invite pas quelqu'un de nouveau dans Electros — utilisez **Invite and subscribe** pour cela.

## Facturation

![Facturation](../../user-guide/assets/10-account-billing.png)

Les jauges sont **Monthly Cost**, **Active**, **Pending**, **Total**, **Paid** et **Failed**.

Les colonnes du tableau sont **Billing UUID**, **Status** (Running, To Delete, suspended), **Start Date**, **End Date**, **Price** et **Actions**.

| Contrôle | Ce qu'il fait |
|---------|----------------|
| **Reload** | Actualise la liste des factures |
| **Filter** | **Show terminated subscriptions** inclut les plans déjà terminés |
| **Print Overview** | Réservé ; le bouton est désactivé |

Un retour du paiement atterrit sur une courte page de rappel. Vous ne remplissez pas cette page. Si vous n'avez jamais démarré le paiement, il n'y a rien à y voir.

Les invitations et la vérification d'e-mail se terminent dans votre boîte mail, en dehors d'Electros. L'application n'affiche le résultat qu'après que vous avez accepté le lien.
