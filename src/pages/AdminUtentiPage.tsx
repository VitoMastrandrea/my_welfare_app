import { useEffect, useMemo, useState } from 'react';
import { BarraSuperiore } from '../components/BarraSuperiore';
import { Campo, IconBottone, StatoVuoto, Caricamento } from '../components/md3';
import { FotoProfilo } from '../components/FotoProfilo';
import { DialogoDatiPersonali } from '../components/DialogoDatiPersonali';
import { DialogoSaldo } from '../components/DialogoSaldo';
import { DialogoConferma } from '../components/DialogoConferma';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';
import { ascoltaUtenti, eliminaUtente } from '../services/users';
import { formattaEuro } from '../services/benefits';
import { messaggioErrore } from '../services/errors';
import type { Utente } from '../types';

type Azione = 'modifica' | 'saldo' | 'elimina' | null;

/** Pagina 5 - elenco utenti con le tre azioni: matita, pattumiera, dollaro. */
export function AdminUtentiPage() {
  const { profilo } = useAuth();
  const { mostraErrore, mostraSuccesso } = useSnackbar();

  const [utenti, setUtenti] = useState<Utente[] | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [espanso, setEspanso] = useState<string | null>(null);
  const [selezionato, setSelezionato] = useState<Utente | null>(null);
  const [azione, setAzione] = useState<Azione>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    return ascoltaUtenti(setUtenti, (errore) => {
      setUtenti([]);
      mostraErrore(messaggioErrore(errore));
    });
  }, [mostraErrore]);

  const filtrati = useMemo(() => {
    if (!utenti) return [];
    const termine = ricerca.trim().toLowerCase();
    if (!termine) return utenti;
    return utenti.filter((utente) =>
      [utente.nome, utente.cognome, utente.cf, utente.email].join(' ').toLowerCase().includes(termine),
    );
  }, [utenti, ricerca]);

  /** Mantiene aggiornato il dialogo aperto quando arrivano nuovi dati. */
  const utenteCorrente = useMemo(
    () => (selezionato ? utenti?.find((u) => u.uid === selezionato.uid) ?? selezionato : null),
    [selezionato, utenti],
  );

  const apri = (utente: Utente, prossima: Azione) => {
    setSelezionato(utente);
    setAzione(prossima);
  };

  const chiudi = () => {
    setAzione(null);
    setSelezionato(null);
  };

  const confermaEliminazione = async () => {
    if (!utenteCorrente) return;
    setInCorso(true);
    try {
      await eliminaUtente(utenteCorrente.uid);
      mostraSuccesso('Utente eliminato.');
      chiudi();
    } catch (eccezione) {
      mostraErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  return (
    <>
      <BarraSuperiore titolo="Utenti" indietro="/" />

      <main className="md-page md-stack">
        <Campo
          etichetta="Cerca per nome, codice fiscale o e-mail"
          value={ricerca}
          onChange={(evento) => setRicerca(evento.target.value)}
        />

        {utenti === null ? (
          <Caricamento testo="Carico gli utenti..." />
        ) : filtrati.length === 0 ? (
          <StatoVuoto icona="group_off" titolo="Nessun utente trovato" />
        ) : (
          <div className="md-list">
            {filtrati.map((utente) => {
              const aperto = espanso === utente.uid;
              return (
                <article
                  key={utente.uid}
                  className={`md-list-item ${aperto ? 'md-list-item--selected' : ''}`}
                >
                  <button
                    type="button"
                    className="md-list-item__button"
                    aria-expanded={aperto}
                    onClick={() => setEspanso(aperto ? null : utente.uid)}
                  >
                    <FotoProfilo
                      uid={utente.uid}
                      nome={utente.nome}
                      cognome={utente.cognome}
                      photoURL={utente.photoURL}
                      modificabile={false}
                      piccola
                    />
                    <div className="md-list-item__texts">
                      <span className="md-list-item__headline">
                        {utente.nome} {utente.cognome}
                      </span>
                      <span className="md-list-item__supporting">
                        {utente.cf || 'CF non inserito'} - {formattaEuro(utente.creditoResiduo)}
                      </span>
                    </div>
                    {utente.ruolo === 'admin' && <span className="md-chip md-chip--admin">admin</span>}
                  </button>

                  {aperto && (
                    <div className="md-list-item__actions">
                      <IconBottone
                        icona="edit"
                        etichetta={`Modifica i dati di ${utente.nome} ${utente.cognome}`}
                        variante="tonal"
                        onClick={() => apri(utente, 'modifica')}
                      />
                      <IconBottone
                        icona="delete"
                        etichetta={`Elimina ${utente.nome} ${utente.cognome}`}
                        variante="error"
                        disabled={utente.uid === profilo?.uid}
                        onClick={() => apri(utente, 'elimina')}
                      />
                      <IconBottone
                        icona="attach_money"
                        etichetta={`Modifica il saldo di ${utente.nome} ${utente.cognome}`}
                        variante="filled"
                        onClick={() => apri(utente, 'saldo')}
                      />
                      <div className="md-spacer" />
                      <span className="md-body-small" style={{ alignSelf: 'center' }}>
                        {utente.email}
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {utenteCorrente && (
        <>
          <DialogoDatiPersonali
            aperto={azione === 'modifica'}
            onChiudi={chiudi}
            utente={utenteCorrente}
            titolo={`Modifica ${utenteCorrente.nome} ${utenteCorrente.cognome}`}
            gestioneRuolo
          />
          <DialogoSaldo aperto={azione === 'saldo'} onChiudi={chiudi} utente={utenteCorrente} />
          <DialogoConferma
            aperto={azione === 'elimina'}
            titolo="Eliminare l utente?"
            messaggio={`Il profilo di ${utenteCorrente.nome} ${utenteCorrente.cognome} e le sue attivita selezionate verranno rimossi definitivamente.`}
            inCorso={inCorso}
            onConferma={confermaEliminazione}
            onChiudi={chiudi}
          />
        </>
      )}
    </>
  );
}
