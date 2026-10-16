# OVH (Meson privato)

Crea un set di token API OVH e un project id per Electros. Id provider: **`ovh`**.

## Campi richiesti da Electros

| Campo | Cos’è |
|-------|--------|
| `OVH_APPLICATION_KEY` | Application key dell’account OVH |
| `OVH_APPLICATION_SECRET` | Application secret |
| `OVH_CONSUMER_KEY` | Consumer key autorizzata su quell’account/progetto |
| `OVH_PROJECT` | ID del progetto Public Cloud OVH |

## Project ID

L’ID del progetto Public Cloud (`OVH_PROJECT`) è sotto **Public Cloud → [nome progetto]**. È l’ID nell’URL (`/public-cloud/projects/<project-id>/…`) e nelle impostazioni del progetto — non il nome leggibile.

![Project ID OVH](../../../user-guide/assets/private-meson-ovh-1-project.png)

## Application key, secret e consumer key

1. Accedi all’account OVH a cui appartengono le credenziali.
2. Apri [https://api.ovh.com/createToken/](https://api.ovh.com/createToken/) (oppure `api.us.ovhcloud.com` / `api.ca.ovh.com` per altri endpoint) mentre sei autenticato su quell’account.
3. Compila:
   - **Application name:** ad esempio `elemento-meson`
   - **Application description:** testo libero
   - **Validity:** illimitata a meno che non voglia far scadere il token
   - **Rights:** questo modulo crea anche la consumer key, quindi imposta i diritti qui

| Metodo | Path |
|--------|------|
| GET | `/cloud/project/{serviceName}/capabilities/kube/flavors` |
| GET, POST, DELETE | `/cloud/project/{serviceName}/kube` |
| GET, POST, DELETE | `/cloud/project/{serviceName}/kube/*` |
| GET, POST | `/cloud/project/{serviceName}/network/private` |
| GET | `/cloud/project/{serviceName}/network/private/*` |
| GET, POST, DELETE | `/cloud/project/{serviceName}/region/*/gateway` |
| GET, DELETE | `/cloud/project/{serviceName}/region/*/gateway/*` |
| GET | `/cloud/project/{serviceName}/operation/*` |

Un equivalente più semplice è `GET`, `POST`, `PUT`, `DELETE` su `/cloud/project/{serviceName}/*`.

4. Invia. OVH restituisce **Application Key**, **Application Secret** e **Consumer Key** una sola volta — copiali subito.

![Risultato token API OVH](../../../user-guide/assets/private-meson-ovh-2-token.png)

5. Visita l’**URL di validazione** inviato da OVH (email o in pagina). La consumer key non è usabile finché non confermi autenticato sullo stesso account.

## Completa in Electros

1. **Connections** → **Add Provider** → **Private** → **OVH**.
2. Inserisci application key, secret, consumer key e project id.
3. **Conclude**, poi abilita il target in **Active Connections**.
