# Active Connections

Questa pagina decide quali host e scenari Electros userà **in questo momento**. Registrare un target (sotto Connections) non lo attiva. Abilitarlo qui sì.

![Active Connections](../../user-guide/assets/03-my-clouds.png)

## A cosa serve questa pagina

Registrare un host sotto Connections lo memorizza soltanto. Questa pagina decide con quali di quegli host Electros parlerà davvero in questa sessione. Un target spento non compare nei selettori host, e le sue VM e i suoi dischi scompaiono dagli elenchi IaaS. Attiva uno scenario quando vuoi un intero laboratorio in una volta. Attiva un target di riserva quando vuoi solo quella macchina.

## La quota

La barra in alto indica quante connessioni stai usando rispetto al limite del piano, ad esempio “Using 12 of 25 connections.” Abilitare un altro target fallisce quando sei già al tetto. Disabilitane uno che non usi, o cambia piano, prima di aggiungerne altri.

## Scenarios

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-clouds-scenarios.png" alt="Card degli scenari con i target che abilitano" />
  <figcaption>Ogni card è un pacchetto. I chip colorati sono i target al suo interno. La checkbox attiva l’intero pacchetto. I chip seguono il colore del target: blu AtomOS, verde hypervisor, rosso cloud pubblico.</figcaption>
</figure>

Uno scenario è un pacchetto nominato di target (uno stack di laboratorio, una demo cloud pubblica e così via). Attivare uno scenario abilita ogni target in quel pacchetto ed è il modo più rapido per cambiare contesto.

I target richiesti dallo scenario **corrente** compaiono bloccati. Non puoi spegnerli singolarmente. Passa a uno scenario che non li include, oppure modifica lo scenario, poi disabilita il target.

Crea e modifica gli scenari sotto [Connections](./04-connections#crea-uno-scenario).

## Spare targets

Sotto gli scenari, ogni card è un host non legato esclusivamente alla vista scenario: AtomOS, un hypervisor o un cloud pubblico o privato.

| Sulla card | Significato |
|------------|-------------|
| Name | Quale target |
| Type | AtomOS su un IP locale, Meson public, Meson private, Proxmox, ESXi e così via |
| IP address o provider | L’indirizzo di un host locale, oppure il nome del cloud |
| Certificate | Se il certificato di un host AtomOS è attendibile |

Clicca una card spare-target per abilitarla o disabilitarla. Se Electros rifiuta, quel target è richiesto dallo scenario che hai attivo.

## Toolbar

| Controllo | Cosa fa |
|-----------|---------|
| **Host Certificates** | Rivedi o fidati dei certificati degli host AtomOS |
| **Hypervisor Credentials** | Memorizza username e password usati quando un target Proxmox o ESXi viene abilitato |
| **Reload** | Chiede al daemon targets un elenco aggiornato |

## Dettaglio host

Apri il dettaglio di un target quando ti serve lo stato live dell’host (CPU, memoria, dischi su quella macchina) piuttosto che l’interruttore on/off. Torna qui per abilitarlo o disabilitarlo.
