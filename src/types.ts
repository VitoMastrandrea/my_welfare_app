/** Strutture dati dell'applicazione (vedi specifica). */

export type Ruolo = 'admin' | 'user';

export type TipologiaAttivita = 'lezione' | 'voucher' | 'abbonamento';

export const TIPOLOGIE: TipologiaAttivita[] = ['lezione', 'voucher', 'abbonamento'];

/** Dati usati per calcolare il livello di benefit accessibile. */
export interface SituazioneFamiliare {
  statoCivile: 'celibe/nubile' | 'coniugato/a' | 'convivente' | 'separato/a' | 'vedovo/a' | '';
  numeroFigli: number;
  familiariACarico: number;
  figliMinori: number;
  disabilitaInFamiglia: boolean;
  isee: number;
  anniAnzianitaAziendale: number;
}

export const SITUAZIONE_FAMILIARE_VUOTA: SituazioneFamiliare = {
  statoCivile: '',
  numeroFigli: 0,
  familiariACarico: 0,
  figliMinori: 0,
  disabilitaInFamiglia: false,
  isee: 0,
  anniAnzianitaAziendale: 0,
};

/**
 * UTENTE
 * cf e' la PRIMARY KEY logica; il documento Firestore e' indicizzato per uid
 * di Firebase Auth e il cf e' mantenuto univoco tramite la collezione `cfIndex`.
 */
export interface Utente {
  uid: string;
  nome: string;
  cognome: string;
  cf: string;
  nTelefono: string;
  creditoResiduo: number;
  ruolo: Ruolo;
  email: string;
  photoURL: string;
  situazioneFamiliare: SituazioneFamiliare;
  livelloBenefit: number;
  creditoMassimo: number;
  mfaAttiva: boolean;
  /** true se l utente ha proseguito senza secondo fattore (MFA non disponibile). */
  mfaSaltata: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * ATTIVITA'
 * Nome e' la PRIMARY KEY: l'id del documento e' lo slug del nome, quindi
 * non e' possibile inserire due volte la stessa attivita'.
 */
export interface Attivita {
  id: string;
  nome: string;
  descrizione: string;
  tipologia: TipologiaAttivita;
  costoUnitario: number;
  /** Numero massimo di acquisti per singolo utente (0 = nessun limite). */
  limitePerUtente: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Attivita' selezionata da un utente (aggregata per attivita'). */
export interface Selezione {
  id: string;
  attivitaId: string;
  nome: string;
  tipologia: TipologiaAttivita;
  costoUnitario: number;
  quantita: number;
  spesaTotale: number;
  updatedAt?: unknown;
}

/** Riga del carrello nel pop-up di selezione. */
export interface RigaCarrello {
  attivita: Attivita;
  quantita: number;
}
