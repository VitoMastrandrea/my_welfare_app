import { FirebaseError } from 'firebase/app';

const MESSAGGI: Record<string, string> = {
  'auth/invalid-email': 'Indirizzo e-mail non valido.',
  'auth/user-disabled': 'Questo account e stato disabilitato.',
  'auth/user-not-found': 'Nessun account trovato con queste credenziali.',
  'auth/wrong-password': 'E-mail o password non corretti.',
  'auth/invalid-credential': 'E-mail o password non corretti.',
  'auth/email-already-in-use': 'Esiste gia un account con questa e-mail.',
  'auth/weak-password': 'La password deve contenere almeno 6 caratteri.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/popup-closed-by-user': 'Accesso con Google annullato.',
  'auth/popup-blocked': 'Il browser ha bloccato il popup di Google.',
  'auth/cancelled-popup-request': 'Accesso con Google annullato.',
  'auth/network-request-failed': 'Connessione non riuscita. Verifica la rete.',
  'auth/invalid-phone-number': 'Numero di telefono non valido. Usa il formato +39...',
  'auth/invalid-verification-code': 'Codice di verifica errato.',
  'auth/code-expired': 'Codice scaduto: richiedine uno nuovo.',
  'auth/missing-verification-code': 'Inserisci il codice ricevuto via SMS.',
  'auth/requires-recent-login': 'Per sicurezza esegui di nuovo l accesso e riprova.',
  'auth/unsupported-first-factor': 'Metodo di accesso non compatibile con la verifica in due passaggi.',
  'auth/second-factor-already-in-use': 'Questo numero e gia registrato come secondo fattore.',
  'auth/operation-not-allowed': 'Metodo di accesso non abilitato nella console Firebase.',
  'auth/admin-restricted-operation': 'Operazione non consentita dalla configurazione del progetto.',
  'permission-denied': 'Non hai i permessi necessari per questa operazione.',
  'unavailable': 'Servizio momentaneamente non raggiungibile. Riprova.',
  'failed-precondition': 'Operazione non consentita nello stato attuale dei dati.',
};

/** Traduce in italiano gli errori di Firebase mantenendo quelli applicativi. */
export function messaggioErrore(errore: unknown): string {
  if (errore instanceof FirebaseError) {
    return MESSAGGI[errore.code] ?? `Errore (${errore.code}).`;
  }
  if (errore instanceof Error && errore.message) return errore.message;
  return 'Si e verificato un errore imprevisto.';
}

/** true quando il progetto Firebase non ha l autenticazione a due fattori attiva. */
export function mfaNonDisponibile(errore: unknown): boolean {
  return (
    errore instanceof FirebaseError &&
    [
      'auth/operation-not-allowed',
      'auth/admin-restricted-operation',
      'auth/unsupported-first-factor',
      'auth/unsupported-tenant-operation',
      'auth/multi-factor-info-not-found',
    ].includes(errore.code)
  );
}
