import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarraSuperiore } from '../components/BarraSuperiore';
import { FotoProfilo } from '../components/FotoProfilo';
import { Bottone, ChipTipologia, Icona, StatoVuoto } from '../components/md3';
import { DialogoScegliAttivita } from '../components/DialogoScegliAttivita';
import { DialogoDatiPersonali } from '../components/DialogoDatiPersonali';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';
import { ascoltaAttivita } from '../services/activities';
import { ascoltaSelezioni } from '../services/selections';
import { formattaEuro } from '../services/benefits';
import { messaggioErrore } from '../services/errors';
import type { Attivita, Selezione } from '../types';

/** Pagina 2 (USER) e Pagina 3 (ADMIN): stessa dashboard, l admin ha in piu' i due pulsanti di gestione. */
export function DashboardPage() {
  const { profilo, isAdmin } = useAuth();
  const naviga = useNavigate();
  const { mostraErrore } = useSnackbar();

  const [attivita, setAttivita] = useState<Attivita[]>([]);
  const [selezioni, setSelezioni] = useState<Selezione[]>([]);
  const [popupAperto, setPopupAperto] = useState(false);
  const [datiAperti, setDatiAperti] = useState(false);

  useEffect(() => {
    return ascoltaAttivita(setAttivita, (errore) => mostraErrore(messaggioErrore(errore)));
  }, [mostraErrore]);

  useEffect(() => {
    if (!profilo) return;
    return ascoltaSelezioni(profilo.uid, setSelezioni, (errore) => mostraErrore(messaggioErrore(errore)));
  }, [profilo, mostraErrore]);

  const totaleSpeso = useMemo(
    () => selezioni.reduce((somma, selezione) => somma + selezione.spesaTotale, 0),
    [selezioni],
  );

  if (!profilo) return null;

  return (
    <>
      <BarraSuperiore titolo="Dashboard" />

      <main className="md-page md-stack">
        {/* --- Intestazione profilo --- */}
        <section className="md-card md-card--elevated">
          <div className="md-row" style={{ gap: 20, alignItems: 'center' }}>
            <FotoProfilo
              uid={profilo.uid}
              nome={profilo.nome}
              cognome={profilo.cognome}
              photoURL={profilo.photoURL}
            />
            <div style={{ minWidth: 0 }}>
              <h2 className="md-headline-small" style={{ margin: 0 }}>
                {profilo.nome} {profilo.cognome}
              </h2>
              <div className="md-row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span className={`md-chip ${isAdmin ? 'md-chip--admin' : ''}`}>
                  {isAdmin ? 'Amministratore' : 'Dipendente'}
                </span>
                {profilo.livelloBenefit > 0 && (
                  <span className="md-chip">Livello benefit {profilo.livelloBenefit}/5</span>
                )}
                {profilo.mfaAttiva && <span className="md-chip">2FA attiva</span>}
              </div>
            </div>
          </div>

          <hr className="md-divider" style={{ margin: '16px 0' }} />

          <div className="md-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="md-label-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Credito residuo
              </div>
              <div className="md-balance">
                <span className="md-balance__value">{formattaEuro(profilo.creditoResiduo)}</span>
              </div>
              <div className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Gia utilizzati {formattaEuro(totaleSpeso)}
              </div>
            </div>
            <Bottone variante="tonal" icona="badge" onClick={() => setDatiAperti(true)}>
              I miei dati
            </Bottone>
          </div>
        </section>

        {/* --- Pulsanti riservati all ADMIN --- */}
        {isAdmin && (
          <section className="md-grid-2">
            <Bottone variante="filled" icona="group" larghezzaPiena onClick={() => naviga('/admin/utenti')}>
              Utenti
            </Bottone>
            <Bottone variante="filled" icona="local_activity" larghezzaPiena onClick={() => naviga('/admin/attivita')}>
              Attivita
            </Bottone>
          </section>
        )}

        {/* --- Attivita' selezionate --- */}
        <section className="md-stack">
          <h3 className="md-title-medium" style={{ margin: 0 }}>Attivita selezionate</h3>

          {selezioni.length === 0 ? (
            <StatoVuoto
              icona="playlist_add"
              titolo="Nessuna attivita selezionata"
              testo="Usa il pulsante + in basso a destra per scegliere le tue attivita."
            />
          ) : (
            <div className="md-list">
              {selezioni.map((selezione) => (
                <article key={selezione.id} className="md-list-item">
                  <div className="md-list-item__button" style={{ cursor: 'default' }}>
                    <span className="md-avatar md-avatar--small">
                      <Icona nome="check_circle" />
                    </span>
                    <div className="md-list-item__texts">
                      <span className="md-list-item__headline">{selezione.nome}</span>
                      <span className="md-list-item__supporting">
                        {selezione.quantita} x {formattaEuro(selezione.costoUnitario)}
                      </span>
                    </div>
                    <ChipTipologia tipologia={selezione.tipologia} />
                    <span className="md-title-small">{formattaEuro(selezione.spesaTotale)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <button className="md-fab" onClick={() => setPopupAperto(true)} aria-label="Scegli nuove attivita">
        <Icona nome="add" />
        Scegli attivita
      </button>

      <DialogoScegliAttivita
        aperto={popupAperto}
        onChiudi={() => setPopupAperto(false)}
        uid={profilo.uid}
        saldo={profilo.creditoResiduo}
        attivita={attivita}
        selezioni={selezioni}
      />

      <DialogoDatiPersonali aperto={datiAperti} onChiudi={() => setDatiAperti(false)} utente={profilo} />
    </>
  );
}
