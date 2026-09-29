# Networking

Networking elenca ogni rete che Electros conosce: reti libvirt locali e reti Tailscale globali.

![Networking](../../user-guide/assets/06-iaas-networking.png)

## A cosa serve questa pagina

Una VM senza rete può avviarsi e non avere comunque dove andare. Questa pagina è l’elenco delle reti che puoi collegare: reti libvirt private che vivono su un host o pochi host, e reti Tailscale che possono attraversare i siti. Crei la rete qui, poi la colleghi dalla macchina virtuale.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-net-create.png" alt="Create Global Network e Create Local Network" />
  <figcaption><strong>Create Global Network</strong> è Tailscale. <strong>Create Local Network</strong> è libvirt sugli host che scegli. La frase sotto il titolo è il lavoro della pagina: reti private, bridged e globali per i tuoi workload.</figcaption>
</figure>

## Leggi la pagina

I gauge contano **Networks**, **Global Networks**, **Local Networks**, **Private**, **NAT** e **Bridge**.

Le colonne della tabella sono **Name**, **UUID**, **Network Address**, **Type**, **Mode**, **Private**, **Creator UUID**, **Host** e **Actions**. **Reload** aggiorna l’elenco. **Table** e **Cards** a destra cambiano il layout.

## Crea una rete

| Pulsante | Cosa ottieni |
|----------|--------------|
| **Create Global Network** | Una rete Tailscale che può attraversare gli host |
| **Create Local Network** | Una rete libvirt sugli host che scegli |

NAT è il tipo locale abituale: gli ospiti ottengono indirizzi privati e accesso in uscita. Isolated li tiene fuori dalla rete esterna. Leggi gli avvisi nel wizard prima di scegliere Open. Entrambi usano il pattern [modulo, poi host](./01-getting-started#come-funziona-la-creazione).

### Rete locale (libvirt)

**Dove:** Networking → **Create Local Network**

![Modulo rete locale](../../user-guide/assets/create-libvirt-form.png)

Il modulo ha quattro sezioni. Aprine ciascuna; non è obbligatorio cambiare ogni campo.

### General

- **Network name** — obbligatorio. Usa i dadi o digita uno.
- **Shareable** — off di default, il che significa che la rete è privata per te. Attivalo se altri utenti sull’host devono usarla.

### Network

- **Type** parte da **NAT**, che è la scelta giusta per una VM che ha bisogno di internet in uscita e di un indirizzo privato. Altri tipi:
  - **Isolated** — le VM parlano tra loro, non con l’esterno.
  - **Routed** — aggiungerai tu le route.
  - **Open** — il meno ristretto. Leggi l’avviso prima di usarlo.
  - **Bridge** è mostrato ma disabilitato.
- **Network address** — CIDR, ad esempio un intervallo privato. Electros ti avvisa se l’intervallo non è privato o il CIDR sembra sbagliato.

### DHCP

Off di default. Attiva **Enable DHCP** se gli ospiti devono ricevere indirizzi automaticamente. Poi imposta **start** e **end** del pool. Le **Reservations** sono righe opzionali (IP, MAC, nome) per gli ospiti che devono ricevere sempre lo stesso indirizzo.

### Routing

Opzionale. Aggiungi una route con un CIDR di destinazione e un gateway quando il tipo è routed o ti servono percorsi extra.

Il review elenca il nome, il tipo (NAT a meno che tu non l’abbia cambiato), l’indirizzo, l’intervallo DHCP e quante reservation e route hai aggiunto.

Premi **Continue**.

![Host per una rete locale](../../user-guide/assets/create-libvirt-host.png)

Seleziona l’host che deve possedere la rete. Se Electros avvisa che l’IP dell’host stesso cade nel tuo nuovo intervallo, cambia l’intervallo o scegli un altro host — altrimenti l’host può perdere il suo indirizzo. Un host cloud può anche dire **Update Required**. Fermati prima di **Create**.

---

### Rete globale (Tailscale)

**Dove:** Networking → **Create Global Network**

![Modulo rete Tailscale](../../user-guide/assets/create-tailscale-form.png)

1. **Name** della rete. Obbligatorio.
2. **Share with other users** parte off.
3. **Network address** è un indirizzo in stile Tailscale ed è sempre un **/16**. Se ripristini il modulo torna come `10.0.0.0`.
4. **Hosts bits** parte da **2**. Quel numero divide il /16 tra “quanti host” e “quante VM per host”:
   - VM su ciascun host = 2^(16 − hosts bits) − 4
   - Numero di host = 2^(hosts bits)

Il review mostra il nome, l’indirizzo, i hosts bits, le VM per host e il totale host. Controlla quei numeri prima di continuare — non puoi selezionare più host di quanti “total hosts” permetta.

**Continue** apre un elenco host in cui puoi selezionare **più di un** host. Fermati prima di **Create**. Le chiavi che Tailscale mostra dopo che la rete esiste sono segreti; non copiarle nella guida o in un ticket.

## Dopo che la rete esiste

La colonna **Actions** mostra solo i pulsanti che valgono per quella rete:

| Pulsante | Quando compare | Cosa fa |
|----------|----------------|---------|
| **DHCP** | La rete ha un pool DHCP | Apre l’intervallo e le reservation (un IP fisso per un MAC). Questa vista non ricostruisce la rete |
| **Routes** | Una rete locale ha già delle route | Mostra quelle route |
| **Servers** | La rete è globale (Tailscale) | Elenca gli host che ne fanno parte |
| **Delete** | Sempre | Ti chiede di confermare. Gli ospiti ancora collegati perdono quella NIC |

Clic destro sulla riga per le stesse finestre: **View DHCP Configuration**, **View Routing Configuration**, **Manage Hosts** su una rete globale e **Delete Network**.

Una rete Tailscale può in seguito mostrare una chiave di pre-autenticazione. Tratta quella chiave come un segreto. Non incollarla in un ticket o in uno screenshot.
