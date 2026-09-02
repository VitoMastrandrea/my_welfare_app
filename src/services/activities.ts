import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Attivita, TipologiaAttivita } from '../types';

export const ATTIVITA = 'activities';

/**
 * Il nome e' la chiave primaria: viene trasformato in slug e usato come id
 * del documento, cosi' la stessa attivita' non puo' essere inserita due volte.
 */
export function slugAttivita(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mappaAttivita(id: string, dati: Record<string, unknown>): Attivita {
  return {
    id,
    nome: (dati.nome as string) ?? '',
    descrizione: (dati.descrizione as string) ?? '',
    tipologia: (dati.tipologia as TipologiaAttivita) ?? 'lezione',
    costoUnitario: Number(dati.costoUnitario ?? 0),
    limitePerUtente: Number(dati.limitePerUtente ?? 0),
    createdAt: dati.createdAt,
    updatedAt: dati.updatedAt,
  };
}

export interface DatiAttivita {
  nome: string;
  descrizione: string;
  tipologia: TipologiaAttivita;
  costoUnitario: number;
  limitePerUtente: number;
}

export async function creaAttivita(dati: DatiAttivita): Promise<Attivita> {
  const nome = dati.nome.trim();
  if (!nome) throw new Error('Il nome dell attivita e obbligatorio.');
  if (dati.costoUnitario <= 0) throw new Error('Il costo unitario deve essere maggiore di zero.');

  const id = slugAttivita(nome);
  if (!id) throw new Error('Il nome dell attivita non e valido.');

  const riferimento = doc(db, ATTIVITA, id);
  const esistente = await getDoc(riferimento);
  if (esistente.exists()) {
    throw new Error(`L attivita "${nome}" esiste gia: ogni attivita puo essere inserita una sola volta.`);
  }

  const nuova = {
    nome,
    descrizione: dati.descrizione.trim(),
    tipologia: dati.tipologia,
    costoUnitario: Math.round(dati.costoUnitario * 100) / 100,
    limitePerUtente: Math.max(0, Math.floor(dati.limitePerUtente)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(riferimento, nuova);
  return mappaAttivita(id, nuova);
}

/**
 * Aggiorna un'attivita' esistente. Se cambia il nome cambia anche la chiave
 * primaria: il documento viene ricreato con il nuovo id e quello vecchio
 * eliminato, verificando che il nuovo nome non sia gia' occupato.
 */
export async function aggiornaAttivita(id: string, dati: DatiAttivita): Promise<string> {
  const nome = dati.nome.trim();
  if (!nome) throw new Error('Il nome dell attivita e obbligatorio.');
  if (dati.costoUnitario <= 0) throw new Error('Il costo unitario deve essere maggiore di zero.');

  const nuovoId = slugAttivita(nome);
  const payload = {
    nome,
    descrizione: dati.descrizione.trim(),
    tipologia: dati.tipologia,
    costoUnitario: Math.round(dati.costoUnitario * 100) / 100,
    limitePerUtente: Math.max(0, Math.floor(dati.limitePerUtente)),
    updatedAt: serverTimestamp(),
  };

  if (nuovoId === id) {
    await updateDoc(doc(db, ATTIVITA, id), payload);
    return id;
  }

  const occupato = await getDoc(doc(db, ATTIVITA, nuovoId));
  if (occupato.exists()) {
    throw new Error(`Esiste gia un attivita chiamata "${nome}".`);
  }

  const precedente = await getDoc(doc(db, ATTIVITA, id));
  await setDoc(doc(db, ATTIVITA, nuovoId), {
    ...payload,
    createdAt: precedente.data()?.createdAt ?? serverTimestamp(),
  });
  await deleteDoc(doc(db, ATTIVITA, id));
  return nuovoId;
}

/** Modifica il solo costo unitario (icona "dollaro" nella pagina Attivita'). */
export async function aggiornaCostoAttivita(id: string, costoUnitario: number): Promise<void> {
  if (costoUnitario <= 0) throw new Error('Il costo unitario deve essere maggiore di zero.');
  await updateDoc(doc(db, ATTIVITA, id), {
    costoUnitario: Math.round(costoUnitario * 100) / 100,
    updatedAt: serverTimestamp(),
  });
}

export async function eliminaAttivita(id: string): Promise<void> {
  await deleteDoc(doc(db, ATTIVITA, id));
}

export function ascoltaAttivita(
  alCambiamento: (attivita: Attivita[]) => void,
  inErrore?: (errore: Error) => void,
) {
  const richiesta = query(collection(db, ATTIVITA), orderBy('nome'));
  return onSnapshot(
    richiesta,
    (istantanea) => alCambiamento(istantanea.docs.map((d) => mappaAttivita(d.id, d.data()))),
    inErrore,
  );
}
