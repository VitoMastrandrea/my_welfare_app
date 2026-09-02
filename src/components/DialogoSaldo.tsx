import { useEffect, useState } from 'react';
import { Bottone, Campo, Dialog, BannerErrore } from './md3';
import { formattaEuro } from '../services/benefits';
import { impostaSaldo, ricaricaSaldo } from '../services/users';
import { messaggioErrore } from '../services/errors';
import { useSnackbar } from '../context/SnackbarContext';
import type { Utente } from '../types';

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  utente: Utente;
}

/** Icona "dollaro" della pagina Utenti: modifica o ricarica il solo saldo. */
export function DialogoSaldo({ aperto, onChiudi, utente }: Props) {
  const [modalita, setModalita] = useState<'ricarica' | 'imposta'>('ricarica');
  const [importo, setImporto] = useState('');
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const { mostraSuccesso, mostraErrore } = useSnackbar();

  useEffect(() => {
    if (aperto) {
      setModalita('ricarica');
      setImporto('');
      setErrore('');
    }
  }, [aperto]);

  const valore = Number(importo.replace(',', '.'));
  const anteprima =
    modalita === 'ricarica'
      ? Math.round((utente.creditoResiduo + (Number.isFinite(valore) ? valore : 0)) * 100) / 100
      : Math.max(0, Number.isFinite(valore) ? valore : 0);

  const conferma = async () => {
    setErrore('');
    if (!importo.trim() || !Number.isFinite(valore)) {
      setErrore('Inserisci un importo valido.');
      return;
    }
    if (modalita === 'imposta' && valore < 0) {
      setErrore('Il saldo non puo essere negativo.');
      return;
    }
    if (modalita === 'ricarica' && utente.creditoResiduo + valore < 0) {
      setErrore('Lo storno richiesto porterebbe il saldo sotto zero.');
      return;
    }

    setInCorso(true);
    try {
      if (modalita === 'ricarica') {
        const nuovo = await ricaricaSaldo(utente.uid, valore);
        mostraSuccesso(`Saldo di ${utente.nome} ${utente.cognome}: ${formattaEuro(nuovo)}.`);
      } else {
        await impostaSaldo(utente.uid, valore);
        mostraSuccesso(`Saldo impostato a ${formattaEuro(valore)}.`);
      }
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
      titolo={`Saldo di ${utente.nome} ${utente.cognome}`}
      descrizione={`Credito attuale: ${formattaEuro(utente.creditoResiduo)}`}
      onChiudi={onChiudi}
      azioni={
        <>
          <Bottone variante="text" onClick={onChiudi} disabled={inCorso}>Cancella</Bottone>
          <Bottone onClick={conferma} disabled={inCorso} icona="check">Conferma</Bottone>
        </>
      }
    >
      <div className="md-stack">
        {errore && <BannerErrore testo={errore} />}

        <div className="md-segmented">
          <button
            type="button"
            className={`md-segmented__item ${modalita === 'ricarica' ? 'md-segmented__item--active' : ''}`}
            onClick={() => setModalita('ricarica')}
          >
            Ricarica
          </button>
          <button
            type="button"
            className={`md-segmented__item ${modalita === 'imposta' ? 'md-segmented__item--active' : ''}`}
            onClick={() => setModalita('imposta')}
          >
            Imposta saldo
          </button>
        </div>

        <Campo
          etichetta={modalita === 'ricarica' ? 'Importo da accreditare (euro)' : 'Nuovo saldo (euro)'}
          type="number"
          step="0.01"
          value={importo}
          supporto={
            modalita === 'ricarica'
              ? 'Usa un valore negativo per stornare credito.'
              : 'Il valore sostituisce il saldo attuale.'
          }
          onChange={(evento) => setImporto(evento.target.value)}
        />

        <div className="md-card md-card--primary">
          <div className="md-label-medium">Saldo dopo la conferma</div>
          <div className="md-headline-small">{formattaEuro(anteprima)}</div>
        </div>
      </div>
    </Dialog>
  );
}
