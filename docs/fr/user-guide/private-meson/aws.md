# AWS (Meson privé)

Préparez un compte AWS pour qu’Electros puisse créer des ressources avec vos identifiants. Identifiant fournisseur : **`aws`**. Comptez environ **30 minutes**. Un compte avec des permissions administratives est requis.

## Ce dont Electros a besoin

| Valeur | Où | Obligatoire |
|--------|-----|-------------|
| `AWS_ACCESS_KEY_ID` | Étape 4 | Oui |
| `AWS_SECRET_ACCESS_KEY` | Étape 4 | Oui |
| `AWS_SESSION_TOKEN` | Étape 4, identifiants temporaires uniquement | Non |
| `AWS_ACCOUNT_ID` | Étape 1 | Oui |
| `PROVIDER_REGION` | Étape 2, votre région principale | Oui |

Saisissez ces valeurs uniquement dans Electros. Ne les envoyez pas par e-mail ou chat.

## 1. Compte et région

**Notez l’ID de compte**

```bash
aws sts get-caller-identity --query Account --output text
```

Dans la console, il se trouve dans le menu du compte en haut à droite.

![ID de compte AWS dans la console](../../../user-guide/assets/private-meson-aws-1-account.png)

**Régions utilisées par Elemento**

`us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-central-2`, `eu-west-1`, `eu-west-2`, `eu-west-3`, `eu-south-1`, `eu-north-1`, `ap-south-1`, `ap-northeast-1`, `ap-northeast-2`, `ap-southeast-1`, `ap-southeast-2`

Les machines virtuelles sont disponibles dans un sous-ensemble : `eu-central-1`, `eu-central-2`, `eu-south-1`, `us-east-1`, `ca-central-1`, `ap-northeast-1`.

**Activez les régions opt-in nécessaires**

Parmi celles qu’Elemento utilise, `eu-central-2` (Zurich) et `eu-south-1` (Milan) peuvent être désactivées par défaut.

```bash
aws account get-region-opt-status --region-name eu-south-1
aws account enable-region --region-name eu-south-1
```

Dans la console : **Account** → **AWS Regions** → **Enable**. L’activation peut prendre jusqu’à quelques heures.

## 2. Vérifier le VPC par défaut

Les services créent des ressources dans le VPC par défaut de la région. S’il manque, la création échoue avec une erreur de sous-réseau peu claire.

Vérifiez chaque région que vous comptez utiliser :

```bash
aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --region eu-central-1 --query 'Vpcs[0].VpcId' --output text
```

S’il renvoie `None`, recréez-le :

```bash
aws ec2 create-default-vpc --region eu-central-1
```

## 3. Créer l’utilisateur et attribuer les permissions

1. Console → **IAM** → **Users** → **Create user**.
2. Nom : `elemento-meson`. N’activez **pas** l’accès à la console.
3. Console → **IAM** → **Policies** → **Create policy** → onglet **JSON**.
4. Collez le contenu des fichiers JSON de politique fournis par Elemento, **une politique par fichier**.
5. Revenez à l’utilisateur → **Add permissions** → attachez toutes les politiques créées.

AWS limite chaque politique à 6144 caractères, d’où plusieurs fichiers. Ceux dont vous avez besoin dépendent des services utilisés :

| Fichier | Nécessaire pour |
|---------|-----------------|
| `elemento-service.json` | Stockage objet, base de données, stockage de fichiers, réseau privé, registry, IP publiques, load balancer, Kubernetes, gateway |
| `elemento-storage.json` | Disques de stockage en bloc |
| `elemento-compute.json` | Machines virtuelles |
| `elemento-dbaasendpoint.json` | Bases MongoDB ou Redis avec endpoint public |

Demandez à votre interlocuteur Elemento les fichiers JSON de politique actuels si vous ne les avez pas déjà.

## 4. Générer les identifiants

**Option A — clés permanentes**

Utilisateur `elemento-meson` → **Security credentials** → **Create access key** → **Application running outside AWS**.

`AWS_SECRET_ACCESS_KEY` n’est affiché qu’une fois. Enregistrez-le immédiatement.

**Option B — identifiants temporaires (recommandé)**

```bash
aws sts get-session-token --duration-seconds 129600
```

Les identifiants temporaires incluent `AWS_SESSION_TOKEN` et durent au maximum **36 heures**. À l’expiration, les opérations s’arrêtent jusqu’à ce que vous saisissiez de nouveaux identifiants dans Electros. Sans processus de renouvellement, utilisez l’option A.

## 5. Vérifier les quotas

Les limites par défaut d’un nouveau compte sont basses. Dans **Service Quotas**, vérifiez (et demandez des augmentations si besoin) pour chaque région que vous utiliserez :

| Quota | Par défaut | Nécessaire si vous utilisez |
|-------|------------|-----------------------------|
| Elastic IP par région | 5 | IP publiques, NAT gateway, endpoints de base de données |
| VPC par région | 5 | Réseaux privés, Kubernetes |
| Network Load Balancers par région | 50 | Load balancers, bases publiques |
| vCPU on-demand par région | variable | Machines virtuelles, Kubernetes |

## Ce qui change dans votre compte

Lors de la première création d’une machine virtuelle, Elemento active le **chiffrement EBS** par défaut pour cette région. C’est un réglage au niveau du compte : tous les disques créés ensuite dans cette région sont chiffrés, y compris ceux non gérés par Elemento.

Les ressources sont facturées par AWS directement à vous. Elemento n’applique aucun plafond d’usage. Utilisez un AWS Budget avec notifications si vous voulez une protection.

Chaque ressource créée par Elemento porte le tag `elemento:managed` (nom du service) et un tag `service_uuid` — utiles dans Cost Explorer.

## Liste de contrôle

- [ ] ID de compte noté
- [ ] Régions opt-in activées et actives
- [ ] VPC par défaut présent dans chaque région utilisée
- [ ] Utilisateur `elemento-meson` créé, sans accès console
- [ ] Toutes les politiques nécessaires attachées
- [ ] Clé d’accès générée et stockée
- [ ] Quotas vérifiés dans les régions utilisées

## Terminer dans Electros

1. **Connections** → **Add Provider** → **Private** → **AWS**.
2. Saisissez les valeurs du premier tableau.
3. **Conclude**, puis activez la cible dans **Active Connections**.
