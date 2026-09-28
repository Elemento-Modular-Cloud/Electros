# PaaS e SaaS

Queste pagine sono servizi gestiti, non macchine virtuali che dovete assemblare voi. La barra laterale le riempie dai servizi che l’organizzazione può distribuire. In un’installazione tipica vedrai:

| Barra laterale | Cosa stai guardando |
|----------------|---------------------|
| PaaS → Managed Kubernetes | Un control plane Kubernetes ospitato |
| PaaS → Kubernetes | Kubernetes in cui fornisci tu il bucket di stato |
| PaaS → Database | Redis, MySQL, SQL Server o Postgres |
| PaaS → Object Storage | Bucket |
| SaaS → n8n | Una VM app n8n |
| SaaS → OpenClaw | Una VM app OpenClaw |

Vieni qui dopo che il servizio esiste. Create è come ne ordini uno. La tabella è come vedi se è in esecuzione, dove è stato collocato e come entri. **Credentials** è l’azione di riga importante su database e Kubernetes: è la password o il kubeconfig, ed è un segreto. **Delete** rimuove l’istanza. Conferma solo quando lo intendi.

## Cosa ha in comune ogni pagina di servizio

![Databases](../../user-guide/assets/09-paas-dbaas.png)

![Managed Kubernetes](../../user-guide/assets/09-paas-managedkubernetes.png)

![n8n](../../user-guide/assets/09-saas-n8n.png)

Ognuna di queste pagine condivide lo stesso chrome:

- Un pulsante **Create** sotto il titolo. Apre un modulo, poi un selettore host. Region e prezzo arrivano dall’host che selezioni.
- Sei gauge: **Total**, **Running**, **Stopped**, **Errors**, **Pending** e **Other**.
- **Reload**.
- Una tabella. **Delete** è sempre in Actions e ti chiede di confermare.

Ciò che cambia sono le colonne e l’azione extra.

**Database.** Le colonne sono Name, UUID, Engine (Postgres, MySQL, SQL Server, Redis), Backup time, Disk size, Nodes number, Provider, Region e Actions. Oltre a Delete hai **Credentials**. Quella finestra mostra il segreto di connessione. Non incollarlo in un ticket.

**Managed Kubernetes.** Le colonne sono Name, UUID, Status (Planned, Provisioning, Error e così via), Version, Network CIDR, Provider, Region e Actions. **Credentials** è il segreto in stile kubeconfig per quel cluster.

**n8n e OpenClaw.** Le colonne sono Name, UUID, Status, Provider, Region e Actions. Una tabella vuota con ogni gauge a zero significa che non ne hai ancora distribuito uno.

Kubernetes (quello in cui porti tu il bucket di stato) e Object Storage usano la stessa forma di pagina, con colonne che corrispondono a ciò che hai compilato in creazione.

## Crearne uno

Le schermate di creazione PaaS e SaaS condividono un flusso ([Come funziona la creazione](./01-getting-started#come-funziona-la-creazione)). I campi cambiano con il servizio; i passaggi no.

1. Compila il modulo. I campi obbligatori sono marcati dal modulo; un campo password è sempre un segreto.
2. Premi **Continue**. **Create** resta disabilitato finché non è selezionato un host e Electros può quotare l’allocazione.
3. Scegli un host. La region arriva da quell’host — non scegli una region nel modulo.
4. Fermati prima di **Create**. Una creazione riuscita può aprire una **payment page**.

**Restore Configuration** ti chiede di confermare, poi azzera il modulo.

![Modulo di creazione Database](../../user-guide/assets/create-dbaas-form.png)

![Passaggio host per un servizio](../../user-guide/assets/create-dbaas-host.png)

---

### Database

**Dove:** PaaS → Database → Create

| Cosa imposti | Guida |
|--------------|-------|
| Name | Un nome che riconoscerai nell’elenco |
| Engine | Parte da **Postgres**. Anche Redis, MySQL o SQL Server |
| Backup time | Quando devono girare i backup |
| Disk | Parte da **50 GB** |
| Password | Segreto. Sostituisci qualsiasi valore di esempio prima di creare |
| Nodes | Parte da **1** |
| Billing | Parte da **monthly**. Anche daily, weekly o yearly |

---

### n8n e OpenClaw

**Dove:** SaaS → n8n → Create (OpenClaw è lo stesso tipo di modulo)

![Modulo di creazione n8n](../../user-guide/assets/create-n8n-form.png)

Stai descrivendo una piccola VM che esegue l’app:

| Cosa imposti | Avvio tipico |
|--------------|--------------|
| VM name | Lo scegli tu |
| CPU | 2 core per n8n, 4 per OpenClaw |
| RAM | 4 GB |
| Username | `admin` |
| Password | Segreto — impostane una tua |
| SSH key | Chiave pubblica, opzionale |
| Billing | Monthly |

---

### Managed Kubernetes

**Dove:** PaaS → Managed Kubernetes → Create

| Cosa imposti | Avvio tipico |
|--------------|--------------|
| Cluster name | `my-cluster` finché non lo cambi |
| Node pools | Scegli dall’elenco |
| DHCP | On |
| Network range | `192.170.5.0/24` finché non lo cambi |
| Updates | Always update, oppure manual |
| Kubernetes version | La più recente offerta (ad esempio 1.34) |
| Control-plane HA | Off finché non ti serve |
| Billing | Monthly |

---

### Kubernetes (porti tu lo state store)

**Dove:** PaaS → Kubernetes → Create

Questa variante si aspetta un bucket compatibile S3 per lo stato del cluster.

| Cosa imposti | Guida |
|--------------|-------|
| Cluster name | Lo scegli tu |
| S3 endpoint, bucket, access key | Dal tuo object store |
| Secret access key | Segreto |
| Node count | Parte da **3** |
| Node e control-plane disk | Partono da **64 GB** ciascuno |
| Network CIDR | L’intervallo pod/service che vuoi |
| SSH public key | Così puoi raggiungere i nodi |

---

### Object storage

**Dove:** PaaS → Object Storage → Create

| Cosa imposti | Avvio tipico |
|--------------|--------------|
| Bucket name | Lo scegli tu; deve essere unico per quel provider |
| Size | **1 TB** |
| Billing | Monthly |

La region è qualunque host selezioni nel passaggio successivo.

**Create** alla fine di quei wizard può aprire una payment page. Password e chiavi segrete cloud restano solo nel modulo — non copiarle nelle note.

Se il gruppo della barra laterale è vuoto, non sono stati caricati service intents. È un problema di daemon o di catalogo, non un click mancato.
