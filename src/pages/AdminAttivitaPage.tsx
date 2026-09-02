import { useEffect, useState } from 'react';
import { BarraSuperiore } from '../components/BarraSuperiore';
import { Caricamento, ChipTipologia, Icona, IconBottone, StatoVuoto } from '../components/md3';
import { DialogoAttivita } from '../components/DialogoAttivita';
import { DialogoCostoAttivita } from '../components/DialogoCostoAttivita';
import { DialogoConferma } from '../components/DialogoConferma';
import { useSnackbar } from '../context/SnackbarContext';
import { ascoltaAttivita, eliminaAttivita } from '../services/activities';
import { formattaEuro } from '../services/benefits';
import { messaggioErrore } from '../services/errors';
import type { Attivita } from '../types';

type Azione = 'nuova' | 'modifica' | 'costo' | 'elimina' | null;

/** Pagina 6 - elenco attivita' con le tre azioni: matita, pattumiera, dollaro. */
export function AdminAttivitaPage() {
  const { mostraErrore, mostraSuccesso } = useSnackbar();

  const [attivita, setAttivita] = useState<Attivita[] | null>(null);
  const [espansa, setEspansa] = useState<string | null>(null);
  const [selezionata, setSelezionata] = useState<Attivita | null>(null);
  const [azione, setAzione] = useState<Azione>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    return ascoltaAttivita(setAttivita, (errore) => {
      setAttivita([]);
      mostraErrore(messaggioErrore(errore));
    });
  }, [mostraErrore]);

  const apri = (corrente: Attivita, prossima: Azione) => {
    setSelezionata(corrente);
    setAzione(prossima);
  };

  const chiudi = () => {
    setAzione(null);
    setSelezionata(null);
  };

  const confermaEliminazione = async () => {
    if (!selezionata) return;
    setInCorso(true);
    try {
      await eliminaAttivita(selezionata.id);
      mostraSuccesso('Attivita eliminata.');
      chiudi();
    } catch (eccezione) {
      mostraErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
      <BarraSuperiore titolo="Attivita" indietro="/" />

      <main className="md-page md-stack">
        {attivita === null ? (
          <Caricamento testo="Carico le attivita..." />
        ) : attivita.length === 0 ? (
          <StatoVuoto
            icona="local_activity"
            titolo="Nessuna attivita creata"
            testo="Usa il pulsante + per creare la prima attivita selezionabile."
          />
        ) : (
          <div className="md-list">
            {attivita.map((corrente) => {
              const aperta = espansa === corrente.id;
              return (
                <article
                  key={corrente.id}
                  className={`md-list-item ${aperta ? 'md-list-item--selected' : ''}`}
                >
                  <button
                    type="button"
                    className="md-list-item__button"
                    aria-expanded={aperta}
                    onClick={() => setEspansa(aperta ? null : corrente.id)}
                  >
                    <span className="md-avatar md-avatar--small">
                      <Icona nome="local_activity" />
                    </span>
                    <div className="md-list-item__texts">
                      <span className="md-list-item__headline">{corrente.nome}</span>
                      <span className="md-list-item__supporting">
                        {formattaEuro(corrente.costoUnitario)}
                        {corrente.limitePerUtente > 0
                          ? ` - max ${corrente.limitePerUtente} per utente`
                          : ' - nessun limite'}
                      </span>
                    </div>
                    <ChipTipologia tipologia={corrente.tipologia} />
                  </button>

                  {aperta && (
                    <div className="md-list-item__actions" style={{ flexWrap: 'wrap' }}>
                      <IconBottone
                        icona="edit"
                        etichetta={`Modifica ${corrente.nome}`}
                        variante="tonal"
                        onClick={() => apri(corrente, 'modifica')}
                      />
                      <IconBottone
                        icona="delete"
                        etichetta={`Elimina ${corrente.nome}`}
                        variante="error"
                        onClick={() => apri(corrente, 'elimina')}
                      />
                      <IconBottone
                        icona="attach_money"
                        etichetta={`Modifica il costo di ${corrente.nome}`}
                        variante="filled"
                        onClick={() => apri(corrente, 'costo')}
                      />
                      {corrente.descrizione && (
                        <span className="md-body-small" style={{ alignSelf: 'center', flex: 1 }}>
                          {corrente.descrizione}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <button className="md-fab" onClick={() => setAzione('nuova')} aria-label="Crea una nuova attivita">
        <Icona nome="add" />
        Nuova attivita
      </button>

      <DialogoAttivita
        aperto={azione === 'nuova' || azione === 'modifica'}
        onChiudi={chiudi}
        attivita={azione === 'modifica' ? selezionata : null}
      />

      {selezionata && (
        <>
          <DialogoCostoAttivita aperto={azione === 'costo'} onChiudi={chiudi} attivita={selezionata} />
          <DialogoConferma
            aperto={azione === 'elimina'}
            titolo="Eliminare l attivita?"
            messaggio={`"${selezionata.nome}" non sara piu selezionabile dagli utenti. Le selezioni gia confermate restano nello storico.`}
            inCorso={inCorso}
            onConferma={confermaEliminazione}
            onChiudi={chiudi}
          />
        </>
      )}
    </>
  );
}
