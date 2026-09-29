# Spot VMs

Le Spot VMs (VM effimere) sono macchine di breve durata su un account **public cloud**. Non girano sui tuoi host AtomOS locali. Usa una macchina virtuale normale quando l’ospite deve restare su hardware che controlli tu.

![Spot VMs](../../user-guide/assets/08-iaas-ephemeral-vms.png)

## A cosa serve questa pagina

Le Spot VMs sono macchine burst su un cloud pubblico. Usale per una build, un test o un breve esperimento, poi terminale. Non sono il posto per un disco che ti servirà il mese prossimo. Quello sta su Virtual Machines, su un host che controlli. Lasciare una spot VM in esecuzione è ciò per cui paghi, quindi la riga è costruita intorno a power e terminate piuttosto che a un ciclo di vita lungo.

## Leggi la pagina

Il banner dice che sono macchine di breve durata per esperimenti e compute burst.

I gauge contano **Spot VMs**, **Running**, **vCPUs**, **Memory**, **Storage** e **Providers**.

Le colonne della tabella sono **Name**, **OS Type**, **Flavour**, **CPU**, **RAM**, **Block Storage**, **IP Address**, **Provider**, **Region** e **Actions**. **Reload** aggiorna l’elenco. Una tabella vuota significa che non ne hai ancora creata una, non che la pagina abbia fallito.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-spot-actions.png" alt="Terminal, Power, Reboot e terminate su una riga spot VM" />
  <figcaption>Provider e region ti dicono dove è stata collocata l’istanza. <strong>Terminal</strong> apre SSH verso l’IP dell’istanza nell’app desktop. <strong>Power</strong> e <strong>Reboot</strong> la tengono. L’icona cestino è <strong>Terminate</strong>: l’istanza viene eliminata e la fatturazione per essa si ferma.</figcaption>
</figure>

| Azione | Cosa fa |
|--------|---------|
| **Terminal** | Apre una sessione SSH verso l’IP pubblico dell’istanza nell’app desktop Electros. L’ospite deve essere in esecuzione e raggiungibile sulla porta 22. Inserisci username e password o chiave impostati in creazione |
| **Power** | Avvia o ferma l’istanza |
| **Reboot** | La riavvia |
| **Terminate** | Elimina la spot VM. Non resta in esecuzione e smetti di pagarla. Conferma solo quando intendi davvero buttare via la macchina |

## SSH da Terminal

**Terminal** è disponibile solo nell’**app desktop** Electros. La build browser non può aprire la finestra SSH.

Le nuove spot VM aprono **TCP 22** (e 443) sulla rete pubblica di default così SSH può raggiungere l’ospite. La sessione usa l’**IPv4 pubblico** dell’istanza, non l’host API Meson.

### Modulo di connessione

La finestra si apre su una schermata di connessione con il riepilogo della VM (nome, IP, flavour, provider, OS e stato). Host e username sono precompilati dalla riga.

![Modulo SSH connect per una spot VM](../../user-guide/assets/08-ssh-connect.png)

Scegli come autenticarti:

| Metodo | Cosa inserisci |
|--------|----------------|
| **Password** | La password impostata creando la spot VM |
| **SSH key** | Una chiave privata da `~/.ssh`, oppure **Browse…** per sceglierne un altro file. Passphrase opzionale se la chiave è cifrata |

Premi **Connect** quando l’ospite è in esecuzione e la porta 22 è raggiungibile.

### Sessione connessa

Dopo la connessione, la barra del titolo tiene visibile l’identità dell’istanza: nome, `user@ip`, OS, provider, flavour e stato della connessione. Il tema del terminale segue l’OS dell’ospite.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-ssh-titlebar.png" alt="Barra del titolo SSH con OS, provider, flavour e stato Connected" />
  <figcaption>La barra del titolo mostra il nome della spot VM, l’endpoint, l’OS, il provider cloud, il flavour dell’istanza e lo stato <strong>Connected</strong> mentre la shell è aperta.</figcaption>
</figure>

![Sessione SSH verso una spot VM](../../user-guide/assets/08-ssh-session.png)

Se l’ospite non ha ancora un IP pubblico, o SSH viene aperto fuori dall’app desktop, Electros mostra un errore invece di una finestra vuota. Se l’istanza è spenta, puoi aprire comunque oppure avviare e aprire.

## Crearne una

**Create Spot VM** apre il wizard. La schermata usa ancora [modulo, poi host](./01-getting-started#come-funziona-la-creazione), ma l’elenco host sono solo account cloud.

### 1. Nome e sistema operativo

![Modulo Spot VM](../../user-guide/assets/create-ephemeral-form.png)

- **Name** — obbligatorio. Dadi o digita.
- **OS family, flavour e version** — tutti obbligatori. Questa è l’image che il cloud avvierà.

### 2. Come effettuerai il login

- **Username** — obbligatorio.
- **Password** — opzionale, ed è un segreto. Preferisci una chiave SSH quando puoi.
- **SSH public key** — incolla solo la chiave pubblica, mai quella privata.

Dopo che l’istanza è in esecuzione, **Terminal** nell’elenco Spot VMs apre una finestra SSH verso l’IP pubblico (app desktop). Le nuove spot VM espongono **TCP 22** di default per quel percorso. Vedi [SSH da Terminal](#ssh-da-terminal).

### 3. Cloud-init (opzionale)

La grande casella di testo è user-data per il first boot. **Upload file** apre il selettore file del computer. Salta entrambi se l’image non ha bisogno di cloud-init.

### 4. Scegli una dimensione (flavour)

Il catalogo è raggruppato in tab (ad esempio un elenco in stile EC2). Devi selezionare una flavour card prima della creazione.

Restringi l’elenco se è lungo:

| Controllo | Cosa fa |
|-----------|---------|
| Search | Corrisponde ai nomi dei flavour |
| Workload | All, burstable, general, compute, memory, development o cost |
| Sort | Name, vCPU, RAM o disk, in entrambe le direzioni |
| vCPU / RAM / disk min e max | Nasconde i flavour fuori dall’intervallo |
| Clear filters | Azzera i filtri, non il modulo |

### 5. Leggi il review

Controlla **VM name**, **instance flavour**, **block storage**, **OS preset** e **deployment provider**. Se la riga del flavour è vuota, non hai ancora selezionato una dimensione.

### 6. Scegli un host cloud

Premi **Continue**.

![Host cloud per una spot VM](../../user-guide/assets/create-ephemeral-host.png)

Compaiono solo i target cloud. Selezionane uno. **Create** può aprire una payment page — non completare il checkout a meno che tu non intenda essere fatturato.

**Create** alla fine può aprire una payment page. Non completare il checkout a meno che tu non intenda essere fatturato. Quando l’istanza non serve più, eliminala da questo elenco così non resta in esecuzione.
