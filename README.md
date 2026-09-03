# Welfare Aziendale

Web app per la gestione del welfare aziendale: utenze, saldi e attivita'
selezionabili dai dipendenti. Interfaccia in **Material Design 3** (tema chiaro
e scuro), autenticazione e persistenza su **Firebase**.

Stack: React 19 + TypeScript + Vite, Firebase Auth / Firestore / Storage,
design system MD3 scritto su misura (token, elevazioni, state layer).

---

## Strutture dati

### UTENTE — collezione `users/{uid}`

| Campo | Tipo | Note |
| --- | --- | --- |
| `nome` | stringa | |
| `cognome` | stringa | |
| `cf` | stringa | **chiave primaria logica**, 16 caratteri validati |
| `nTelefono` | stringa | usato anche come secondo fattore |
| `creditoResiduo` | float | saldo welfare disponibile |
| `ruolo` | `admin` \| `user` | modificabile solo da un admin |
| `email`, `photoURL` | stringa | |
| `situazioneFamiliare` | oggetto | stato civile, figli, familiari a carico, ISEE, anzianita' |
| `livelloBenefit`, `creditoMassimo` | numero | calcolati dalla situazione familiare |
| `mfaAttiva` | booleano | secondo fattore registrato |

Il documento e' indicizzato per `uid` di Firebase Auth perche' e' l'unica chiave
che le regole di sicurezza possono confrontare con `request.auth.uid`; il codice
fiscale resta la chiave primaria applicativa ed e' obbligatorio in registrazione.

### ATTIVITA' — collezione `activities/{slug(nome)}`

| Campo | Tipo | Note |
| --- | --- | --- |
| `nome` | stringa | **chiave primaria**: e' lo slug usato come id del documento |
| `descrizione` | stringa | |
| `tipologia` | `lezione` \| `voucher` \| `abbonamento` | |
| `costoUnitario` | float | |
| `limitePerUtente` | intero | massimo acquistabile per utente, `0` = illimitato |

Usare il nome come id garantisce il vincolo richiesto: **ogni attivita' puo'
essere inserita una sola volta**.

### SELEZIONI — sotto-collezione `users/{uid}/selections/{attivitaId}`

Aggrega per attivita' la quantita' acquistata (`quantita`, `spesaTotale`,
`costoUnitario` congelato al momento dell'acquisto).

---

## Ruoli e permessi

**USER**
- gestisce i propri dati anagrafici e la situazione familiare, da cui l'app
  calcola il **livello di benefit** (1-5) e il plafond teorico;
- vede foto profilo, nome, saldo e attivita' selezionate;
- acquista attivita' entro il credito residuo e i limiti impostati dall'admin.

**ADMIN** (e' anche uno user, con la stessa dashboard)
- gestisce tutti gli utenti: dati, ruolo, eliminazione;
- modifica e ricarica il saldo di ogni utente;
- crea, modifica ed elimina le attivita' selezionabili.

---

## Mappa pagine → codice

| Pagina della specifica | Rotta | File |
| --- | --- | --- |
| 1 · Login / Registrazione (Google, e-mail, 2FA SMS) | `/login` | `src/pages/LoginPage.tsx` |
| 2 · Dashboard USER | `/` | `src/pages/DashboardPage.tsx` |
| 3 · Dashboard ADMIN (stessa pagina + pulsanti Utenti/Attivita') | `/` | `src/pages/DashboardPage.tsx` |
| 4 · Pop-up "Scegli attivita'" | dialog | `src/components/DialogoScegliAttivita.tsx` |
| 5 · Utenti (ADMIN) | `/admin/utenti` | `src/pages/AdminUtentiPage.tsx` |
| 6 · Attivita' (ADMIN) | `/admin/attivita` | `src/pages/AdminAttivitaPage.tsx` |

Logica di dominio: `src/services/` (utenti, attivita', acquisti transazionali,
calcolo benefit, foto profilo, traduzione errori Firebase).

---

## Come si usa

### A. Prova in locale in 5 minuti (senza progetto Firebase)

Serve **Node.js 20.19+ oppure 22.12+** (consigliata la LTS 22.x): npm e' incluso
nell'installazione di Node, non va installato a parte. Su Windows:
`winget install OpenJS.NodeJS.LTS`, poi riapri il prompt e controlla con
`node -v` e `npm -v`. Tutto gira sugli emulatori Firebase: nessun SMS o e-mail
viene realmente inviato e nessun dato esce dal tuo computer.

```bash
npm install
npm run emulators        # terminale 1: auth, firestore e storage locali
npm run dev:emulatori    # terminale 2: app su http://localhost:5173
```

`dev:emulatori` usa il file versionato `.env.emulatori`: per la prova in locale
non serve creare ne' modificare alcun `.env`. Su Windows apri semplicemente due
finestre del Prompt dei comandi, una per ciascun comando.

**Prerequisiti**: oltre a Node serve un **JDK 21 o superiore**, richiesto dagli
emulatori Firestore e Storage (`winget install Microsoft.OpenJDK.21` su Windows,
`brew install openjdk@21` su macOS). Le versioni di Java precedenti alla 21 non
sono piu' supportate da firebase-tools 15.

1. Apri http://localhost:5173 e scegli **Registrati**: nome, cognome, codice
   fiscale, e-mail e password.
2. L'app chiede di **confermare l'e-mail**. Il messaggio non parte davvero: nel
   terminale degli emulatori compare la riga

   ```
   i  To verify the email address tuo@indirizzo, follow this link: http://127.0.0.1:9099/emulator/action?mode=verifyEmail&...
   ```

   Aprila nel browser, torna sull'app e premi *Ho verificato l e-mail*.
3. Inserisci un numero in formato internazionale (es. `+393401234567`) per la
   **verifica in due passaggi**. Il codice compare nello stesso terminale:

   ```
   i  To verify the phone number +393401234567, use the code 564715.
   ```

   Confermalo e sei nella dashboard.
4. Il primo utente nasce come `user` con credito 0. Per renderlo amministratore
   e popolare il catalogo:

   ```bash
   npm run seed
   ```

   Promuove ad ADMIN il primo utente registrato, gli accredita 500 euro e crea
   tre attivita' di esempio (lezione, abbonamento, voucher). Ricarica la pagina.

### B. Uso con un progetto Firebase reale

Segui la sezione *Configurazione Firebase* qui sotto, poi compila `.env` con
`VITE_USE_EMULATORS=false` e i valori del tuo progetto. In produzione il primo
amministratore si promuove dalla console (Firestore → `users` → il tuo documento
→ `ruolo` = `admin`): `npm run seed` funziona solo con gli emulatori.

Per pubblicare l'app:

```bash
npm run build
npx firebase deploy --only hosting,firestore:rules,firestore:indexes
```

### C. Percorso d'uso tipico

**Come ADMIN**

1. Dashboard → pulsante **Attivita** → FAB `+` per creare il catalogo. Per ogni
   attivita': nome (unico), descrizione, tipologia (lezione / voucher /
   abbonamento), costo unitario e limite per utente (`0` = illimitato).
   Toccando una riga compaiono le tre icone: matita (modifica tutto),
   pattumiera (elimina), dollaro (cambia solo il costo).
2. Dashboard → pulsante **Utenti** → tocca un utente per far comparire le tre
   icone: matita (dati anagrafici e ruolo), pattumiera (elimina), dollaro
   (**Ricarica** aggiunge credito, **Imposta saldo** lo sostituisce).
3. Da qui promuovi altri colleghi ad `admin` e assegni il welfare annuale.

**Come USER**

1. **I miei dati** → compila la situazione familiare (stato civile, figli,
   familiari a carico, ISEE, anzianita'): l'app calcola in tempo reale il
   livello di benefit 1-5 e il plafond teorico.
2. FAB `+` **Scegli attivita** → il pulsante `+` di ogni riga incrementa il
   contatore e scala subito il saldo previsto. Se il credito non basta o si
   supera il limite per utente compare un messaggio rosso e la selezione viene
   bloccata.
3. **CONFERMA** scala il credito in transazione e le attivita' compaiono nella
   dashboard; **CANCELLA** annulla tutto.
4. La foto profilo si cambia cliccandoci sopra, direttamente dalla dashboard.

---

## Flusso di accesso (Pagina 1)

```
Google  ──► profilo mancante? ──► Nome/Cognome/CF ──┐
                                                     ├──► verifica e-mail ──► 2FA via SMS ──► Dashboard
E-mail  ──► Nome/Cognome/CF + password ─────────────┘
```

- Il **codice fiscale** e' obbligatorio alla prima registrazione (formato validato)
  e viene richiesto anche a chi entra con Google la prima volta.
- Firebase consente di registrare un secondo fattore **solo con l'indirizzo
  e-mail verificato**: l'app invia il link di conferma e attende l'esito prima
  di passare all'SMS. Gli account Google hanno gia' l'e-mail verificata.
- Finche' il secondo fattore non e' registrato le pagine protette rimandano al
  login: l'accesso alla dashboard avviene solo a verifica completata.
- Se il progetto Firebase non ha l'MFA attiva l'app lo rileva, spiega il motivo
  e permette di proseguire; la scelta resta tracciata in `mfaSaltata`.

---

## Sviluppo con la Firebase Emulator Suite

Per lavorare senza toccare un progetto reale (auth, database e storage locali):

```bash
npm run emulators                      # avvia auth, firestore e storage
VITE_USE_EMULATORS=true npm run dev    # oppure imposta la variabile in .env
```

Con gli emulatori l'e-mail di verifica e i codici SMS non vengono realmente
inviati: link e codici sono leggibili nei log dell'emulatore e nella Emulator UI
su http://127.0.0.1:4000.

---

## Configurazione Firebase

1. **Crea il progetto** su [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method**: abilita *Google* e *E-mail/password*.
3. **Verifica in due passaggi**: in *Authentication → Advanced → SMS multi-factor
   authentication* attiva l'MFA via SMS (richiede l'upgrade a Identity Platform)
   e aggiungi i domini autorizzati. Se l'MFA non e' attiva l'app lo rileva,
   mostra un messaggio e consente di proseguire salvando comunque il numero.
4. **Firestore Database**: crea il database e pubblica le regole di questo repo:
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```
5. **Storage** (opzionale): serve solo per le foto profilo. Senza bucket l'app
   comprime l'immagine a 320x320 e la salva come data URL nel documento utente.
6. Copia `.env.example` in `.env` e compila i valori della configurazione SDK.

### Primo amministratore

Per sicurezza le regole impediscono a chiunque di auto-assegnarsi il ruolo
`admin`: ogni registrazione crea un utente con `ruolo: "user"` e credito `0`.
Dopo la prima registrazione apri **Firestore → users → il tuo documento** e
imposta manualmente `ruolo` a `admin`. Da quel momento l'admin promuove gli
altri utenti dalla pagina *Utenti*.

---

## Comandi

```bash
npm install       # dipendenze
npm run dev       # sviluppo su http://localhost:5173
npm run dev:emulatori # sviluppo collegato agli emulatori locali
npm run emulators # Firebase Auth, Firestore e Storage in locale
npm run seed      # promuove ad admin il primo utente e crea attivita demo (solo emulatori)
npm run build     # build di produzione in dist/
npm run preview   # anteprima della build
npm start         # serve dist/ come in produzione (porta da PORT, default 3000)
npm run lint      # analisi statica (oxlint)
```

---

## Problemi comuni su Windows

**`npm : Impossibile caricare il file ...\npm.ps1. L'esecuzione di script e' disabilitata`**

PowerShell blocca per impostazione predefinita gli script `.ps1`, incluso il
wrapper di npm. Due strade:

- senza cambiare nulla nel sistema, usa l'eseguibile `.cmd` (oppure il classico
  Prompt dei comandi, dove il problema non si presenta):

  ```powershell
  npm.cmd install
  npm.cmd run dev:emulatori
  ```

- oppure abilita gli script per il solo utente corrente (non serve
  l'amministratore), poi riapri PowerShell:

  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

  `RemoteSigned` consente gli script locali e richiede la firma solo per quelli
  scaricati da internet. Se un criterio aziendale impedisce la modifica, resta
  valida la prima strada.

**`npm error code ENOENT ... Could not read package.json`**

Il comando e' stato lanciato fuori dalla cartella del progetto: entra prima con
`cd` nella cartella che contiene `package.json`.

**`"firebase" non e' riconosciuto come comando`**

Significa che `npm install` non e' arrivato in fondo: `firebase-tools` e' una
dipendenza di sviluppo del progetto, non un programma da installare a parte.
Controlla con `dir node_modules\firebase-tools` (Windows) o
`ls node_modules/firebase-tools`; se la cartella manca rilancia `npm install`
dalla cartella del progetto e leggi le ultime righe dell'output.

**`firebase-tools no longer supports Java version before 21`**

Gli emulatori Firestore e Storage girano sulla JVM e firebase-tools 15 richiede
un **JDK 21+**: installalo con `winget install Microsoft.OpenJDK.21` e riapri il
terminale. Se `java -version` continua a mostrare una versione precedente, hai
un vecchio Java che ha la precedenza nel PATH: sposta piu' in alto la voce del
nuovo JDK nelle variabili d'ambiente, oppure imposta `JAVA_HOME` sulla sua
cartella.

**`node` o `npm` non riconosciuti dopo l'installazione**

Il PATH viene letto all'avvio del terminale: chiudi e riapri la finestra. Se non
basta, verifica che `C:\Program Files\nodejs\` sia nella variabile PATH.

---

## Deploy su Railway

L'app e' una SPA statica: Railway la compila e ne serve la cartella `dist/`,
mentre autenticazione e database restano su Firebase. Nel repo trovi gia'
`railway.json` (build e start command) e `scripts/serve-statico.mjs`, un server
statico senza dipendenze con fallback SPA — indispensabile perche' rotte come
`/admin/utenti`, aperte direttamente, tornino `index.html` invece di un 404.

1. Serve un **progetto Firebase reale**: gli emulatori girano solo in locale.
   Completa prima la sezione *Configurazione Firebase*.
2. Su [railway.app](https://railway.app): *New Project* → *Deploy from GitHub
   repo* → scegli questo repository e il branch da pubblicare.
3. In *Variables* aggiungi le sei variabili del progetto Firebase:

   ```
   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
   VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
   VITE_FIREBASE_APP_ID
   ```

   > **Attenzione**: Vite legge le variabili `VITE_*` durante la **build**, non
   > all'avvio. Se le aggiungi dopo il primo deploy devi rilanciarlo, altrimenti
   > l'app resta compilata senza credenziali e mostra "Configurazione mancante".
   > Non impostare `VITE_USE_EMULATORS`: in produzione deve restare assente.

4. *Settings* → *Networking* → **Generate Domain**: Railway espone il servizio
   sulla porta della variabile `PORT`, che il server statico legge da solo.
5. Nella console Firebase, *Authentication* → *Settings* → **Domini autorizzati**:
   aggiungi il dominio Railway (es. `mio-welfare.up.railway.app`), altrimenti
   il login con Google viene rifiutato.
6. Le regole Firestore non passano da Railway: pubblicale a parte con
   `npx firebase deploy --only firestore:rules,firestore:indexes`.

Per provare la build di produzione in locale, esattamente come gira su Railway:

```bash
npm run build
npm start          # http://localhost:3000
```

---

## Note di sicurezza

- L'acquisto delle attivita' avviene in una **transazione Firestore**: costo e
  limite per utente vengono riletti dal database, mai dal client, e il credito
  viene scalato in modo atomico. Se il credito non basta o si supera il limite
  l'intera operazione viene annullata.
- Le regole (`firestore.rules`) impediscono a un utente di cambiare il proprio
  ruolo o di **aumentare** il proprio credito: puo' solo consumarlo.
- Per un controllo totale lato server (l'utente potrebbe comunque decrementare
  il proprio saldo senza acquistare) il passo successivo e' spostare la conferma
  dell'acquisto in una Cloud Function con Admin SDK.
- `eliminaUtente` rimuove profilo e selezioni da Firestore; la cancellazione
  dell'account Firebase Auth richiede l'Admin SDK e va fatta da console.

---

## Verifiche eseguite

Il flusso completo e' stato provato end-to-end contro la Firebase Emulator Suite
(browser reale, nessun mock): registrazione e-mail, verifica dell'indirizzo,
iscrizione del secondo fattore via SMS, blocco delle rotte admin per uno user,
calcolo del livello di benefit, promozione ad admin, creazione delle attivita'
con rifiuto del duplicato, acquisto transazionale con limite per utente e
credito insufficiente, ricarica del saldo e nuovo login con codice SMS.
