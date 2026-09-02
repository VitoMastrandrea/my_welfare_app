import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ATTIVITA } from './activities';
import { UTENTI } from './users';
import type { RigaCarrello, Selezione, TipologiaAttivita } from '../types';

export const SELEZIONI = 'selections';

function mappaSelezione(id: string, dati: Record<string, unknown>): Selezione {
  return {
    id,
    attivitaId: (dati.attivitaId as string) ?? id,
    nome: (dati.nome as string) ?? '',
    tipologia: (dati.tipologia as TipologiaAttivita) ?? 'lezione',
    costoUnitario: Number(dati.costoUnitario ?? 0),
    quantita: Number(dati.quantita ?? 0),
    spesaTotale: Number(dati.spesaTotale ?? 0),
    updatedAt: dati.updatedAt,
  };
}

/** Ascolta le attivita' selezionate da un utente. */
export function ascoltaSelezioni(
  uid: string,
  alCambiamento: (selezioni: Selezione[]) => void,
  inErrore?: (errore: Error) => void,
) {
  const richiesta = query(collection(db, UTENTI, uid, SELEZIONI), orderBy('nome'));
  return onSnapshot(
    richiesta,
    (istantanea) => alCambiamento(istantanea.docs.map((d) => mappaSelezione(d.id, d.data()))),
    inErrore,
  );
}

export class ErroreAcquisto extends Error {}

/**
 * Conferma il carrello del pop-up "Scegli attivita".
 *
 * Tutto avviene dentro una transazione Firestore: costi e limiti vengono
 * riletti dal database (mai dal client), il credito viene verificato e
 * scalato in modo atomico. Se il credito non basta o un limite per utente
 * viene superato l'intera operazione viene annullata.
 */
export async function confermaAcquisto(uid: string, righe: RigaCarrello[]): Promise<number> {
  const daAcquistare = righe.filter((riga) => riga.quantita > 0);
  if (daAcquistare.length === 0) {
    throw new ErroreAcquisto('Non hai selezionato nessuna attivita.');
  }

  return runTransaction(db, async (transazione) => {
    const riferimentoUtente = doc(db, UTENTI, uid);
    const istantaneaUtente = await transazione.get(riferimentoUtente);
    if (!istantaneaUtente.exists()) {
      throw new ErroreAcquisto('Profilo utente non trovato.');
    }

    const creditoAttuale = Number(istantaneaUtente.data().creditoResiduo ?? 0);

    // Tutte le letture prima di qualunque scrittura (vincolo Firestore).
    const letture = await Promise.all(
      daAcquistare.map(async (riga) => ({
        riga,
        attivita: await transazione.get(doc(db, ATTIVITA, riga.attivita.id)),
        selezione: await transazione.get(doc(db, UTENTI, uid, SELEZIONI, riga.attivita.id)),
      })),
    );

    let totale = 0;
    const scritture: { id: string; dati: Record<string, unknown> }[] = [];

    for (const { riga, attivita, selezione } of letture) {
      if (!attivita.exists()) {
        throw new ErroreAcquisto(`L attivita "${riga.attivita.nome}" non e piu disponibile.`);
      }

      const dati = attivita.data();
      const costoUnitario = Number(dati.costoUnitario ?? 0);
      const limite = Number(dati.limitePerUtente ?? 0);
      const gia = Number(selezione.exists() ? selezione.data().quantita ?? 0 : 0);
      const nuovaQuantita = gia + riga.quantita;

      if (limite > 0 && nuovaQuantita > limite) {
        throw new ErroreAcquisto(
          `Limite raggiunto per "${dati.nome}": massimo ${limite} per utente (ne hai gia ${gia}).`,
        );
      }

      totale += costoUnitario * riga.quantita;
      scritture.push({
        id: riga.attivita.id,
        dati: {
          attivitaId: riga.attivita.id,
          nome: dati.nome,
          tipologia: dati.tipologia,
          costoUnitario,
          quantita: nuovaQuantita,
          spesaTotale: Math.round(costoUnitario * nuovaQuantita * 100) / 100,
          updatedAt: serverTimestamp(),
        },
      });
    }

    totale = Math.round(totale * 100) / 100;
    if (totale > creditoAttuale) {
      throw new ErroreAcquisto(
        'Credito insufficiente: il totale supera il saldo residuo disponibile.',
      );
    }

    const nuovoCredito = Math.round((creditoAttuale - totale) * 100) / 100;
    transazione.update(riferimentoUtente, { creditoResiduo: nuovoCredito, updatedAt: serverTimestamp() });

    for (const scrittura of scritture) {
      transazione.set(doc(db, UTENTI, uid, SELEZIONI, scrittura.id), scrittura.dati, { merge: true });
    }

    return nuovoCredito;
  });
}
