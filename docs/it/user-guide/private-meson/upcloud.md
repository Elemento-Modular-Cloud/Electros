# UpCloud (Meson privato)

Crea un sotto-account UpCloud solo API e un token API per Electros. Id provider: **`upcloud`**.

## Crea le credenziali nella UI UpCloud

1. Accedi a [hub.upcloud.com](https://hub.upcloud.com) con l’account UpCloud che deve possedere queste credenziali (account principale o un sotto-account creato a questo scopo).
2. Vai su **Account** → **Users / Sub-accounts** → **Add user**.
3. Imposta **username** e **password**.
4. Abilita **Allow API connections** e lascia disabilitato **Allow control panel login** — solo accesso API, niente login GUI.
5. Salva. Ora hai una coppia username/password UpCloud.
6. Accedi con quel sotto-account.
7. Apri la pagina **Account** e crea una nuova **API key**.

![API key UpCloud](../../../user-guide/assets/private-meson-upcloud-1-api-key.png)

8. Imposta una scadenza lunga. Senza un token valido, Elemento perde l’accesso all’account.
9. Copia il token per Electros.

## Completa in Electros

1. **Connections** → **Add Provider** → **Private** → **UpCloud**.
2. Inserisci username, password e token API come richiesto dal modulo.
3. **Conclude**, poi abilita il target in **Active Connections**.
