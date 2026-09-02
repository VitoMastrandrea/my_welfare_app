import { useEffect, useMemo, useState } from 'react';
import { Bottone, ChipTipologia, Dialog, IconBottone, StatoVuoto, BannerErrore } from './md3';
import { formattaEuro } from '../services/benefits';
import { confermaAcquisto } from '../services/selections';
import { messaggioErrore } from '../services/errors';
import { useSnackbar } from '../context/SnackbarContext';
import type { Attivita, Selezione } from '../types';

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  uid: string;
  saldo: number;
  attivita: Attivita[];
  selezioni: Selezione[];
}

/**
 * Pagina 4 - pop-up "Scegli attivita".
 * Ogni riga ha un pulsante "+" che incrementa il contatore e scala il saldo
 * previsto; quando il credito o il limite per utente non lo consentono la UI
 * mostra un messaggio d'errore rosso a due tonalita'.
 */
export function DialogoScegliAttivita({ aperto, onChiudi, uid, saldo, attivita, selezioni }: Props) {
  const [quantita, setQuantita] = useState<Record<string, number>>({});
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const { mostraErrore, mostraSuccesso } = useSnackbar();

  useEffect(() => {
    if (aperto) {
      setQuantita({});
      setErrore('');
    }
  }, [aperto]);

  const giaAcquistate = useMemo(() => {
    const mappa: Record<string, number> = {};
    selezioni.forEach((selezione) => {
      mappa[selezione.attivitaId] = selezione.quantita;
    });
    return mappa;
  }, [selezioni]);

  const totale = useMemo(
    () =>
      Math.round(
        attivita.reduce((somma, corrente) => somma + (quantita[corrente.id] ?? 0) * corrente.costoUnitario, 0) * 100,
      ) / 100,
    [attivita, quantita],
  );

  const residuo = Math.round((saldo - totale) * 100) / 100;

  const incrementa = (corrente: Attivita) => {
    const selezionate = quantita[corrente.id] ?? 0;
    const possedute = giaAcquistate[corrente.id] ?? 0;
    const limite = corrente.limitePerUtente;

    if (limite > 0 && possedute + selezionate + 1 > limite) {
      setErrore(
        `Hai raggiunto il limite di ${limite} per "${corrente.nome}" (ne possiedi gia ${possedute}).`,
      );
      return;
    }
    if (corrente.costoUnitario > residuo) {
      setErrore(
        `Credito insufficiente per aggiungere "${corrente.nome}": servono ${formattaEuro(
          corrente.costoUnitario,
        )} e ti restano ${formattaEuro(residuo)}.`,
      );
      return;
    }

    setErrore('');
    setQuantita({ ...quantita, [corrente.id]: selezionate + 1 });
  };

  const decrementa = (corrente: Attivita) => {
    const selezionate = quantita[corrente.id] ?? 0;
    if (selezionate === 0) return;
    setErrore('');
    setQuantita({ ...quantita, [corrente.id]: selezionate - 1 });
  };

  const conferma = async () => {
    setErrore('');
    const righe = attivita
      .filter((corrente) => (quantita[corrente.id] ?? 0) > 0)
      .map((corrente) => ({ attivita: corrente, quantita: quantita[corrente.id] }));

    if (righe.length === 0) {
      setErrore('Seleziona almeno un attivita prima di confermare.');
      return;
    }

    setInCorso(true);
    try {
      const nuovoSaldo = await confermaAcquisto(uid, righe);
      mostraSuccesso(`Attivita confermate. Nuovo saldo: ${formattaEuro(nuovoSaldo)}.`);
      onChiudi();
    } catch (eccezione) {
      const testo = messaggioErrore(eccezione);
      setErrore(testo);
      mostraErrore(testo);
    } finally {
      setInCorso(false);
    }
  };

  return (
    <Dialog
      aperto={aperto}
      titolo="Scegli le attivita"
      descrizione="Aggiungi le attivita al tuo piano welfare: il saldo si aggiorna a ogni selezione."
      onChiudi={inCorso ? () => undefined : onChiudi}
      azioni={
        <>
          <Bottone variante="text" onClick={onChiudi} disabled={inCorso}>
            Cancella
          </Bottone>
          <Bottone onClick={conferma} disabled={inCorso || totale === 0} icona="check">
            Conferma
          </Bottone>
        </>
      }
    >
      <div className="md-stack">
        <div className="md-card md-card--primary">
          <div className="md-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="md-label-medium">Saldo dopo la conferma</div>
              <div className="md-headline-small">{formattaEuro(residuo)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="md-label-medium">Totale selezione</div>
              <div className="md-title-medium">{formattaEuro(totale)}</div>
            </div>
          </div>
          <div className="md-progress" style={{ marginTop: 12 }}>
            <div
              className="md-progress__bar"
              style={{ width: `${saldo > 0 ? Math.min(100, (totale / saldo) * 100) : 0}%` }}
            />
          </div>
        </div>

        {errore && <BannerErrore testo={errore} />}

        {attivita.length === 0 ? (
          <StatoVuoto
            icona="inventory_2"
            titolo="Nessuna attivita disponibile"
            testo="L amministratore non ha ancora creato attivita selezionabili."
          />
        ) : (
          <div className="md-stack" style={{ gap: 8 }}>
            {attivita.map((corrente) => {
              const selezionate = quantita[corrente.id] ?? 0;
              const possedute = giaAcquistate[corrente.id] ?? 0;
              const limiteRaggiunto =
                corrente.limitePerUtente > 0 && possedute + selezionate >= corrente.limitePerUtente;
              const creditoInsufficiente = corrente.costoUnitario > residuo;

              return (
                <div
                  key={corrente.id}
                  className={`md-activity-row ${selezionate > 0 ? 'md-activity-row--active' : ''} ${
                    limiteRaggiunto || creditoInsufficiente ? 'md-activity-row--blocked' : ''
                  }`}
                >
                  <div className="md-activity-row__texts">
                    <div className="md-row" style={{ gap: 8 }}>
                      <span className="md-title-small">{corrente.nome}</span>
                      <ChipTipologia tipologia={corrente.tipologia} />
                    </div>
                    <div className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {formattaEuro(corrente.costoUnitario)} per unita
                      {corrente.limitePerUtente > 0
                        ? ` - max ${corrente.limitePerUtente} per utente (possiedi ${possedute})`
                        : ' - nessun limite'}
                    </div>
                  </div>

                  {selezionate > 0 && (
                    <IconBottone
                      icona="remove"
                      etichetta={`Rimuovi una unita di ${corrente.nome}`}
                      piccolo
                      onClick={() => decrementa(corrente)}
                    />
                  )}
                  <span className="md-chip md-chip--counter">{selezionate}</span>
                  <IconBottone
                    icona="add"
                    etichetta={`Aggiungi ${corrente.nome}`}
                    variante="tonal"
                    onClick={() => incrementa(corrente)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
