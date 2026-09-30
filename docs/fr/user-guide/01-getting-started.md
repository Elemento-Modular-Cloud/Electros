# Premiers pas

Electros est l'écran que vous utilisez pour exécuter des charges de travail sur des machines déjà connectées : vos propres hôtes AtomOS, des hyperviseurs tels que Proxmox ou ESXi, et des clouds publics. Vous n'avez pas besoin de vous connecter en SSH sur chaque machine pour créer un disque ou une VM. Vous décrivez ici ce que vous voulez, choisissez l'hôte, et Electros parle à cet hôte pour vous.

Si vous êtes sur le point de créer quelque chose, parcourez d'abord [Comment fonctionne la création](#comment-fonctionne-la-creation). Chaque assistant suit le même rythme : remplissez le formulaire, appuyez sur **Continue**, choisissez un hôte, puis appuyez sur **Create** uniquement lorsque vous comptez réellement provisionner.

![Le shell Electros : barre latérale, tableau de bord et colonne de flotte](../../user-guide/assets/01-getting-started-shell.png)

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-sidebar.png" alt="Barre latérale avec Dashboard sélectionné, groupes repliés, et le pied de page du compte" />
  <figcaption>La barre latérale est la carte. La ligne ambre est la page où vous êtes. Un chevron ouvre un groupe. Le pied de page affiche le compte connecté et la santé des daemons.</figcaption>
</figure>

## À quoi sert le shell

Electros est un plan de contrôle local. La barre latérale ne crée jamais de ressource. Elle ne fait que vous déplacer. La page à droite est l'endroit où vous lisez la flotte ou la modifiez. Le pied de page est la première chose à vérifier lorsqu'une liste est vide ou qu'un assistant ne trouve pas d'hôte : si un daemon est hors service, la ligne de santé passe au rouge et les pages qui dépendent de ce daemon restent vides.

## La barre latérale

La barre de gauche est votre moyen de navigation. Un chevron signifie que l'élément ouvre un groupe. Cliquez sur le nom du groupe pour le développer, puis cliquez sur la page souhaitée.

| Élément | Ce que vous y faites |
|------|-------------------|
| **Dashboard** | Voir toute la flotte d'un coup d'œil et passer à la création d'une VM |
| **Active Connections** | Activer ou désactiver des cibles et des scénarios pour cette session |
| **IaaS** | Ouvre Storage, Networking, Virtual Machines et Spot VMs |
| **PaaS** | Ouvre Managed Kubernetes, Kubernetes, Database et Object Storage lorsque ces services sont activés |
| **SaaS** | Ouvre des applications hébergées telles que n8n et OpenClaw |
| **Account** | Ouvre votre profil, les préférences e-mail, l'organisation et la facturation |
| **Connections** | Ouvre Targets et Scenarios. Visible par les administrateurs de l'organisation |
| **Settings** | Ouvre Preferences, AI Assistant, Appearance et Info |

Le pied de page indique qui est connecté et si les daemons locaux sont en bonne santé. **All systems healthy** signifie que l'authentification, le calcul, le stockage, le réseau et les cibles répondent. Si l'un d'eux ne répond pas, les créations et listes qui en dépendent échoueront ou resteront vides — corrigez le daemon avant de déboguer le formulaire.

## Comment une page est organisée

La plupart des pages de ressources partagent une même disposition :

- Les **boutons principaux** en haut démarrent un assistant de création (Create volume, Create Basic VM, etc.).
- Les **jauges** résument les compteurs et la capacité.
- Le **tableau** est l'inventaire. Développez une ligne pour les détails et les actions.
- **Reload** récupère une copie à jour auprès des daemons. Utilisez-le lorsque vous avez modifié quelque chose en dehors de cet écran.

Les assistants de création s'ouvrent par-dessus cette page. La flèche dans le titre de la page vous ramène sans rien créer.

## Dans quelle organisation vous êtes

Les membres, la facturation et la section Connections suivent l'organisation dans laquelle vous êtes connecté. Si vous ne voyez pas Connections ou Organisation, votre rôle ne peut pas gérer l'organisation. Changez d'organisation depuis la zone compte avant de chercher ces pages.

## Un premier parcours raisonnable

1. Vérifiez que le pied de page de la barre latérale indique un état sain.
2. Ouvrez **Active Connections** et vérifiez que les hôtes attendus sont activés. Voir [Active Connections](./03-my-clouds).
3. Si un hôte manque, un administrateur l'ajoute sous [Connections](./04-connections).
4. Créez un disque, un réseau ou une VM depuis IaaS. Commencez par [Comment fonctionne la création](#comment-fonctionne-la-creation).

## Comment fonctionne la création

Presque toutes les ressources que vous ajoutez dans Electros — un volume, un réseau, une machine virtuelle, une base de données — suivent le même rythme. Apprenez-le une fois et le reste du produit vous paraîtra familier.

### L'écran en deux étapes

Vous ne choisissez pas l'hôte en premier. Vous décrivez **ce** que vous voulez, puis vous choisissez **où** cela doit s'exécuter.

1. **Remplissez le formulaire** à gauche. Un panneau **Review** à droite se met à jour au fur et à mesure, pour que vous voyiez le brouillon avant de valider.
2. Appuyez sur **Continue**. L'écran glisse vers **Choose a Host**.
3. Choisissez une carte d'hôte (ou **Automatic Selection** lorsqu'elle est proposée).
4. Appuyez sur **Create** uniquement lorsque vous êtes prêt à provisionner. Ces guides s'arrêtent avant ce bouton.

<div class="zoom-row">

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-continue-restore.png" alt="Boutons Restore Configuration et Continue" />
  <figcaption><strong>Continue</strong> vous amène à la sélection d'hôte. <strong>Restore Configuration</strong> remet le formulaire aux valeurs par défaut.</figcaption>
</figure>

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-host-view-toggle.png" alt="En-tête Choose a Host avec bascule Table et Cards" />
  <figcaption>À l'étape hôte, basculez entre <strong>Cards</strong> et <strong>Table</strong>. Cards est le mode par défaut et est plus simple lorsque vous comparez une poignée de cibles.</figcaption>
</figure>

</div>

### Ce que vous dit une carte d'hôte

Chaque carte est un endroit où Electros peut exécuter la ressource : une machine AtomOS sur votre réseau, un hyperviseur, ou un compte cloud public (Meson).

| Sur la carte | Ce que cela signifie pour vous |
|-------------|------------------------|
| Nom et type | Quelle cible vous allez utiliser, par exemple « AtomOS Lab » ou un fournisseur cloud |
| Adresse | IP d'un hôte local, ou le nom du fournisseur cloud |
| Version | Version Electros/AtomOS, lorsque l'hôte en signale une |
| Prix net | Coût estimé, lorsque le fournisseur peut en fournir un |
| Surbrillance orange | La carte que vous avez sélectionnée |

**Automatic Selection** laisse Electros choisir un hôte éligible pour vous. Utilisez-le lorsque la machine qui exécute la charge de travail n'a pas d'importance. Choisissez une carte précise lorsque vous avez besoin d'un labo, d'un site ou d'un compte cloud particulier.

Si vous êtes connecté en tant qu'**utilisateur local** sur une seule machine AtomOS, Electros ignore la sélection d'hôte et **Continue** devient **Create**.

### Noms

La plupart des champs de nom ont un bouton dé à côté. Cliquez dessus pour remplir un nom aléatoire et valide afin d'avancer rapidement. Vous pouvez toujours saisir le vôtre.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-name.png" alt="Champ VM Name avec le bouton dé de nom aléatoire" />
  <figcaption>Le dé remplit un nom pour vous. Le champ reste vide jusqu'à ce que vous en saisissiez un ou en tiriez un — et un nom vide est rejeté.</figcaption>
</figure>

### Panneau Review

Le panneau à droite est un résumé en direct, pas un second formulaire. Si une valeur y paraît incorrecte, corrigez-la à gauche avant de continuer. Des cases vides signifient que vous n'avez pas encore choisi cette option (par exemple aucun préréglage de système d'exploitation, ou aucun volume).

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-review.png" alt="Panneau Review Configuration affichant CPU, RAM et volumes" />
  <figcaption>Review montre le brouillon : nom, CPU, mémoire, préréglage OS et disques attachés. Le badge en haut est une vue compacte des mêmes chiffres.</figcaption>
</figure>

### Curseurs

Le CPU, la mémoire et la taille de disque utilisent un curseur **et** un nombre. Faites glisser le curseur pour une taille prédéfinie, ou saisissez une valeur exacte lorsque l'écran propose un mode personnalisé. La marque sous la poignée est la taille qui sera créée.

<figure>
  <img src="../../user-guide/assets/zoom-vm-cpu-ram.png" alt="Curseurs des cœurs CPU et de la taille RAM" />
  <figcaption>Le CPU démarre à <strong>2 cores</strong>. La mémoire démarre à <strong>256 MB</strong>. Déplacez la poignée ou modifiez le nombre à droite.</figcaption>
</figure>

### Avant d'appuyer sur Create

- **Create** alloue la ressource sur l'hôte que vous avez choisi. Ces guides ne vous demandent jamais d'appuyer dessus.
- Certains flux cloud et organisation ouvrent une **page de paiement** après une création réussie. Terminez-la uniquement si vous acceptez d'être facturé.
- Laissez les mots de passe, clés API et clés SSH privées hors des captures d'écran et des notes partagées.
- Si un hôte affiche **Update Required**, la cible est joignable mais trop ancienne pour cette action. Mettez à jour l'hôte, ou choisissez-en un autre.

### Où aller ensuite

| Je veux… | Ouvrir |
|------------|------|
| Enregistrer une machine, un cloud ou un hyperviseur | [Connections](./04-connections) |
| Ajouter un disque, une image cloud ou un volume cloud-init | [Storage](./05-iaas-storage) |
| Ajouter un réseau local ou Tailscale | [Networking](./06-iaas-networking) |
| Créer une machine virtuelle | [Machines virtuelles](./07-iaas-virtual-machines) |
| Créer une VM cloud éphémère | [Spot VMs](./08-iaas-ephemeral-vms) |
| Déployer Kubernetes, une base de données ou une application | [PaaS et SaaS](./09-paas-saas) |
| Créer une sous-organisation ou inviter des personnes | [Account](./10-account) |
