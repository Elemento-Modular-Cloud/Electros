# AWS (Meson privato)

Prepara un account AWS così Electros può creare risorse con le tue credenziali. Id provider: **`aws`**. Conta circa **30 minuti**. Serve un account con permessi amministrativi.

## Cosa serve a Electros

| Valore | Dove | Obbligatorio |
|--------|------|--------------|
| `AWS_ACCESS_KEY_ID` | Passo 4 | Sì |
| `AWS_SECRET_ACCESS_KEY` | Passo 4 | Sì |
| `AWS_SESSION_TOKEN` | Passo 4, solo credenziali temporanee | No |
| `AWS_ACCOUNT_ID` | Passo 1 | Sì |
| `PROVIDER_REGION` | Passo 2, regione primaria | Sì |

Inserisci questi valori solo in Electros. Non inviarli via email o chat.

## 1. Account e regione

**Annota l’account ID**

```bash
aws sts get-caller-identity --query Account --output text
```

Nella console è nel menu account in alto a destra.

![Account ID AWS nella console](../../../user-guide/assets/private-meson-aws-1-account.png)

**Regioni usate da Elemento**

`us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-central-2`, `eu-west-1`, `eu-west-2`, `eu-west-3`, `eu-south-1`, `eu-north-1`, `ap-south-1`, `ap-northeast-1`, `ap-northeast-2`, `ap-southeast-1`, `ap-southeast-2`

Le macchine virtuali sono disponibili in un sottoinsieme: `eu-central-1`, `eu-central-2`, `eu-south-1`, `us-east-1`, `ca-central-1`, `ap-northeast-1`.

**Abilita le regioni opt-in necessarie**

Tra quelle usate da Elemento, `eu-central-2` (Zurigo) e `eu-south-1` (Milano) possono essere disabilitate di default.

```bash
aws account get-region-opt-status --region-name eu-south-1
aws account enable-region --region-name eu-south-1
```

Nella console: **Account** → **AWS Regions** → **Enable**. L’attivazione può richiedere alcune ore.

## 2. Controlla il VPC di default

I servizi creano risorse nel VPC di default della regione. Se manca, la creazione fallisce con un errore di subnet poco chiaro.

Controlla ogni regione che intendi usare:

```bash
aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --region eu-central-1 --query 'Vpcs[0].VpcId' --output text
```

Se restituisce `None`, ricrealo:

```bash
aws ec2 create-default-vpc --region eu-central-1
```

## 3. Crea l’utente e assegna i permessi

1. Console → **IAM** → **Users** → **Create user**.
2. Nome: `elemento-meson`. **Non** abilitare l’accesso alla console.
3. Console → **IAM** → **Policies** → **Create policy** → scheda **JSON**.
4. Incolla il contenuto dei file JSON delle policy forniti da Elemento, **una policy per file**.
5. Torna all’utente → **Add permissions** → allega tutte le policy create.

AWS limita ogni policy a 6144 caratteri, quindi i file sono più di uno. Quelli necessari dipendono dai servizi che usi:

| File | Serve per |
|------|-----------|
| `elemento-service.json` | Object storage, database, file storage, rete privata, registry, IP pubblici, load balancer, Kubernetes, gateway |
| `elemento-storage.json` | Dischi block storage |
| `elemento-compute.json` | Macchine virtuali |
| `elemento-dbaasendpoint.json` | Database MongoDB o Redis con endpoint pubblico |

Chiedi al referente Elemento i file JSON delle policy se non li hai già.

## 4. Genera le credenziali

**Opzione A — chiavi permanenti**

Utente `elemento-meson` → **Security credentials** → **Create access key** → **Application running outside AWS**.

`AWS_SECRET_ACCESS_KEY` viene mostrato una sola volta. Salvalo subito.

**Opzione B — credenziali temporanee (consigliata)**

```bash
aws sts get-session-token --duration-seconds 129600
```

Le credenziali temporanee includono `AWS_SESSION_TOKEN` e durano al massimo **36 ore**. Alla scadenza le operazioni si fermano finché non inserisci nuove credenziali in Electros. Se non hai un processo di rinnovo, usa l’opzione A.

## 5. Controlla le quote

I limiti di default su un account nuovo sono bassi. In **Service Quotas**, verifica (e richiedi aumenti se serve) per ogni regione che userai:

| Quota | Default | Serve se usi |
|-------|---------|--------------|
| Elastic IP per regione | 5 | IP pubblici, NAT gateway, endpoint database |
| VPC per regione | 5 | Reti private, Kubernetes |
| Network Load Balancer per regione | 50 | Load balancer, database pubblici |
| vCPU on-demand per regione | varia | Macchine virtuali, Kubernetes |

## Cosa cambia nel tuo account

Alla prima creazione di una macchina virtuale, Elemento abilita la **cifratura EBS** di default per quella regione. È un’impostazione a livello account: da quel momento tutti i dischi creati in quella regione sono cifrati, anche quelli non gestiti da Elemento.

Le risorse sono fatturate da AWS direttamente a te. Elemento non applica un tetto di utilizzo. Usa un AWS Budget con notifiche se vuoi protezione.

Ogni risorsa creata da Elemento porta il tag `elemento:managed` (nome del servizio) e un tag `service_uuid` — utili in Cost Explorer.

## Checklist

- [ ] Account ID annotato
- [ ] Regioni opt-in abilitate e attive
- [ ] VPC di default presente in ogni regione che userai
- [ ] Utente `elemento-meson` creato, senza accesso console
- [ ] Tutte le policy necessarie allegate
- [ ] Access key generata e conservata
- [ ] Quote verificate nelle regioni che userai

## Completa in Electros

1. **Connections** → **Add Provider** → **Private** → **AWS**.
2. Inserisci i valori della prima tabella.
3. **Conclude**, poi abilita il target in **Active Connections**.
