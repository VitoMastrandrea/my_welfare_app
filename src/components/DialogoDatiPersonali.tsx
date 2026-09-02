import { useEffect, useMemo, useState } from 'react';
import { Bottone, Campo, Dialog, Selezione, BannerErrore } from './md3';
import { calcolaBenefit, formattaEuro } from '../services/benefits';
import { aggiornaUtente, cambiaRuolo, validaCF, normalizzaCF } from '../services/users';
import { messaggioErrore } from '../services/errors';
import { useSnackbar } from '../context/SnackbarContext';
import type { SituazioneFamiliare, Utente } from '../types';

interface Props {
  aperto: boolean;
  onChiudi: () => void;
  utente: Utente;
  /** L admin puo' modificare anche i dati anagrafici di altri utenti. */
  titolo?: string;
  /** Mostra il selettore del ruolo: riservato agli amministratori. */
  gestioneRuolo?: boolean;
}

const STATI_CIVILI: SituazioneFamiliare['statoCivile'][] = [
  'celibe/nubile',
  'coniugato/a',
  'convivente',
  'separato/a',
  'vedovo/a',
];

/** Dati personali + situazione familiare, con calcolo del livello di benefit. */
export function DialogoDatiPersonali({
  aperto,
  onChiudi,
  utente,
  titolo = 'I miei dati',
  gestioneRuolo = false,
}: Props) {
  const [bozza, setBozza] = useState<Utente>(utente);
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const { mostraSuccesso, mostraErrore } = useSnackbar();

  useEffect(() => {
    if (aperto) {
      setBozza(utente);
      setErrore('');
    }
  }, [aperto, utente]);

  const esito = useMemo(() => calcolaBenefit(bozza.situazioneFamiliare), [bozza.situazioneFamiliare]);

  const aggiornaSituazione = <C extends keyof SituazioneFamiliare>(
    campo: C,
    valore: SituazioneFamiliare[C],
  ) => {
    setBozza({ ...bozza, situazioneFamiliare: { ...bozza.situazioneFamiliare, [campo]: valore } });
  };

  const salva = async () => {
    setErrore('');
    if (!bozza.nome.trim() || !bozza.cognome.trim()) {
      setErrore('Nome e cognome sono obbligatori.');
      return;
    }
    if (!validaCF(bozza.cf)) {
      setErrore('Il codice fiscale non e valido: servono 16 caratteri.');
      return;
    }

    setInCorso(true);
    try {
      await aggiornaUtente(utente.uid, {
        nome: bozza.nome.trim(),
        cognome: bozza.cognome.trim(),
        cf: bozza.cf,
        nTelefono: bozza.nTelefono.trim(),
        situazioneFamiliare: bozza.situazioneFamiliare,
      });
      if (gestioneRuolo && bozza.ruolo !== utente.ruolo) {
        await cambiaRuolo(utente.uid, bozza.ruolo);
      }
      mostraSuccesso('Dati aggiornati.');
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
      titolo={titolo}
      descrizione="I dati familiari determinano il livello di welfare accessibile."
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

        <div className="md-grid-2">
          <Campo etichetta="Nome" value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
          <Campo
            etichetta="Cognome"
            value={bozza.cognome}
            onChange={(e) => setBozza({ ...bozza, cognome: e.target.value })}
          />
          <Campo
            etichetta="Codice fiscale"
            value={bozza.cf}
            maxLength={16}
            onChange={(e) => setBozza({ ...bozza, cf: normalizzaCF(e.target.value) })}
          />
          <Campo
            etichetta="Telefono"
            type="tel"
            value={bozza.nTelefono}
            placeholder="+393401234567"
            onChange={(e) => setBozza({ ...bozza, nTelefono: e.target.value })}
          />
        </div>

        {gestioneRuolo && (
          <Selezione
            etichetta="Ruolo"
            value={bozza.ruolo}
            supporto="Solo un amministratore puo modificare il ruolo."
            onChange={(e) => setBozza({ ...bozza, ruolo: e.target.value === 'admin' ? 'admin' : 'user' })}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </Selezione>
        )}

        <h3 className="md-title-medium" style={{ margin: '8px 0 0' }}>Situazione familiare</h3>

        <Selezione
          etichetta="Stato civile"
          value={bozza.situazioneFamiliare.statoCivile}
          onChange={(e) => aggiornaSituazione('statoCivile', e.target.value as SituazioneFamiliare['statoCivile'])}
        >
          <option value="">Non specificato</option>
          {STATI_CIVILI.map((stato) => (
            <option key={stato} value={stato}>{stato}</option>
          ))}
        </Selezione>

        <div className="md-grid-2">
          <Campo
            etichetta="Numero di figli"
            type="number"
            min={0}
            value={bozza.situazioneFamiliare.numeroFigli}
            onChange={(e) => aggiornaSituazione('numeroFigli', Number(e.target.value))}
          />
          <Campo
            etichetta="Di cui minorenni"
            type="number"
            min={0}
            value={bozza.situazioneFamiliare.figliMinori}
            onChange={(e) => aggiornaSituazione('figliMinori', Number(e.target.value))}
          />
          <Campo
            etichetta="Altri familiari a carico"
            type="number"
            min={0}
            value={bozza.situazioneFamiliare.familiariACarico}
            onChange={(e) => aggiornaSituazione('familiariACarico', Number(e.target.value))}
          />
          <Campo
            etichetta="ISEE (euro)"
            type="number"
            min={0}
            step="0.01"
            value={bozza.situazioneFamiliare.isee}
            onChange={(e) => aggiornaSituazione('isee', Number(e.target.value))}
          />
          <Campo
            etichetta="Anni di anzianita aziendale"
            type="number"
            min={0}
            value={bozza.situazioneFamiliare.anniAnzianitaAziendale}
            onChange={(e) => aggiornaSituazione('anniAnzianitaAziendale', Number(e.target.value))}
          />
          <label className="md-row" style={{ padding: '0 4px' }}>
            <input
              type="checkbox"
              checked={bozza.situazioneFamiliare.disabilitaInFamiglia}
              onChange={(e) => aggiornaSituazione('disabilitaInFamiglia', e.target.checked)}
            />
            <span className="md-body-medium">Disabilita in famiglia</span>
          </label>
        </div>

        <div className="md-card md-card--outlined">
          <div className="md-row" style={{ justifyContent: 'space-between' }}>
            <span className="md-title-small">Livello di benefit stimato</span>
            <span className="md-title-medium">Livello {esito.livello} / 5</span>
          </div>
          <div className="md-body-small" style={{ marginTop: 4 }}>
            Punteggio {esito.punteggio} - plafond welfare fino a {formattaEuro(esito.creditoMassimo)}.
            Il credito effettivamente disponibile viene assegnato dall amministratore.
          </div>
        </div>
      </div>
    </Dialog>
  );
}
