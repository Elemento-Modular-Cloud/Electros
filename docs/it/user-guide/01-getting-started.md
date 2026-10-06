# Per iniziare

Electros è la schermata con cui esegui workload sulle macchine che hai già collegato: i tuoi host AtomOS, hypervisor come Proxmox o ESXi e cloud pubblici. Non fai SSH su ogni box per creare un disco o una VM. Lo descrivi qui, scegli l’host e Electros parla con quell’host per te.

Se stai per creare qualcosa, scorri prima [Come funziona la creazione](#come-funziona-la-creazione). Ogni wizard usa lo stesso ritmo: compila il modulo, premi **Continue**, scegli un host, poi premi **Create** solo quando intendi davvero effettuare il provisioning.

![La shell di Electros: barra laterale, dashboard e colonna della flotta](../../user-guide/assets/01-getting-started-shell.png)

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-sidebar.png" alt="Barra laterale con Dashboard selezionato, gruppi compressi e footer dell’account" />
  <figcaption>La barra laterale è la mappa. La riga ambrata è la pagina in cui ti trovi. Un chevron apre un gruppo. Il footer è l’account con cui sei autenticato e lo stato di salute dei daemon.</figcaption>
</figure>

## A cosa serve la shell

Electros è un control plane locale. La barra laterale non crea mai una risorsa. Serve solo a spostarti. La pagina a destra è dove leggi la flotta o la modifichi. Il footer è la prima cosa da controllare quando un elenco è vuoto o un wizard non trova un host: se un daemon è giù, la riga di stato diventa rossa e le pagine che dipendono da quel daemon restano vuote.

## La barra laterale

La barra a sinistra è come ti muovi. Un chevron significa che la voce apre un gruppo. Clicca il nome del gruppo per espanderlo, poi clicca la pagina che ti serve.

| Voce | Cosa fai lì |
|------|-------------|
| **Dashboard** | Vedi tutta la flotta a colpo d’occhio e passi a creare una VM |
| **Active Connections** | Attivi o disattivi target e scenari per questa sessione |
| **IaaS** | Apre Storage, Networking, Virtual Machines e Spot VMs |
| **PaaS** | Apre Managed Kubernetes, Kubernetes, Database e Object Storage quando quei servizi sono abilitati |
| **SaaS** | Apre app ospitate come n8n e OpenClaw |
| **Account** | Apre profilo, preferenze email, organizzazione e fatturazione |
| **Connections** | Apre Targets e Scenarios. Visibile agli admin dell’organizzazione |
| **Settings** | Apre Preferences, AI Assistant, Appearance e Info |

Il footer mostra chi è autenticato e se i daemon locali sono in salute. **All systems healthy** significa che auth, compute, storage, networking e targets rispondono. Se uno non risponde, le creazioni e gli elenchi che dipendono da esso falliscono o restano vuoti — sistema il daemon prima di debuggare il modulo.

## Come è organizzata una pagina

La maggior parte delle pagine delle risorse condivide un layout:

- I **big buttons** in alto avviano un wizard di creazione (Create volume, Create Basic VM e così via).
- I **gauges** riepilogano conteggi e capacità.
- La **table** è l’inventario. Espandi una riga per i dettagli e le azioni di riga.
- **Reload** recupera una copia aggiornata dai daemon. Usalo quando hai modificato qualcosa fuori da questa schermata.

I wizard di creazione si aprono sopra quella pagina. La freccia nel titolo della pagina ti riporta indietro senza creare nulla.

## In quale organizzazione ti trovi

Membri, fatturazione e la sezione Connections seguono l’organizzazione in cui sei autenticato. Se non vedi Connections o Organisation, il tuo ruolo non può gestire l’org. Cambia organizzazione dall’area account prima di cercare quelle pagine.

## Un primo percorso sensato

1. Verifica che il footer della barra laterale sia in salute.
2. Apri **Active Connections** e controlla che gli host che ti aspetti siano abilitati. Vedi [Active Connections](./03-my-clouds).
3. Se manca un host, un admin lo aggiunge sotto [Connections](./04-connections).
4. Crea un disco, una rete o una VM da IaaS. Parti da [Come funziona la creazione](#come-funziona-la-creazione).

## Come funziona la creazione

Quasi ogni risorsa che aggiungi in Electros — un volume, una rete, una macchina virtuale, un database — segue lo stesso ritmo. Imparalo una volta e il resto del prodotto ti sembrerà familiare.

### La schermata in due passaggi

Non scegli prima l’host. Descrivi **cosa** vuoi, poi scegli **dove** deve girare.

1. **Compila il modulo** a sinistra. Un pannello **Review** a destra si aggiorna mentre digiti, così vedi la bozza prima di confermare.
2. Premi **Continue**. La schermata scorre su **Choose a Host**.
3. Scegli una card host (o **Automatic Selection** quando è offerta).
4. Premi **Create** solo quando sei pronto per il provisioning. Queste guide si fermano prima di quel pulsante.

<div class="zoom-row">

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-continue-restore.png" alt="Pulsanti Restore Configuration e Continue" />
  <figcaption><strong>Continue</strong> ti porta alla selezione dell’host. <strong>Restore Configuration</strong> riporta il modulo ai valori predefiniti.</figcaption>
</figure>

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-host-view-toggle.png" alt="Intestazione Choose a Host con toggle Table e Cards" />
  <figcaption>Nel passaggio host, passa tra <strong>Cards</strong> e <strong>Table</strong>. Cards è il default ed è più comodo quando confronti pochi target.</figcaption>
</figure>

</div>

### Cosa ti dice una card host

Ogni card è un luogo in cui Electros può eseguire la risorsa: una macchina AtomOS sulla tua rete, un hypervisor o un account cloud pubblico (Meson).

| Sulla card | Cosa significa per te |
|------------|------------------------|
| Nome e tipo | Quale target stai per usare, ad esempio “AtomOS Lab” o un provider cloud |
| Address | IP di un host locale, oppure il nome del provider cloud |
| Version | Versione Electros/AtomOS, quando l’host ne riporta una |
| Net price | Costo stimato, quando il provider può quotarlo |
| Evidenziazione arancione | La card che hai selezionato |

**Automatic Selection** lascia che Electros scelga un host idoneo per te. Usalo quando non ti interessa quale macchina esegua il workload. Scegli una card specifica quando ti serve un laboratorio, un sito o un account cloud particolari.

Se sei autenticato come **local user** su una singola box AtomOS, Electros salta la selezione host e **Continue** diventa **Create**.

### Nomi

La maggior parte dei campi nome ha un pulsante con i dadi accanto. Cliccalo per riempire un nome casuale e valido così puoi andare avanti in fretta. Puoi sempre digitarne uno tuo.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-name.png" alt="Campo VM Name con il pulsante dadi per il nome casuale" />
  <figcaption>I dadi riempiono un nome per te. Il campo resta vuoto finché non digiti o non ne generi uno — e un nome vuoto viene rifiutato.</figcaption>
</figure>

### Pannello Review

Il pannello a destra è un riepilogo in tempo reale, non un secondo modulo. Se lì un valore sembra sbagliato, correggilo a sinistra prima di continuare. Le caselle vuote significano che non hai ancora scelto quell’opzione (ad esempio nessun preset di sistema operativo, o nessun volume).

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-vm-review.png" alt="Pannello Review Configuration con CPU, RAM e volumi" />
  <figcaption>Review mostra la bozza: nome, CPU, memoria, preset OS e dischi collegati. Il badge in alto è un’immagine compatta degli stessi numeri.</figcaption>
</figure>

### Slider

CPU, memoria e dimensione del disco usano uno slider **e** un numero. Trascina lo slider per una dimensione predefinita, oppure digita un valore esatto quando la schermata offre una modalità custom. Il segno sotto la maniglia è la dimensione che verrà creata.

<figure>
  <img src="../../user-guide/assets/zoom-vm-cpu-ram.png" alt="Slider per core CPU e dimensione RAM" />
  <figcaption>La CPU di default è <strong>2 cores</strong>. La memoria di default è <strong>256 MB</strong>. Sposta la maniglia o modifica il numero a destra.</figcaption>
</figure>

### Prima di premere Create

- **Create** alloca la risorsa sull’host che hai scelto. Queste guide non ti chiedono mai di premerlo.
- Alcuni flussi cloud e di organizzazione aprono una **payment page** dopo una creazione riuscita. Completala solo se intendi essere addebitato.
- Lascia password, chiavi API e chiavi SSH private fuori dagli screenshot e dalle note condivise.
- Se un host mostra **Update Required**, il target è raggiungibile ma troppo vecchio per quell’azione. Aggiorna l’host, oppure scegline un altro.

### Dove andare dopo

| Voglio… | Apri |
|---------|------|
| Registrare una macchina, un cloud o un hypervisor | [Connections](./04-connections) |
| Aggiungere un disco, una cloud image o un volume cloud-init | [Storage](./05-iaas-storage) |
| Aggiungere una rete locale o Tailscale | [Networking](./06-iaas-networking) |
| Creare una macchina virtuale | [Virtual machines](./07-iaas-virtual-machines) |
| Creare una VM cloud di breve durata | [Spot VMs](./08-iaas-ephemeral-vms) |
| Distribuire Kubernetes, un database o un’app | [PaaS e SaaS](./09-paas-saas) |
| Creare una sotto-organizzazione o invitare persone | [Account](./10-account) |
