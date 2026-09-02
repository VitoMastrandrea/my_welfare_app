import { useEffect, useState } from 'react';
import { Bottone, Campo, Dialog, BannerErrore } from './md3';
import { aggiornaCostoAttivita } from '../services/activities';
import { formattaEuro } from '../services/benefits';
import { messaggioErrore } from '../services/errors';
import { useSnackbar } from '../context/SnackbarContext';
import type { Attivita } from '../types';

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  attivita: Attivita;
}

/** Icona "dollaro" della pagina Attivita': modifica il solo costo unitario. */
export function DialogoCostoAttivita({ aperto, onChiudi, attivita }: Props) {
  const [costo, setCosto] = useState(String(attivita.costoUnitario));
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const { mostraSuccesso, mostraErrore } = useSnackbar();

  useEffect(() => {
    if (aperto) {
      setCosto(String(attivita.costoUnitario));
      setErrore('');
    }
  }, [aperto, attivita]);

  const conferma = async () => {
    const valore = Number(costo.replace(',', '.'));
    if (!Number.isFinite(valore) || valore <= 0) {
      setErrore('Il costo unitario deve essere maggiore di zero.');
      return;
    }

    setInCorso(true);
    try {
      await aggiornaCostoAttivita(attivita.id, valore);
      mostraSuccesso(`Costo di "${attivita.nome}" aggiornato a ${formattaEuro(valore)}.`);
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
      titolo={`Costo di "${attivita.nome}"`}
      descrizione={`Costo attuale: ${formattaEuro(attivita.costoUnitario)}`}
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
        <Campo
          etichetta="Nuovo costo unitario (euro)"
          type="number"
          min={0}
          step="0.01"
          value={costo}
          onChange={(evento) => setCosto(evento.target.value)}
        />
      </div>
    </Dialog>
  );
}
