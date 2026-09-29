# Settings

Settings modifica questa copia di Electros sul tuo computer. Non crea una VM, non sposta un disco e non cambia il piano dell’organizzazione. Preferences è come l’app trova gli host e quanti dei tuoi dati mostra a schermo. AI Assistant è l’endpoint del modello. Appearance è wallpaper e glass. Info è la versione e le licenze.

## Preferences

![Preferences](../../user-guide/assets/11-settings-preferences.png)

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-prefs-toggles.png" alt="Toggle di connessione, slider timeout e Save settings" />
  <figcaption>I quattro interruttori e il timeout sono un solo modulo. Nulla viene salvato finché non premi <strong>Save settings</strong>. Quindici secondi è l’attesa di default. Le UI Preferences, sotto, si applicano mentre le attivi.</figcaption>
</figure>

Premi **Save settings** dopo aver modificato il blocco connessione. I toggle UI si applicano mentre li imposti.

### Come Electros parla con gli host

| Impostazione | Cosa scegliere |
|--------------|----------------|
| **Use TCP list** | On quando i target si raggiungono con una lista TCP configurata piuttosto che solo con discovery |
| **Use UDP autodiscovery** | On per trovare host AtomOS che si annunciano sulla rete locale |
| **Verify HTTPS certificates** | Lascialo on a meno che tu non stia debuggando un laboratorio con un certificato privato che già conosci |
| **Use HTTPS** | On per il traffico cifrato dei daemon |
| **Timeout** | Quanto aspetta Electros. Parte da **15 seconds**. Alzalo su un link lento; non impostarlo a 1 secondo su una WAN |

### UI Preferences

| Impostazione | Cosa fa |
|--------------|---------|
| **Hide sensitive data** | Nasconde indirizzi IPv4 pubblici e indirizzi email nell’UI |
| **Display popup notifications** | Mostra toast quando un’azione riesce o fallisce |
| **Replay the introduction tour** | Riavvia il tour del primo avvio |

**Raw configuration** mostra il file di impostazioni che Electros sta usando e il path su disco. Refresh lo rilegge. Modifica il modulo sopra piuttosto che il JSON, a meno che tu non conosca il formato del file.

### Repository dei template VM

I blueprint possono arrivare da un repository Git. Premi **+** e compila:

| Campo | Guida |
|-------|-------|
| Owner / organisation | Org o utente GitHub, ad esempio `Elemento-modular-cloud` |
| Repository name | Il repo che contiene i template |
| Branch | Di default `master` |
| Token | Lascia vuoto per un repo pubblico. Obbligatorio per uno privato. È un segreto |

Una tabella vuota significa che non è ancora configurato alcun repo. È normale. **Create VM from Blueprint** elenca i template solo dopo che un repo è salvato e caricato.

## AI assistant

![AI settings](../../user-guide/assets/11-settings-ai.png)

Il banner è corretto: **restart Electros** dopo il salvataggio. **Test connection** controlla la config che l’app in esecuzione ha già caricato, quindi un test fatto prima del restart vede ancora i vecchi valori.

1. Scegli un preset se ti corrisponde: **Local LM Studio** o **Remote OpenRouter**.
2. Altrimenti imposta tu **Base URL**, **API Key**, **Model** e **Route Path**. La chiave API è un segreto. I placeholder mostrano la forma: una base URL come `https://openrouter.ai/api/v1`, un modello come `provider/model-name` e una route come `/chat/completions`.
3. **Save settings**.
4. Riavvia l’app.
5. **Test connection**. La riga di stato sotto **Connection** riporta il risultato. Un messaggio rosso significa che l’endpoint ha risposto ma Electros non ha potuto usare il payload. Correggi URL, chiave o modello, salva, riavvia e riprova.

**Advanced** è compresso finché non lo apri.

| Impostazione | Guida |
|--------------|-------|
| Request timeout (seconds) | Quanto aspettare sul modello. Il placeholder è 600 |
| Persist agent sessions | Mantiene le sessioni chat tra i riavvii |
| Enable Headroom | Lascia spazio di contesto extra per l’agent |
| Headroom mode | Come Headroom comprime il contesto. Il placeholder è `optimize` |
| Headroom fallback on error | Continua senza Headroom se quel passaggio fallisce |
| Headroom store directory | Dove Headroom tiene i suoi dati. Il placeholder è `~/.headroom` |
| Headroom skip tools | Un elenco separato da virgole di tool che Headroom deve lasciare stare |

## Appearance

![Appearance](../../user-guide/assets/11-settings-appearance.png)

**Language.** **App Language** segue **OS Preference** a meno che tu non scelga English o Italian. French, German, Spanish e Portuguese sono elencati e non ancora disponibili.

**Glassmorphism.** Attivalo per le card frosted. Poi imposta **Card Background Color**, **Opacity** (parte vicino al 28%) e un tema: **Light**, **Dark** o **Midnight**. Spegnilo se il testo è difficile da leggere sul wallpaper.

**Background.**

| Controllo | Cosa fa |
|-----------|---------|
| **Background Animations** | Movimento nel wallpaper |
| **Show Atmosphere Background** | L’artwork della Terra dall’orbita |
| **Hide product tile backgrounds** | Sostituisce la foto nei titoli di pagina con un gradiente ambra piatto |
| **+** | Importa un wallpaper. L’app desktop apre un dialogo file. In un browser semplice quell’azione non è disponibile |
| **None** | Nessun wallpaper |
| **Color** | Un colore piatto dal selettore su quella tile |
| **Brightness** | Parte da 100%. La freccia di reset lo riporta indietro |
| **Blur** | Parte da 0. La freccia di reset lo azzera |

Il suggerimento sotto le tile dice che i wallpaper sono salvati in `~/.elemento/backgrounds`.

## Info

![Info](../../user-guide/assets/11-settings-info.png)

L’header mostra la versione di Electros (Electron). Sotto **Open Source Licenses**, ogni card è una dipendenza. **License** apre la licenza di quel progetto. Un secondo link va al sito del progetto, npm o PyPI. Non c’è nulla da salvare.
