# Dashboard

La dashboard è la home. Il banner dice **Any cloud, one control plane.** Non crea risorse da sola. Ti dice se la flotta è in salute e ti dà scorciatoie verso i wizard di creazione.

![Dashboard](../../user-guide/assets/02-dashboard-overview.png)

## A cosa serve questa pagina

La dashboard risponde a tre domande prima che tu apra un wizard: la flotta è su, dove sono le macchine e quale scorciatoia mi serve. Non modifica una VM, un disco o una fattura. Quelli vivono sulle rispettive pagine. Usala come controllo del mattino, poi salta dove ti serve.

## Scorciatoie nell’header

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-dash-hero.png" alt="Banner della Dashboard con New VM, Spot VM, Deploy hosting e la card dei workload" />
  <figcaption><strong>+ New VM</strong> è l’azione primaria. <strong>Spot VM</strong> e <strong>Deploy hosting</strong> sono le altre due scorciatoie. La card a destra conta i workload in esecuzione e attiva <strong>Needs attention</strong> quando qualcosa non è in salute.</figcaption>
</figure>

| Pulsante | Apre |
|----------|------|
| **+ New VM** | [Crea una macchina virtuale di base](./07-iaas-virtual-machines#vm-di-base) |
| **Spot VM** | [Crea una spot VM](./08-iaas-ephemeral-vms#crearne-una) |
| **Deploy hosting** | Un flusso di creazione hosting / servizio |

La piccola card in alto a destra conta i workload in esecuzione (VM, SaaS, servizi) e segnala **Needs attention** quando qualcosa non è in salute. È un riepilogo, non un elenco che puoi modificare.

## Come leggere i pannelli

Leggi da sinistra a destra, poi la colonna a destra.

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-dash-compute.png" alt="Inventario compute, capacità e barre di stato delle VM" />
  <figcaption>Inventory sono i conteggi. Capacity sono core, memoria e volumi collegati. Le barre sono lo stato di alimentazione: verde running, arancione stopped, giallo paused.</figcaption>
</figure>

**Compute.** Inventory è quante macchine virtuali, template e GPU hai, più l’OS più comune. Capacity sono core, memoria e volumi in uso. **VM states** suddivide la flotta in tre barre: verde **Running**, arancione **Stopped**, giallo **Paused**.

**Storage.** Quanti volumi, quanto spazio usano, quanti sono avviabili e quali formato disco e driver dominano (spesso qcow2 e virtio). Le barre sotto la card storage sono un mix di formati (QCOW2, RAW, VMDK), non un allarme di utilizzo.

**OS landscape.** Quota degli ospiti per sistema operativo. Utile quando stai per standardizzare le image.

**VM location breakdown.** Dove girano davvero quelle VM: AtomOS, un hypervisor o un cloud pubblico. Se manca un provider che ti aspettavi, il target è probabilmente disabilitato sotto [Active Connections](./03-my-clouds).

**Networking.** Conteggio delle reti e quante sono globali rispetto a locali. **Local network modes** mostra NAT, isolated e open.

**PaaS services e SaaS apps.** Anelli per running, healthy e needs-attention, poi conteggi per prodotto (Kubernetes, database, object storage, n8n, OpenClaw). Apri la pagina corrispondente nella barra laterale per agire su una singola istanza.

## La colonna di destra

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-dash-rail.png" alt="Fleet overview e cloud targets" />
  <figcaption><strong>Fleet overview</strong> è la stessa storia dei pannelli, in un solo elenco. <strong>Cloud targets</strong> è la raggiungibilità: active significa che puoi collocare un workload lì, unreachable significa che quell’host mancherà o fallirà in un wizard.</figcaption>
</figure>

**Fleet overview** riporta la stessa flotta in una colonna: Connections, IaaS, PaaS e SaaS, ciascuno con un conteggio.

**Cloud targets** è l’elenco di raggiungibilità. Un punto verde significa che Electros può parlare con quell’host. Un punto rosso significa unreachable — le creazioni che necessitano di quell’host falliranno o lo ometteranno. Sistema la rete, il daemon o la registrazione del target prima di riprovare un wizard.

Con il piano **Pro**, le righe meson (cloud pubblico) mostrano anche un chip di salute del vendor da Hypermonitor: operational, maintenance, degraded o outage. È lo stato del prodotto del cloud, non se Electros raggiunge l’host. Apri **Cloud status** nella barra laterale per la tabella completa provider × servizio.

Le righe in basso ripetono i numeri di testa in frasi (ad esempio quante VM sono in esecuzione, quanti target sono giù).

## Quando la dashboard sembra vuota

Una flotta vuota disegna comunque i pannelli, con zeri. Non è un bug. Aggiungi un target sotto Connections, abilitalo sotto Active Connections, poi crea una VM o un volume. Ricarica la dashboard dopo se i numeri non si muovono.
