# Credenziali Meson privato

Un **Meson privato** consente all’organizzazione di usare il proprio account cloud (bring your own credentials) invece di una demo Meson pubblica condivisa.

Registri l’account una sola volta in [Connessioni](../04-connections) → **Add Provider** → **Private**, poi lo abiliti in [Connessioni attive](../03-my-clouds) quando ti serve.

## A cosa serve questa pagina

Queste guide spiegano come creare le credenziali che Electros richiede. Scegli il cloud, segui i passaggi nella relativa console, poi incolla i valori nel modulo Electros. Tratta ogni chiave e segreto come riservati.

## Come collegare in Electros

1. Apri **Connections** → Targets → **Add Provider**.
2. Scegli **Private**.
3. Seleziona **un** provider.
4. Inserisci un **Target name**.
5. Compila i campi credenziali (vedi la guida del provider sotto).
6. **Conclude**.
7. In **Active Connections**, abilita il nuovo target (o uno scenario che lo include).

## Provider

| Provider | Guida |
|----------|--------|
| Google | [google](./google) |
| Azure | [azure](./azure) |
| OVH | [ovh](./ovh) |
| UpCloud | [upcloud](./upcloud) |
| Wasabi | [wasabi](./wasabi) |
| Scaleway | [scaleway](./scaleway) |
| Impossible Cloud | [impossiblecloud](./impossiblecloud) |
| Oracle Cloud | [oracle](./oracle) |
| AWS | [aws](./aws) |

Non inviare credenziali via email o chat. Inseriscile solo in Electros.
