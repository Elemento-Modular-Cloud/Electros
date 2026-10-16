# Connections

Connections è dove un admin dell’organizzazione **registra** gli host e li raggruppa in scenari. Attivarli per il lavoro quotidiano avviene su [Active Connections](./03-my-clouds), non qui.

Vedi questa sezione solo se il tuo ruolo può gestire l’organizzazione.

## Targets

![Targets](../../user-guide/assets/04-connections-targets.png)

## A cosa serve questa pagina

Targets è la rubrica. Niente qui accende una VM. Registri le macchine e gli account cloud che Electros può usare, poi li abiliti su Active Connections. Se un host manca da un wizard, non è mai stato aggiunto qui, oppure è stato aggiunto e lasciato disabilitato.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-targets-add.png" alt="Pulsanti Add AtomOS, Add Hypervisor e Add Provider" />
  <figcaption>Tre modi per entrare. <strong>Add AtomOS</strong> è una macchina sulla tua rete. <strong>Add Hypervisor</strong> è Proxmox o ESXi. <strong>Add Provider</strong> è un account Meson public o private cloud.</figcaption>
</figure>

La tabella è ogni cloud target che l’organizzazione conosce. Le colonne sono **Name**, **Type** (AtomOS Local, Meson Public, Meson Private, Proxmox, VMware ESXi) e **IP/Provider**.

I gauge sopra la tabella contano Total, AtomOS, Providers, Hypervisors, Reachable e Offline. Reachable e Offline corrispondono ai punti verdi e rossi sulla dashboard.

**Add** dai pulsanti sulla pagina. I passaggi di ogni wizard sono sotto.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-targets-actions.png" alt="Edit e Usage and Permissions su una riga target" />
  <figcaption><strong>Edit</strong> modifica il nome e l’indirizzo memorizzati. <strong>Usage and Permissions</strong> sceglie chi nell’organizzazione può usare il target. <strong>Delete</strong> è l’azione rossa sulla stessa riga.</figcaption>
</figure>

### Cosa puoi fare su una riga

- **Edit** modifica il nome e l’indirizzo che hai memorizzato. Non ricostruisce l’host.
- **Usage and Permissions** sceglie quali membri dell’organizzazione possono usare questo target. Il target deve esistere prima.
- **Delete** ti chiede di digitare il nome del target. Annulla se volevi solo vedere la finestra. Eliminare un target lo toglie dagli scenari e dai selettori host.

Il primo contatto con un nuovo host AtomOS può mostrare un **certificate fingerprint**. Confrontalo con la macchina che ti aspetti, poi approva o rifiuta. Electros non userà un host non attendibile per le creazioni.

## Registra una connessione

### Aggiungi un host AtomOS

**Dove:** Targets → **Add AtomOS**

![Add AtomOS](../../user-guide/assets/create-add-atomos.png)

1. **Name** — obbligatorio. Qualcosa che riconoscerai negli elenchi host, ad esempio il laboratorio o il sito.
2. **IP address** — obbligatorio. `0.0.0.0` viene rifiutato.
3. **Create** ti riporta all’elenco dei target.

La prima volta che Electros parla con quell’IP può mostrare un **certificate fingerprint**. Confrontalo con l’host che ti aspetti, poi approva o rifiuta. Non approvare un fingerprint che non puoi verificare.

---

### Aggiungi un provider cloud (Meson)

**Dove:** Targets → **Add Provider**

![Scegli le credenziali cloud public o private](../../user-guide/assets/create-add-meson.png)

#### Account Public

Usalo quando l’organizzazione consente già una demo o un account cloud pubblico condiviso.

1. Scegli **Public**.
2. Spunta i provider che vuoi far usare a Electros. Sono elencati solo i provider che consentono l’uso pubblico. Una casella già spuntata significa che quel provider è già collegato.
3. **Conclude** aggiunge quelli che hai spuntato e rimuove quelli che hai deselezionato.

#### Account Private

Usalo per le tue credenziali cloud (bring your own account). Le guide passo passo per ogni provider sono in [Credenziali Meson privato](./private-meson/).

1. Scegli **Private**.
2. Seleziona **un** provider.
3. **Target name** — obbligatorio.
4. Compila il modulo delle credenziali. I campi dipendono dal provider (chiavi API, project ID e così via). Tratta ogni valore come un segreto. Vedi [Google](./private-meson/google), [Azure](./private-meson/azure), [OVH](./private-meson/ovh), [UpCloud](./private-meson/upcloud), [Scaleway](./private-meson/scaleway) o [AWS](./private-meson/aws).
5. **Conclude**.

---

### Aggiungi un hypervisor

**Dove:** Targets → **Add Hypervisor**

![Aggiungi un hypervisor](../../user-guide/assets/create-add-hypervisor.png)

1. Scegli **VMware** (ESXi 6 o 7) o **Proxmox** (VE 7 o 8).
2. **Target name** — obbligatorio.
3. **Host URL** — obbligatorio, e deve iniziare con `http://` o `https://`. Forma di esempio: `https://192.168.0.42:8006`.
4. **Create**.

Qui non digiti la password dell’hypervisor. Electros chiede le credenziali più tardi, quando abiliti il target.

---

### Crea uno scenario

Uno scenario è un insieme nominato di target che puoi attivare insieme da **Active Connections**.

**Dove:** Scenarios → **New Scenario** (la stessa schermata modifica uno scenario esistente)

![Crea uno scenario](../../user-guide/assets/create-scenario.png)

1. **Name** dello scenario.
2. Spunta le card target che vi appartengono. Puoi non selezionarne nessuno, ma uno scenario senza target non serve a nulla. Il **maximum connections** del tuo piano limita quanti puoi abilitare insieme — il box informativo sul modulo indica il limite.
3. **Create** (o **Update** se hai aperto uno scenario esistente).

Per usarlo, vai su Active Connections e attiva lo scenario. I target richiesti dallo scenario attivo non possono essere spenti singolarmente finché non cambi scenario.


## Scenarios

![Scenarios](../../user-guide/assets/04-connections-scenarios.png)

Uno scenario è una checklist di target che vuoi abilitare insieme (“Lab Stack”, “Public Cloud Demo”). Le colonne della tabella sono **Name** e **Granted to**. I gauge contano Scenarios, Targets, Shared, Unused, Grants e Members.

| Azione | Cosa succede |
|--------|----------------|
| **New Scenario** | Apre il modulo di creazione. I passaggi sono sotto [Crea uno scenario](#crea-uno-scenario) |
| **Edit** su una riga | Stesso modulo, con nome e spunte già compilati |
| **Usage and Permissions** | Chi può usare questo scenario |
| **Delete** | Ti chiede di digitare il nome dello scenario. Annulla per tenerlo |

Dopo aver salvato uno scenario, vai su Active Connections e attivalo. Finché non lo fai, i target al suo interno restano card di riserva.
