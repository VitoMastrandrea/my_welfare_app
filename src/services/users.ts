import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { multiFactor, type User } from 'firebase/auth';
import { db } from '../firebase';
import { SITUAZIONE_FAMILIARE_VUOTA, type Ruolo, type Utente } from '../types';
import { calcolaBenefit } from './benefits';

export const UTENTI = 'users';

const regexCF = /^[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]$/;

/** Valida il formato del codice fiscale (16 caratteri alfanumerici). */
export function validaCF(cf: string): boolean {
  return regexCF.test(cf.trim());
}

export function normalizzaCF(cf: string): string {
  return cf.trim().toUpperCase();
}

function mappaUtente(id: string, dati: Record<string, unknown>): Utente {
  const situazioneFamiliare = {
    ...SITUAZIONE_FAMILIARE_VUOTA,
    ...((dati.situazioneFamiliare as object) ?? {}),
  } as Utente['situazioneFamiliare'];

  return {
    uid: id,
    nome: (dati.nome as string) ?? '',
    cognome: (dati.cognome as string) ?? '',
    cf: (dati.cf as string) ?? '',
    nTelefono: (dati.nTelefono as string) ?? '',
    creditoResiduo: Number(dati.creditoResiduo ?? 0),
    ruolo: ((dati.ruolo as Ruolo) === 'admin' ? 'admin' : 'user'),
    email: (dati.email as string) ?? '',
    photoURL: (dati.photoURL as string) ?? '',
    situazioneFamiliare,
    livelloBenefit: Number(dati.livelloBenefit ?? 0),
    creditoMassimo: Number(dati.creditoMassimo ?? 0),
    mfaAttiva: Boolean(dati.mfaAttiva),
    mfaSaltata: Boolean(dati.mfaSaltata),
    createdAt: dati.createdAt,
    updatedAt: dati.updatedAt,
  };
}

export function riferimentoUtente(uid: string) {
  return doc(db, UTENTI, uid);
}

export async function leggiUtente(uid: string): Promise<Utente | null> {
  const istantanea = await getDoc(riferimentoUtente(uid));
  return istantanea.exists() ? mappaUtente(istantanea.id, istantanea.data()) : null;
}

export interface DatiRegistrazione {
  nome: string;
  cognome: string;
  cf: string;
  nTelefono?: string;
}

/**
 * Crea il documento utente se non esiste ancora (login Google o registrazione
 * e-mail). Il ruolo iniziale e' sempre `user`: solo un admin puo' promuovere.
 */
export async function creaUtenteSeMancante(utenteAuth: User, dati: DatiRegistrazione): Promise<Utente> {
  const riferimento = riferimentoUtente(utenteAuth.uid);
  const istantanea = await getDoc(riferimento);
  if (istantanea.exists()) return mappaUtente(istantanea.id, istantanea.data());

  const nuovo = {
    nome: dati.nome.trim(),
    cognome: dati.cognome.trim(),
    cf: normalizzaCF(dati.cf),
    nTelefono: dati.nTelefono?.trim() ?? '',
    creditoResiduo: 0,
    ruolo: 'user' as Ruolo,
    email: utenteAuth.email ?? '',
    photoURL: utenteAuth.photoURL ?? '',
    situazioneFamiliare: SITUAZIONE_FAMILIARE_VUOTA,
    livelloBenefit: 0,
    creditoMassimo: 0,
    mfaAttiva: multiFactor(utenteAuth).enrolledFactors.length > 0,
    mfaSaltata: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(riferimento, nuovo);
  return mappaUtente(utenteAuth.uid, nuovo);
}

export async function aggiornaUtente(uid: string, modifiche: Partial<Utente>): Promise<void> {
  const payload: Record<string, unknown> = { ...modifiche, updatedAt: serverTimestamp() };
  delete payload.uid;

  if (modifiche.cf) payload.cf = normalizzaCF(modifiche.cf);

  if (modifiche.situazioneFamiliare) {
    const esito = calcolaBenefit(modifiche.situazioneFamiliare);
    payload.livelloBenefit = esito.livello;
    payload.creditoMassimo = esito.creditoMassimo;
  }

  await updateDoc(riferimentoUtente(uid), payload);
}

/** Imposta il saldo a un valore preciso (icona "dollaro" lato admin). */
export async function impostaSaldo(uid: string, nuovoSaldo: number): Promise<void> {
  await updateDoc(riferimentoUtente(uid), {
    creditoResiduo: Math.round(Math.max(0, nuovoSaldo) * 100) / 100,
    updatedAt: serverTimestamp(),
  });
}

/** Ricarica il saldo aggiungendo un importo a quello attuale. */
export async function ricaricaSaldo(uid: string, importo: number): Promise<number> {
  const utente = await leggiUtente(uid);
  if (!utente) throw new Error('Utente non trovato.');
  const nuovoSaldo = Math.round((utente.creditoResiduo + importo) * 100) / 100;
  if (nuovoSaldo < 0) throw new Error('Il saldo non puo diventare negativo.');
  await impostaSaldo(uid, nuovoSaldo);
  return nuovoSaldo;
}

export async function cambiaRuolo(uid: string, ruolo: Ruolo): Promise<void> {
  await updateDoc(riferimentoUtente(uid), { ruolo, updatedAt: serverTimestamp() });
}

/**
 * Elimina il profilo utente e le sue selezioni. L'account Firebase Auth
 * corrispondente va rimosso dalla console (richiede l'Admin SDK).
 */
export async function eliminaUtente(uid: string): Promise<void> {
  const selezioni = await getDocs(collection(db, UTENTI, uid, 'selections'));
  if (!selezioni.empty) {
    const lotto = writeBatch(db);
    selezioni.forEach((documento) => lotto.delete(documento.ref));
    await lotto.commit();
  }
  await deleteDoc(riferimentoUtente(uid));
}

/** Ascolta in tempo reale l'elenco completo degli utenti (solo admin). */
export function ascoltaUtenti(
  alCambiamento: (utenti: Utente[]) => void,
  inErrore: (errore: Error) => void,
) {
  const richiesta = query(collection(db, UTENTI), orderBy('cognome'), orderBy('nome'));
  return onSnapshot(
    richiesta,
    (istantanea) => alCambiamento(istantanea.docs.map((d) => mappaUtente(d.id, d.data()))),
    inErrore,
  );
}

/** Ascolta in tempo reale il singolo profilo utente. */
export function ascoltaUtente(
  uid: string,
  alCambiamento: (utente: Utente | null) => void,
  inErrore?: (errore: Error) => void,
) {
  return onSnapshot(
    riferimentoUtente(uid),
    (istantanea) => alCambiamento(istantanea.exists() ? mappaUtente(istantanea.id, istantanea.data()) : null),
    inErrore,
  );
}
