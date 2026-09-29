# Machines virtuelles

Voici la liste des VM durables et des modèles à partir desquels vous pouvez en créer de nouvelles.

![Machines virtuelles](../../user-guide/assets/07-iaas-virtual-machines.png)

## À quoi sert cette page

Voici l'inventaire des invités que vous comptez conserver : machines de labo, serveurs, modèles dont vous tirez des copies. Alimentation, console, disques et suppression partent tous de la ligne. Créer un nouvel invité part des trois boutons sous le titre ; les étapes sont dans [Créer une VM](#creer-une-vm) ci-dessous.

## Lire la page

Les jauges comptent **Total VMs**, **Blueprints**, **Slots**, **Memory**, **Volumes** et **GPUs**.

Les colonnes du tableau sont **Name**, **OS Type**, **Hypervisor**, **CPU**, **RAM Size**, **PCI Devices**, **Volumes**, **IP Address** et **Actions**. Une pastille verte dans Hypervisor est le type d'hôte (Proxmox, ESXi, etc.). Un tiret signifie qu'Electros n'a pas d'étiquette d'hyperviseur pour cette ligne.

**Table** est la liste compacte. **Advanced** ouvre la ligne en cartes. **Reload** actualise l'état d'alimentation depuis les hôtes. **Table** et **Cards** à droite basculent la disposition.

## Créer une VM

| Bouton | Quand l'utiliser |
|--------|----------------|
| **Create Basic VM** | Nom, préréglage OS, CPU, mémoire, disques optionnels |
| **Create Advanced VM** | Vous avez aussi besoin de réseaux, PCI, HA, EFI ou drapeaux CPU |
| **Create VM from Blueprint** | Votre organisation a déjà défini des tailles |

Le préréglage OS n'installe pas l'invité. Attachez un volume ou une ISO bootable si la machine a encore besoin d'un installateur. Les trois suivent le [modèle de création partagé](./01-getting-started#comment-fonctionne-la-creation).

### VM de base

**Où :** Virtual Machines → **Create Basic VM**

![Le formulaire de VM de base, avec le panneau de revue à droite](../../user-guide/assets/create-vm-basic-form.png)

### 1. Nommer la machine

Saisissez un nom, ou appuyez sur le dé pour en générer un. Vous ne pouvez pas continuer avec le nom laissé vide.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-name.png" alt="Champ VM Name et bouton dé" />
  <figcaption>Le nom est obligatoire. Le dé est optionnel et ne remplit que le champ — il ne crée pas la VM.</figcaption>
</figure>

### 2. Choisir un préréglage de système d'exploitation

Choisissez une **OS Family** (par exemple Linux), puis une **OS Flavour** (par exemple Ubuntu). Les deux sont obligatoires. « Select an OS » est l'état vide, pas un choix valide.

### 3. Définir le CPU et la mémoire

Faites glisser les curseurs ou saisissez un nombre. Les nouvelles VM démarrent à **2 CPU cores** et **256 MB** de RAM. Les cœurs peuvent monter jusqu'à 256 ; la mémoire jusqu'à 8 TB. Le nombre à droite de chaque curseur est la valeur qui sera enregistrée.

<figure>
  <img src="../../user-guide/assets/zoom-vm-cpu-ram.png" alt="Curseurs CPU et RAM avec les valeurs par défaut" />
  <figcaption>Gauche : cœurs, défaut 2. À droite de chaque ligne : la valeur exacte. La mémoire démarre à 256 MB.</figcaption>
</figure>

### 4. Attacher des disques (optionnel)

Le tableau des volumes démarre vide. **Add Volume** vous permet de choisir des disques qui existent déjà sur l'hôte que vous choisirez. Faites glisser les lignes pour définir l'ordre d'amorçage : le haut de la liste démarre en premier. Une courte note sur le formulaire indique que la priorité 0 est la plus élevée.

Si vous n'avez pas encore créé de volume, terminez cet assistant sans disques, ou créez d'abord le volume sous [Storage](./05-iaas-storage) et revenez.

### 5. Vérifier la revue

Le panneau à droite doit correspondre à ce que vous voulez : nom, **2** cœurs sauf si vous l'avez changé, **256 MB** sauf si vous l'avez changé, le préréglage OS, et la liste des volumes. Des tuiles vides signifient que cette partie n'est pas encore définie.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-review.png" alt="Revue de configuration pour une VM de base" />
  <figcaption>Lisez ceci avant Continue. « No volumes added » est normal si vous avez sauté les disques.</figcaption>
</figure>

### 6. Continue, puis choisir un hôte

**Restore Configuration** abandonne vos modifications. **Continue** ne crée rien — il ouvre la sélection d'hôte.

<div class="zoom-row">

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-continue-restore.png" alt="Restore Configuration au-dessus de Continue" />
  <figcaption>Appuyez sur le bouton orange <strong>Continue</strong>.</figcaption>
</figure>

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-host-view-toggle.png" alt="Choose a Host avec Cards sélectionné" />
  <figcaption>Restez sur <strong>Cards</strong> sauf si vous préférez un tableau.</figcaption>
</figure>

</div>

![Cartes d'hôte pour une VM de base](../../user-guide/assets/create-vm-basic-host.png)

- **Automatic Selection** — Electros choisit un hôte éligible.
- Une carte nommée — vous choisissez le labo, la box edge ou le compte cloud.

La carte sélectionnée passe à l'orange. Arrêtez-vous ici si vous apprenez seulement l'écran. **Create** est ce qui démarre réellement la VM.

Les détails de connexion (nom d'utilisateur, mot de passe, clé SSH) n'apparaissent que lorsque le mode Experimental est activé. Ne mettez pas de clé privée dans une capture d'écran partagée ; une clé publique suffit pour l'invité.

La création de base demande toujours une machine **x86_64**.

---

### VM avancée

**Où :** Virtual Machines → **Create Advanced VM**

![Formulaire de VM avancée](../../user-guide/assets/create-vm-advanced-form.png)

Commencez comme pour une VM de base : nom, OS, CPU, mémoire, volumes, revue, hôte. Les sections supplémentaires sont optionnelles. Laissez-les tranquilles sauf si vous en avez besoin.

| Section | Quoi définir | Laissez tel quel lorsque |
|---------|-------------|---------------------|
| Start on host boot | Activez si la VM doit démarrer à chaque démarrage de l'hôte | Vous la démarrerez vous-même |
| High availability | Activez HA, puis définissez une priorité de 0 à 100 | Vous n'avez pas besoin de basculement |
| EFI boot | Activé pour les invités qui exigent UEFI. Certaines variantes OS le verrouillent pour vous | Le préréglage correspond déjà à l'invité |
| Intel TDX | VM confidentielle. La console série, le graphique, la politique et le chemin quote-socket restent désactivés tant que TDX n'est pas activé | Vous n'utilisez pas de matériel TDX |
| CPU flags | Fonctionnalités CPU supplémentaires. SSE2 démarre coché. La fréquence minimale démarre à **1.5 GHz**. Le surprovisionnement démarre à **10** | Le CPU par défaut de l'hôte convient |
| Architecture | Choisissez l'architecture CPU dont l'invité a besoin | x86_64 est déjà correct |
| SMT | Autoriser le multithreading simultané | Vous voulez un thread par cœur |
| ECC memory | Exiger de la RAM à correction d'erreurs. Certains préréglages OS le verrouillent | Toute mémoire est acceptable |
| Networks | **Add Network**, puis choisissez le réseau, le pilote (auto si vous n'êtes pas sûr), la MAC (vide = auto), et les tags VLAN si vous en utilisez | La VM n'a pas encore besoin de NIC |
| PCI | **Add PCI Device** avec fournisseur, périphérique et quantité. « Attach full PCI lane » est un interrupteur séparé | Vous ne passez pas de matériel en transparence |

Puis **Continue**, choisissez un hôte, et arrêtez-vous avant **Create** — comme pour l'assistant de base.

---

### VM à partir d'un blueprint

**Où :** Virtual Machines → **Create VM from Blueprint**

![Formulaire de VM modèle](../../user-guide/assets/create-vm-template-form.png)

1. Nommez la VM.
2. Choisissez la famille et la variante OS.
3. Sélectionnez une **carte de modèle**. Chaque carte indique combien d'emplacements CPU, combien de mémoire, et si l'ECC est requis. Vous devez en choisir une.
4. Ajoutez éventuellement des volumes.
5. Lisez la revue (nom, CPU, mémoire, OS, blueprint, volumes).
6. **Continue**, choisissez un hôte, arrêtez-vous avant **Create**.

Utilisez ceci lorsque votre organisation a déjà convenu de tailles (« small », « gpu », etc.) et que vous ne voulez pas définir cœurs et RAM à la main.

---

### Modifier une VM existante

Ouvrir la modification depuis une VM affiche actuellement un court avis de mise à jour en direct. Le formulaire n'est pas encore terminé, donc il n'y a rien à remplir. Changez le CPU, les disques et les réseaux depuis les actions de ligne de la VM dans la liste à la place.

## Sur la ligne

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-row-actions.png" alt="VNC, Power et Delete sur chaque ligne de machine virtuelle" />
  <figcaption>Chaque ligne se termine de la même façon. <strong>VNC</strong> ouvre la console graphique. <strong>Power</strong> démarre ou arrête l'invité. <strong>Delete</strong> demande de saisir le nom. <strong>Table</strong> et <strong>Cards</strong> ne changent que la disposition.</figcaption>
</figure>

| Bouton | Ce qu'il fait |
|--------|----------------|
| **VNC** | Ouvre la console graphique. L'invité doit être en cours d'exécution |
| **Power** | Démarre une VM arrêtée ou éteint une VM en cours. Arrêtée n'est pas supprimée |
| **Delete** | Demande de saisir le nom de la VM. Annulez pour la conserver |

## Lorsque vous développez une ligne

Passez en **Advanced**, ou ouvrez la ligne, pour les cartes de détail.

**VM Details** affiche le nom, l'UUID, l'hôte, le système d'exploitation, le statut, le temps de fonctionnement, la date de création, et si la haute disponibilité est activée. À partir de là :

| Bouton | Quand vous le voyez | Ce qu'il fait |
|--------|-----------------|--------------|
| **Boot** ou **Shut Down** | Toujours | Changement d'alimentation propre |
| **Reboot** | Toujours | Redémarre l'invité |
| **Force Off** | Toujours | Coupe l'alimentation. Utilisez-le lorsque Shut Down ne revient pas |
| **Migrate** | La VM est sur AtomOS | La déplace vers un autre hôte |
| **Backups** | La VM est sur AtomOS | Lister, prendre ou supprimer une sauvegarde |
| **Attach QEMU Agent** | L'agent invité manque | Attache l'agent pour qu'Electros puisse lire les détails de l'invité |
| **Clone to AtomOS** | La VM n'est pas sur AtomOS | La copie sur un hôte AtomOS |

**Remote Viewer** intègre la console VNC dans la ligne.

**Attached Resources** liste les volumes, périphériques PCI et réseaux. Sur un hôte AtomOS vous obtenez aussi les redirections de ports et les tunnels de ports, chacun avec un bouton plus pour en attacher un autre. Une VM qui n'est pas sur AtomOS n'offre pas ces actions de ports.
