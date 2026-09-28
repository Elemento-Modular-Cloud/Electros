# Storage

Storage è l’inventario dei dischi che Electros può collegare alle macchine virtuali: volumi vuoti, cloud image, config cloud-init e image ISO o tool.

![Storage](../../user-guide/assets/05-iaas-storage.png)

## A cosa serve questa pagina

Storage è il catalogo dei dischi. Una macchina virtuale non porta con sé un disco vuoto a meno che tu non ne colleghi uno. Crei il volume qui, su un host che può eseguire block storage, poi lo colleghi quando crei o modifichi una VM. Anche le cloud image e le image ISO sono volumi: sono il modo in cui un ospite ottiene un installer o un disco root pronto.

Il banner lo dice direttamente: gestisci volumi, dischi di avvio e image ISO per la tua flotta.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-storage-create.png" alt="Pulsanti di creazione Storage e il gauge dei volumi" />
  <figcaption><strong>Create</strong> è un disco vuoto. <strong>Create ISO/Tool</strong> punta a un installer o a un’image tool. <strong>Create Cloud Image</strong> costruisce un disco dal catalogo OS. <strong>Create Cloud Init Config</strong> è un piccolo volume di file di first-boot. I gauge a destra contano ciò che hai già.</figcaption>
</figure>

## Leggi la pagina

I gauge in alto contano **Volumes**, **Format**, **Used Storage**, **Private**, **Bootable** e **ISOs**.

Le colonne della tabella sono **Name**, **UUID**, **Size**, **Host**, **Own**, **Bootable**, **Shareable**, **Read-only**, **Server** e **Actions**. Clicca un UUID per copiarlo.

**Table** è l’elenco compatto. **Advanced** mostra di più di ogni volume. **Reload** recupera una copia aggiornata. **Table** e **Cards** a destra cambiano come viene disegnato lo stesso inventario. Le Cards sono più facili da scorrere quando hai pochi dischi; la tabella è più comoda quando ordini per dimensione o host.

## Crea un disco

I pulsanti sotto il titolo aprono un wizard. Ognuno chiede una descrizione, poi un host ([Come funziona la creazione](./01-getting-started#come-funziona-la-creazione)). Non premere **Create** alla fine del wizard a meno che tu non voglia allocare il disco su quell’host.

### Volume vuoto

**Dove:** Storage → **Create**

![Modulo Create volume](../../user-guide/assets/create-volume-form.png)

Scorri il modulo dall’alto in basso. Il review a destra ripete nome, dimensione, formato, bus e priorità di avvio.

1. **Name** del volume, oppure usa i dadi. Obbligatorio.
2. **Size.** Resta su **Predefined** e trascina lo slider (parte da **16 GB**, tra 256 MB e 4 TB). Passa a **Custom** se ti serve una dimensione che non è sullo slider, e digitala nel campo memoria.
3. **Who can use it.**
   - **Private** parte **on**. Spegnilo solo se ogni utente su quell’host deve vedere il disco.
   - **Shareable** e **Bootable** non possono essere entrambi on. Un disco bootable è uno da cui una VM può avviarsi. Un disco shareable può essere collegato a più di una VM.
   - **Read-only** impedisce agli ospiti di scrivere.
4. **Format** di default è **qcow2**. Scegli **raw** se ti serve un file piatto.
5. **Bus / driver** di default è **virtio**. Usa sata, ide o scsi solo quando l’ospite lo richiede.
6. **Boot priority** di default è **100**. I numeri più bassi avviano per primi (0 è il primo).

Premi **Continue**.

![Scegli un host per il volume](../../user-guide/assets/create-volume-host.png)

Scegli una card host. Se un host cloud dice **Update Required**, quel target non può creare questo volume finché non è aggiornato — scegli un altro host o aggiornalo prima. Fermati prima di **Create**.

---

### Cloud image

**Dove:** Storage → **Create Cloud Image**

![Modulo Create cloud image](../../user-guide/assets/create-cloudimage-form.png)

1. Nome e, opzionalmente, segna **Private**.
2. Imposta **Volume size** in GB se l’image deve essere più grande della sorgente.
3. Scegli come Electros trova l’image:
   - **ISO** — scegli famiglia OS, flavour e versione dal catalogo.
   - **Custom URL** — incolla un URL diretto. Un URL vuoto viene rifiutato.
4. Nelle opzioni avanzate, il formato di default è **qcow2**, il bus **virtio**, la priorità di avvio **100**.

Review mostra nome, dimensione, formato, bus e priorità di avvio. **Continue**, poi scegli un host.

![Selezione host per una cloud image](../../user-guide/assets/create-cloudimage-host.png)

---

### Volume cloud-init

**Dove:** Storage → **Create Cloud Init Config**

![Modulo Cloud-init](../../user-guide/assets/create-cloudinit-form.png)

Questo volume non è un disco dati grande. Trasporta i file che un ospite legge al primo avvio.

1. Dai un nome al volume. **Private** parte off.
2. **Metadata** si chiama sempre `meta-data`. Digita lo YAML, oppure premi **Upload** e scegli un file sul computer. Il dialogo file è fuori da Electros — devi scegliere il file tu.
3. **User data** si chiama sempre `user-data`. Stessa scelta: digitalo o caricalo.
4. **Add additional script** se l’ospite ha bisogno di file extra. Ognuno ha il proprio nome file, testo e pulsante upload.

Il review conferma solo il nome e se il volume è privato. Se entrambi i file sono vuoti, Electros ti chiede di confermare prima di continuare — è previsto, non un errore.

**Continue**, scegli un host, fermati prima di **Create**. Non caricare file che contengono password reali se stai catturando screenshot.

---

### ISO o tool

**Dove:** Storage → **Create ISO/Tool**

![Modulo ISO e tool](../../user-guide/assets/create-iso-tool-form.png)

1. Dai un nome al volume. **Private** parte off.
2. Scegli **ISOs** o **Tools**. Devi sceglierne uno prima della creazione.
3. Se hai scelto ISOs, scorri il catalogo: famiglia, flavour, versione. Sono elencate solo le voci che hanno davvero un URL ISO.
4. Se hai scelto Tools, scegli il tipo tool, la famiglia OS, poi il tool.

Review mostra il nome, il tipo e se è privato. **Continue**, scegli un host, fermati prima di **Create**.

## Lavora con un volume già esistente

**Delete** sta sulla riga. Clic destro sulla riga per il resto:

| Azione | Cosa fa |
|--------|---------|
| **Edit** | Modifica flag come nome o priorità di avvio, a seconda di ciò che l’host consente |
| **Resize** | Ingrandisce il volume. Non puoi ridurlo sotto i dati già presenti |
| **Convert** | Cambia il formato su disco (ad esempio verso qcow2) |
| **Delete** | Ti chiede di confermare. Annulla se l’hai aperto per sbaglio. Scollega un volume da una VM in esecuzione prima di eliminarlo |
