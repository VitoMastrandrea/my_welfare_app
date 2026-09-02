import { useEffect, useState } from 'react';
import { Bottone, Campo, Dialog, Selezione, BannerErrore } from './md3';
import { aggiornaAttivita, creaAttivita, slugAttivita, type DatiAttivita } from '../services/activities';
import { messaggioErrore } from '../services/errors';
import { useSnackbar } from '../context/SnackbarContext';
import { TIPOLOGIE, type Attivita, type TipologiaAttivita } from '../types';

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  /** Assente in creazione, valorizzata in modifica. */
  attivita?: Attivita | null;
}

const VUOTA: DatiAttivita = {
  nome: '',
  descrizione: '',
  tipologia: 'lezione',
  costoUnitario: 0,
  limitePerUtente: 0,
};

/** Creazione e modifica di un attivita' (il nome e' la chiave primaria). */
export function DialogoAttivita({ aperto, onChiudi, attivita }: Props) {
  const [bozza, setBozza] = useState<DatiAttivita>(VUOTA);
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const { mostraSuccesso, mostraErrore } = useSnackbar();

  useEffect(() => {
    if (!aperto) return;
    setErrore('');
    setBozza(
      attivita
        ? {
            nome: attivita.nome,
            descrizione: attivita.descrizione,
            tipologia: attivita.tipologia,
            costoUnitario: attivita.costoUnitario,
            limitePerUtente: attivita.limitePerUtente,
          }
        : VUOTA,
    );
  }, [aperto, attivita]);

  const salva = async () => {
    setErrore('');
    if (!bozza.nome.trim()) {
      setErrore('Il nome dell attivita e obbligatorio.');
      return;
    }
    if (!slugAttivita(bozza.nome)) {
      setErrore('Il nome deve contenere almeno una lettera o un numero.');
      return;
    }
    if (!(bozza.costoUnitario > 0)) {
      setErrore('Il costo unitario deve essere maggiore di zero.');
      return;
    }

    setInCorso(true);
    try {
      if (attivita) {
        await aggiornaAttivita(attivita.id, bozza);
        mostraSuccesso('Attivita aggiornata.');
      } else {
        await creaAttivita(bozza);
        mostraSuccesso('Attivita creata.');
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
      titolo={attivita ? `Modifica "${attivita.nome}"` : 'Nuova attivita'}
      descrizione="Ogni attivita puo essere inserita una sola volta: il nome e la chiave primaria."
      onChiudi={onChiudi}
      azioni={
        <>
          <Bottone variante="text" onClick={onChiudi} disabled={inCorso}>Cancella</Bottone>
          <Bottone onClick={salva} disabled={inCorso} icona="check">Conferma</Bottone>
        </>
      }
    >
      <div className="md-stack">
        {errore && <BannerErrore testo={errore} />}

        <Campo
          etichetta="Nome attivita"
          value={bozza.nome}
          onChange={(evento) => setBozza({ ...bozza, nome: evento.target.value })}
        />
        <Campo
          etichetta="Descrizione"
          value={bozza.descrizione}
          onChange={(evento) => setBozza({ ...bozza, descrizione: evento.target.value })}
        />
        <Selezione
          etichetta="Tipologia"
          value={bozza.tipologia}
          onChange={(evento) => setBozza({ ...bozza, tipologia: evento.target.value as TipologiaAttivita })}
        >
          {TIPOLOGIE.map((tipologia) => (
            <option key={tipologia} value={tipologia}>{tipologia}</option>
          ))}
        </Selezione>
        <div className="md-grid-2">
          <Campo
            etichetta="Costo unitario (euro)"
            type="number"
            min={0}
            step="0.01"
            value={bozza.costoUnitario}
            onChange={(evento) => setBozza({ ...bozza, costoUnitario: Number(evento.target.value) })}
          />
          <Campo
            etichetta="Limite per utente"
            type="number"
            min={0}
            supporto="0 = nessun limite"
            value={bozza.limitePerUtente}
            onChange={(evento) => setBozza({ ...bozza, limitePerUtente: Number(evento.target.value) })}
          />
        </div>
      </div>
    </Dialog>
  );
}
