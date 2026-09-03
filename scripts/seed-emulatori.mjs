#!/usr/bin/env node
/**
 * Prepara gli emulatori per una prova rapida del sistema:
 *  - promuove ad ADMIN il primo utente registrato e gli accredita del welfare;
 *  - crea alcune attivita' di esempio (lezione, abbonamento, voucher).
 *
 * Uso: registra un utente dall'app (npm run dev con VITE_USE_EMULATORS=true),
 * poi esegui `npm run seed`.
 *
 * Funziona SOLO con la Firebase Emulator Suite: in produzione il ruolo admin
 * va assegnato dalla console Firebase.
 */

const PROGETTO = process.env.FIREBASE_PROJECT ?? 'demo-welfare';
const FIRESTORE = process.env.FIRESTORE_EMULATOR ?? 'http://127.0.0.1:8080';
const BASE = `${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents`;
const INTESTAZIONI = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };

const CREDITO_INIZIALE = 500;

const ATTIVITA_DEMO = [
  {
    id: 'lezione-di-nuoto',
    nome: 'Lezione di nuoto',
    descrizione: 'Lezione singola in piscina convenzionata',
    tipologia: 'lezione',
    costoUnitario: 25,
    limitePerUtente: 4,
  },
  {
    id: 'abbonamento-palestra',
    nome: 'Abbonamento palestra',
    descrizione: 'Abbonamento trimestrale in palestra convenzionata',
    tipologia: 'abbonamento',
    costoUnitario: 180,
    limitePerUtente: 1,
  },
  {
    id: 'voucher-libri-scolastici',
    nome: 'Voucher libri scolastici',
    descrizione: 'Buono per l acquisto di libri di testo',
    tipologia: 'voucher',
    costoUnitario: 50,
    limitePerUtente: 0,
  },
];

async function chiama(percorso, opzioni = {}) {
  const risposta = await fetch(`${BASE}${percorso}`, { headers: INTESTAZIONI, ...opzioni });
  if (!risposta.ok) {
    throw new Error(`${risposta.status} ${risposta.statusText} su ${percorso}`);
  }
  return risposta.json();
}

async function verificaEmulatore() {
  try {
    await fetch(FIRESTORE, { signal: AbortSignal.timeout(2000) });
  } catch {
    console.error(
      `\nEmulatore Firestore non raggiungibile su ${FIRESTORE}.\n` +
        'Avvialo con `npm run emulators` e riprova.\n',
    );
    process.exit(1);
  }
}

async function promuoviPrimoUtente() {
  const elenco = await chiama('/users');
  const documenti = elenco.documents ?? [];

  if (documenti.length === 0) {
    console.log(
      '\nNessun utente registrato: apri l app, completa la registrazione ' +
        'e poi esegui di nuovo `npm run seed`.',
    );
    return null;
  }

  const primo = documenti[0];
  const uid = primo.name.split('/').pop();
  const nome = primo.fields?.nome?.stringValue ?? '';
  const cognome = primo.fields?.cognome?.stringValue ?? '';

  await chiama(
    `/users/${uid}?updateMask.fieldPaths=ruolo&updateMask.fieldPaths=creditoResiduo`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          ruolo: { stringValue: 'admin' },
          creditoResiduo: { doubleValue: CREDITO_INIZIALE },
        },
      }),
    },
  );

  console.log(`Utente promosso ad ADMIN: ${nome} ${cognome} (credito ${CREDITO_INIZIALE} euro)`);
  return uid;
}

async function creaAttivitaDemo() {
  for (const attivita of ATTIVITA_DEMO) {
    const { id, ...campi } = attivita;
    await chiama(`/activities?documentId=${id}`, {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          nome: { stringValue: campi.nome },
          descrizione: { stringValue: campi.descrizione },
          tipologia: { stringValue: campi.tipologia },
          costoUnitario: { doubleValue: campi.costoUnitario },
          limitePerUtente: { integerValue: String(campi.limitePerUtente) },
        },
      }),
    }).then(
      () => console.log(`Attivita creata: ${campi.nome}`),
      (errore) =>
        console.log(
          `Attivita "${campi.nome}" gia presente o non creata (${errore.message.split(' su ')[0]})`,
        ),
    );
  }
}

await verificaEmulatore();
await promuoviPrimoUtente();
await creaAttivitaDemo();
console.log('\nFatto: ricarica la pagina dell app per vedere ruolo, credito e attivita.\n');
