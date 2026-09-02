import type { SituazioneFamiliare } from '../types';

export interface VoceBenefit {
  voce: string;
  punti: number;
}

export interface EsitoBenefit {
  punteggio: number;
  livello: number;
  creditoMassimo: number;
  dettagli: VoceBenefit[];
}

/** Credito massimo teorico associato a ciascun livello di benefit. */
export const CREDITO_PER_LIVELLO = [0, 250, 500, 750, 1000, 1500];

const clamp = (valore: number, max: number) => Math.min(Math.max(valore, 0), max);

/**
 * Calcola il livello di welfare accessibile a partire dalla situazione
 * familiare dichiarata dall'utente. La griglia e' volutamente esplicita:
 * l'azienda puo' modificare pesi e soglie in un unico punto.
 */
export function calcolaBenefit(situazione: SituazioneFamiliare): EsitoBenefit {
  const dettagli: VoceBenefit[] = [];

  dettagli.push({ voce: 'Quota base', punti: 100 });
  dettagli.push({ voce: 'Figli a carico', punti: clamp(situazione.numeroFigli * 15, 60) });
  dettagli.push({ voce: 'Figli minorenni', punti: clamp(situazione.figliMinori * 10, 40) });
  dettagli.push({ voce: 'Altri familiari a carico', punti: clamp(situazione.familiariACarico * 10, 40) });
  dettagli.push({ voce: 'Disabilita in famiglia', punti: situazione.disabilitaInFamiglia ? 40 : 0 });
  dettagli.push({ voce: 'Anzianita aziendale', punti: clamp(situazione.anniAnzianitaAziendale * 5, 50) });

  let puntiIsee = 0;
  if (situazione.isee > 0) {
    if (situazione.isee <= 15000) puntiIsee = 60;
    else if (situazione.isee <= 25000) puntiIsee = 40;
    else if (situazione.isee <= 35000) puntiIsee = 20;
    else if (situazione.isee <= 50000) puntiIsee = 10;
  }
  dettagli.push({ voce: 'Fascia ISEE', punti: puntiIsee });

  const punteggio = dettagli.reduce((totale, riga) => totale + riga.punti, 0);

  let livello = 1;
  if (punteggio >= 300) livello = 5;
  else if (punteggio >= 250) livello = 4;
  else if (punteggio >= 200) livello = 3;
  else if (punteggio >= 150) livello = 2;

  return { punteggio, livello, creditoMassimo: CREDITO_PER_LIVELLO[livello], dettagli };
}

/** Formatta un importo in euro con il separatore italiano. */
export function formattaEuro(valore: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
    Number.isFinite(valore) ? valore : 0,
  );
}
