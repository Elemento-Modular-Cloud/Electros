# PaaS et SaaS

Ces pages sont des services gérés, pas des machines virtuelles que vous assemblez vous-même. La barre latérale les remplit à partir des services que votre organisation est autorisée à déployer. Dans une installation typique vous verrez :

| Barre latérale | Ce que vous regardez |
|---------|-------------------|
| PaaS → Managed Kubernetes | Un plan de contrôle Kubernetes hébergé |
| PaaS → Kubernetes | Kubernetes où vous fournissez le bucket d'état |
| PaaS → Database | Redis, MySQL, SQL Server ou Postgres |
| PaaS → Object Storage | Buckets |
| SaaS → n8n | Une VM d'application n8n |
| SaaS → OpenClaw | Une VM d'application OpenClaw |

Vous venez ici après que le service existe. Create est la façon d'en commander un. Le tableau indique s'il tourne, où il a été placé, et comment y accéder. **Credentials** est l'action de ligne importante sur les bases de données et Kubernetes : c'est le mot de passe ou le kubeconfig, et c'est un secret. **Delete** supprime l'instance. Confirmez uniquement lorsque vous le voulez vraiment.

## Ce que chaque page de service a en commun

![Bases de données](../../user-guide/assets/09-paas-dbaas.png)

![Managed Kubernetes](../../user-guide/assets/09-paas-managedkubernetes.png)

![n8n](../../user-guide/assets/09-saas-n8n.png)

Chacune de ces pages partage le même habillage :

- Un bouton **Create** sous le titre. Il ouvre un formulaire, puis un sélecteur d'hôte. La région et le prix viennent de l'hôte que vous sélectionnez.
- Six jauges : **Total**, **Running**, **Stopped**, **Errors**, **Pending** et **Other**.
- **Reload**.
- Avec le plan **Pro**, un chip **Vendor** dans la barre d'outils (et à côté de la colonne provider) affiche l'état Hypermonitor de ce produit sur les clouds utilisés. Le **Status** d'instance dans le tableau reste celui de la ressource (running, stopped, provisioning).
- Un tableau. **Delete** est toujours dans Actions et demande une confirmation.

Ce qui change, ce sont les colonnes et l'action supplémentaire.

**Database.** Les colonnes sont Name, UUID, Engine (Postgres, MySQL, SQL Server, Redis), Backup time, Disk size, Nodes number, Provider, Region et Actions. Outre Delete, vous obtenez **Credentials**. Cette boîte de dialogue affiche le secret de connexion. Ne le collez pas dans un ticket.

**Managed Kubernetes.** Les colonnes sont Name, UUID, Status (Planned, Provisioning, Error, etc.), Version, Network CIDR, Provider, Region et Actions. **Credentials** est le secret de style kubeconfig pour ce cluster.

**n8n et OpenClaw.** Les colonnes sont Name, UUID, Status, Provider, Region et Actions. Un tableau vide avec toutes les jauges à zéro signifie que vous n'en avez pas encore déployé.

Kubernetes (celui où vous apportez le bucket d'état) et Object Storage utilisent la même forme de page, avec des colonnes qui correspondent à ce que vous avez rempli à la création.

## En créer un

Les écrans de création PaaS et SaaS partagent un même flux ([Comment fonctionne la création](./01-getting-started#comment-fonctionne-la-creation)). Les champs changent avec le service ; les étapes non.

1. Remplissez le formulaire. Les champs obligatoires sont marqués par le formulaire ; un champ mot de passe est toujours un secret.
2. Appuyez sur **Continue**. **Create** reste désactivé jusqu'à ce qu'un hôte soit sélectionné et qu'Electros puisse tarifer l'allocation.
3. Choisissez un hôte. La région vient de cet hôte — vous ne choisissez pas de région dans le formulaire.
4. Arrêtez-vous avant **Create**. Une création réussie peut ouvrir une **page de paiement**.

**Restore Configuration** demande une confirmation, puis efface le formulaire.

![Formulaire de création de base de données](../../user-guide/assets/create-dbaas-form.png)

![Étape hôte pour un service](../../user-guide/assets/create-dbaas-host.png)

---

### Database

**Où :** PaaS → Database → Create

| Ce que vous définissez | Conseils |
|--------------|----------|
| Name | Un nom que vous reconnaîtrez dans la liste |
| Engine | Démarre à **Postgres**. Aussi Redis, MySQL ou SQL Server |
| Backup time | Quand les sauvegardes doivent s'exécuter |
| Disk | Démarre à **50 GB** |
| Password | Secret. Remplacez toute valeur d'exemple avant de créer |
| Nodes | Démarre à **1** |
| Billing | Démarre à **monthly**. Aussi daily, weekly ou yearly |

---

### n8n et OpenClaw

**Où :** SaaS → n8n → Create (OpenClaw est le même type de formulaire)

![Formulaire de création n8n](../../user-guide/assets/create-n8n-form.png)

Vous décrivez une petite VM qui exécute l'application :

| Ce que vous définissez | Départ typique |
|--------------|----------------|
| VM name | Vous choisissez |
| CPU | 2 cœurs pour n8n, 4 pour OpenClaw |
| RAM | 4 GB |
| Username | `admin` |
| Password | Secret — définissez le vôtre |
| SSH key | Clé publique, optionnelle |
| Billing | Monthly |

---

### Managed Kubernetes

**Où :** PaaS → Managed Kubernetes → Create

| Ce que vous définissez | Départ typique |
|--------------|----------------|
| Cluster name | `my-cluster` jusqu'à ce que vous le changiez |
| Node pools | Choisissez dans la liste |
| DHCP | On |
| Network range | `192.170.5.0/24` jusqu'à ce que vous le changiez |
| Updates | Always update, ou manual |
| Kubernetes version | La plus récente proposée (par exemple 1.34) |
| Control-plane HA | Off jusqu'à ce que vous en ayez besoin |
| Billing | Monthly |

---

### Kubernetes (vous apportez le magasin d'état)

**Où :** PaaS → Kubernetes → Create

Cette variante attend un bucket compatible S3 pour l'état du cluster.

| Ce que vous définissez | Conseils |
|--------------|----------|
| Cluster name | Vous choisissez |
| S3 endpoint, bucket, access key | Depuis votre magasin d'objets |
| Secret access key | Secret |
| Node count | Démarre à **3** |
| Node and control-plane disk | Démarrent à **64 GB** chacun |
| Network CIDR | La plage pod/service souhaitée |
| SSH public key | Pour pouvoir atteindre les nœuds |

---

### Object storage

**Où :** PaaS → Object Storage → Create

| Ce que vous définissez | Départ typique |
|--------------|----------------|
| Bucket name | Vous choisissez ; il doit être unique pour ce fournisseur |
| Size | **1 TB** |
| Billing | Monthly |

La région est celle de l'hôte que vous sélectionnez à l'étape suivante.

**Create** à la fin de ces assistants peut ouvrir une page de paiement. Les mots de passe et clés secrètes cloud restent uniquement dans le formulaire — ne les copiez pas dans des notes.

Si le groupe de la barre latérale est vide, aucun intent de service n'a été chargé. C'est un problème de daemon ou de catalogue, pas un clic manquant.
