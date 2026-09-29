# Settings

Settings modifie cette copie d'Electros sur votre ordinateur. Elles ne créent pas de VM, ne déplacent pas de disque, et ne changent pas le plan de l'organisation. Preferences définit comment l'application trouve les hôtes et combien de vos données elle affiche à l'écran. AI Assistant est le point de terminaison du modèle. Appearance est le fond d'écran et le verre. Info est la version et les licences.

## Preferences

![Preferences](../../user-guide/assets/11-settings-preferences.png)

<figure class="zoom">
  <img src="../../user-guide/assets/zoom-prefs-toggles.png" alt="Interrupteurs de connexion, curseur de délai et Save settings" />
  <figcaption>Les quatre interrupteurs et le délai forment un seul formulaire. Rien n'est enregistré tant que vous n'appuyez pas sur <strong>Save settings</strong>. Quinze secondes est l'attente par défaut. Les UI Preferences, plus bas, s'appliquent dès que vous les basculez.</figcaption>
</figure>

Appuyez sur **Save settings** après avoir modifié le bloc de connexion. Les interrupteurs d'interface s'appliquent au fur et à mesure.

### Comment Electros parle aux hôtes

| Réglage | Que choisir |
|---------|----------------|
| **Use TCP list** | Activé lorsque les cibles sont atteintes par une liste TCP configurée plutôt que par la découverte seule |
| **Use UDP autodiscovery** | Activé pour trouver les hôtes AtomOS qui s'annoncent sur le réseau local |
| **Verify HTTPS certificates** | Laissez activé sauf si vous déboguez un labo avec un certificat privé que vous comprenez déjà |
| **Use HTTPS** | Activé pour le trafic daemon chiffré |
| **Timeout** | Combien de temps Electros attend. Il démarre à **15 seconds**. Augmentez-le sur un lien lent ; ne le mettez pas à 1 seconde sur un WAN |

### UI Preferences

| Réglage | Ce qu'il fait |
|---------|----------------|
| **Hide sensitive data** | Masque les adresses IPv4 publiques et les adresses e-mail dans l'interface |
| **Display popup notifications** | Affiche des toasts lorsqu'une action réussit ou échoue |
| **Replay the introduction tour** | Relance le tour de première utilisation |

**Raw configuration** affiche le fichier de réglages qu'Electros utilise et le chemin sur le disque. Refresh le relit. Modifiez le formulaire ci-dessus plutôt que le JSON, sauf si vous connaissez le format du fichier.

### Dépôts de modèles de VM

Les blueprints peuvent provenir d'un dépôt Git. Appuyez sur **+** et remplissez :

| Champ | Conseils |
|-------|----------|
| Owner / organisation | Organisation ou utilisateur GitHub, par exemple `Elemento-modular-cloud` |
| Repository name | Le dépôt qui contient les modèles |
| Branch | Défaut `master` |
| Token | Laissez vide pour un dépôt public. Obligatoire pour un dépôt privé. C'est un secret |

Un tableau vide signifie qu'aucun dépôt n'est encore configuré. C'est normal. **Create VM from Blueprint** ne liste les modèles qu'après qu'un dépôt a été enregistré et chargé.

## Assistant IA

![Réglages IA](../../user-guide/assets/11-settings-ai.png)

La bannière est exacte : **restart Electros** après l'enregistrement. **Test connection** vérifie la configuration déjà chargée par l'application en cours, donc un test fait avant le redémarrage voit encore les anciennes valeurs.

1. Choisissez un préréglage s'il vous correspond : **Local LM Studio** ou **Remote OpenRouter**.
2. Sinon, définissez vous-même **Base URL**, **API Key**, **Model** et **Route Path**. La clé API est un secret. Les placeholders montrent la forme : une URL de base telle que `https://openrouter.ai/api/v1`, un modèle tel que `provider/model-name`, et une route telle que `/chat/completions`.
3. **Save settings**.
4. Redémarrez l'application.
5. **Test connection**. La ligne d'état sous **Connection** rapporte le résultat. Un message rouge signifie que le point de terminaison a répondu mais qu'Electros n'a pas pu utiliser la charge utile. Corrigez l'URL, la clé ou le modèle, enregistrez, redémarrez, et testez à nouveau.

**Advanced** est replié jusqu'à ce que vous l'ouvriez.

| Réglage | Conseils |
|---------|----------|
| Request timeout (seconds) | Combien de temps attendre le modèle. Le placeholder est 600 |
| Persist agent sessions | Conserve les sessions de chat entre les redémarrages |
| Enable Headroom | Laisse une marge de contexte supplémentaire pour l'agent |
| Headroom mode | Comment Headroom compresse le contexte. Le placeholder est `optimize` |
| Headroom fallback on error | Continue sans Headroom si cette étape échoue |
| Headroom store directory | Où Headroom conserve ses données. Le placeholder est `~/.headroom` |
| Headroom skip tools | Une liste d'outils séparés par des virgules que Headroom doit ignorer |

## Appearance

![Appearance](../../user-guide/assets/11-settings-appearance.png)

**Language.** **App Language** suit **OS Preference** sauf si vous choisissez English ou Italian. French, German, Spanish et Portuguese sont listés et pas encore disponibles.

**Glassmorphism.** Activez-le pour des cartes dépolies. Définissez ensuite **Card Background Color**, **Opacity** (il démarre près de 28 %), et un thème : **Light**, **Dark** ou **Midnight**. Désactivez-le si le texte est difficile à lire sur le fond d'écran.

**Background.**

| Contrôle | Ce qu'il fait |
|---------|----------------|
| **Background Animations** | Mouvement dans le fond d'écran |
| **Show Atmosphere Background** | L'illustration Terre depuis l'orbite |
| **Hide product tile backgrounds** | Remplace la photo dans les titres de page par un dégradé ambre plat |
| **+** | Importe un fond d'écran. L'application de bureau ouvre une boîte de dialogue de fichier. Dans un navigateur simple cette action n'est pas disponible |
| **None** | Pas de fond d'écran |
| **Color** | Une couleur plate depuis le sélecteur de cette tuile |
| **Brightness** | Démarre à 100 %. La flèche de réinitialisation le remet |
| **Blur** | Démarre à 0. La flèche de réinitialisation l'efface |

L'indication sous les tuiles précise que les fonds d'écran sont stockés dans `~/.elemento/backgrounds`.

## Info

![Info](../../user-guide/assets/11-settings-info.png)

L'en-tête affiche la version Electros (Electron). Sous **Open Source Licenses**, chaque carte est une dépendance. **License** ouvre la licence de ce projet. Un second lien mène au site du projet, npm ou PyPI. Il n'y a rien à enregistrer.
