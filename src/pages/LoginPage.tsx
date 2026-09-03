import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getMultiFactorResolver,
  multiFactor,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';
import { auth, firebaseConfigurato, googleProvider } from '../firebase';
import { Bottone, Campo, Icona, IconBottone, BannerErrore } from '../components/md3';
import { useTema } from '../context/TemaContext';
import { useAuth } from '../context/AuthContext';
import { creaUtenteSeMancante, leggiUtente, aggiornaUtente, validaCF, normalizzaCF } from '../services/users';
import { messaggioErrore, mfaNonDisponibile } from '../services/errors';
import { secondoFattoreRichiesto } from '../services/mfa';

type Fase =
  | 'accesso'
  | 'registrazione'
  | 'completaProfilo'
  | 'verificaEmail'
  | 'iscrizioneMfa'
  | 'verificaMfa';

interface DatiAnagrafici {
  nome: string;
  cognome: string;
  cf: string;
}

export function LoginPage() {
  const naviga = useNavigate();
  const { tema, cambiaTema } = useTema();
  const { utenteAuth, profilo, caricamento } = useAuth();

  const [fase, setFase] = useState<Fase>('accesso');
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostraPassword, setMostraPassword] = useState(false);
  const [anagrafica, setAnagrafica] = useState<DatiAnagrafici>({ nome: '', cognome: '', cf: '' });

  const [telefono, setTelefono] = useState('');
  const [codiceSms, setCodiceSms] = useState('');
  const [idVerifica, setIdVerifica] = useState('');
  const [mfaNonSupportata, setMfaNonSupportata] = useState(false);
  const [emailInviata, setEmailInviata] = useState(false);
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);

  const contenitoreRecaptcha = useRef<HTMLDivElement>(null);
  const verificatore = useRef<RecaptchaVerifier | null>(null);
  /**
   * Durante registrazione, completamento profilo e verifica in due passaggi
   * il redirect automatico verso la dashboard va sospeso: il profilo esiste
   * gia' su Firestore ma il flusso non e' ancora terminato.
   */
  const flussoInCorso = useRef(false);

  /* --- reCAPTCHA invisibile richiesto da Firebase per l'invio degli SMS --- */
  const ottieniVerificatore = useCallback(async () => {
    if (!verificatore.current) {
      verificatore.current = new RecaptchaVerifier(auth, contenitoreRecaptcha.current!, {
        size: 'invisible',
      });
      await verificatore.current.render();
    }
    return verificatore.current;
  }, []);

  const azzeraVerificatore = useCallback(() => {
    verificatore.current?.clear();
    verificatore.current = null;
  }, []);

  useEffect(() => () => verificatore.current?.clear(), []);

  /* --- Sessione gia' attiva e profilo completo: si entra nella dashboard --- */
  useEffect(() => {
    if (caricamento || flussoInCorso.current) return;
    if (!utenteAuth || !profilo) return;

    if (secondoFattoreRichiesto(utenteAuth, profilo)) {
      // Sessione aperta ma senza secondo fattore: si riprende da li'.
      flussoInCorso.current = true;
      setTelefono((precedente) => precedente || profilo.nTelefono);
      setFase(utenteAuth.emailVerified ? 'iscrizioneMfa' : 'verificaEmail');
      return;
    }

    naviga('/', { replace: true });
  }, [utenteAuth, profilo, caricamento, naviga]);

  /* --- Account Google al primo accesso: mancano CF e dati anagrafici --- */
  useEffect(() => {
    if (caricamento || !utenteAuth || profilo || flussoInCorso.current) return;
    if (fase === 'accesso' || fase === 'registrazione') {
      const nomeCompleto = (utenteAuth.displayName ?? '').split(' ');
      setAnagrafica((precedente) => ({
        nome: precedente.nome || nomeCompleto[0] || '',
        cognome: precedente.cognome || nomeCompleto.slice(1).join(' '),
        cf: precedente.cf,
      }));
      setFase('completaProfilo');
    }
  }, [caricamento, utenteAuth, profilo, fase]);

  /** Dopo l'autenticazione: profilo presente + secondo fattore attivo => dashboard. */
  const dopoAutenticazione = useCallback(
    async (utente: User) => {
      const esistente = await leggiUtente(utente.uid);
      if (!esistente) {
        const nomeCompleto = (utente.displayName ?? '').split(' ');
        setAnagrafica({
          nome: nomeCompleto[0] ?? '',
          cognome: nomeCompleto.slice(1).join(' '),
          cf: '',
        });
        setFase('completaProfilo');
        return;
      }
      if (secondoFattoreRichiesto(utente, esistente)) {
        setTelefono(esistente.nTelefono || '');
        setFase(utente.emailVerified ? 'iscrizioneMfa' : 'verificaEmail');
        return;
      }
      flussoInCorso.current = false;
      naviga('/', { replace: true });
    },
    [naviga],
  );

  /* ---------------- Accesso con Google ---------------- */
  const accediConGoogle = async () => {
    setErrore('');
    flussoInCorso.current = true;
    setInCorso(true);
    try {
      const credenziali = await signInWithPopup(auth, googleProvider);
      await dopoAutenticazione(credenziali.user);
    } catch (eccezione) {
      await gestisciErroreAccesso(eccezione);
    } finally {
      setInCorso(false);
    }
  };

  /* ---------------- Accesso con e-mail e password ---------------- */
  const accediConEmail = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrore('');
    flussoInCorso.current = true;
    setInCorso(true);
    try {
      const credenziali = await signInWithEmailAndPassword(auth, email.trim(), password);
      await dopoAutenticazione(credenziali.user);
    } catch (eccezione) {
      await gestisciErroreAccesso(eccezione);
    } finally {
      setInCorso(false);
    }
  };

  /** Intercetta la richiesta del secondo fattore e avvia la verifica via SMS. */
  const gestisciErroreAccesso = async (eccezione: unknown) => {
    const codice = (eccezione as { code?: string })?.code;
    if (codice === 'auth/multi-factor-auth-required') {
      try {
        const risolutore = getMultiFactorResolver(auth, eccezione as never);
        setResolver(risolutore);
        const provider = new PhoneAuthProvider(auth);
        const id = await provider.verifyPhoneNumber(
          { multiFactorHint: risolutore.hints[0], session: risolutore.session },
          await ottieniVerificatore(),
        );
        setIdVerifica(id);
        setCodiceSms('');
        setFase('verificaMfa');
        return;
      } catch (erroreSms) {
        azzeraVerificatore();
        setErrore(messaggioErrore(erroreSms));
        return;
      }
    }
    setErrore(messaggioErrore(eccezione));
  };

  /* ---------------- Registrazione con e-mail ---------------- */
  const registrati = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrore('');

    if (!anagrafica.nome.trim() || !anagrafica.cognome.trim()) {
      setErrore('Nome e cognome sono obbligatori.');
      return;
    }
    if (!validaCF(anagrafica.cf)) {
      setErrore('Il codice fiscale non e valido: servono 16 caratteri nel formato RSSMRA85T10A562S.');
      return;
    }
    if (password.length < 6) {
      setErrore('La password deve contenere almeno 6 caratteri.');
      return;
    }

    flussoInCorso.current = true;
    setInCorso(true);
    try {
      const credenziali = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credenziali.user, {
        displayName: `${anagrafica.nome.trim()} ${anagrafica.cognome.trim()}`,
      });
      await creaUtenteSeMancante(credenziali.user, anagrafica);
      await inviaEmailVerifica(credenziali.user);
      setFase('verificaEmail');
    } catch (eccezione) {
      setErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  /* ---------------- Completamento profilo (accesso Google) ---------------- */
  const completaProfilo = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrore('');

    if (!utenteAuth) {
      setFase('accesso');
      return;
    }
    if (!anagrafica.nome.trim() || !anagrafica.cognome.trim()) {
      setErrore('Nome e cognome sono obbligatori.');
      return;
    }
    if (!validaCF(anagrafica.cf)) {
      setErrore('Il codice fiscale non e valido: servono 16 caratteri nel formato RSSMRA85T10A562S.');
      return;
    }

    flussoInCorso.current = true;
    setInCorso(true);
    try {
      await creaUtenteSeMancante(utenteAuth, anagrafica);
      if (multiFactor(utenteAuth).enrolledFactors.length > 0) {
        flussoInCorso.current = false;
        naviga('/', { replace: true });
      } else {
        setFase(utenteAuth.emailVerified ? 'iscrizioneMfa' : 'verificaEmail');
      }
    } catch (eccezione) {
      setErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  /* ---------------- Verifica dell'indirizzo e-mail ---------------- */
  /** Firebase richiede un'e-mail verificata prima di registrare il secondo fattore. */
  const inviaEmailVerifica = async (utente: User) => {
    try {
      await sendEmailVerification(utente);
      setEmailInviata(true);
    } catch (eccezione) {
      setErrore(messaggioErrore(eccezione));
    }
  };

  const controllaVerificaEmail = async () => {
    if (!utenteAuth) return;
    setErrore('');
    setInCorso(true);
    try {
      await utenteAuth.reload();
      if (auth.currentUser?.emailVerified) {
        setFase('iscrizioneMfa');
      } else {
        setErrore('L indirizzo non risulta ancora verificato: apri il link ricevuto via e-mail.');
      }
    } catch (eccezione) {
      setErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  /* ---------------- 2FA: invio SMS per l'iscrizione ---------------- */
  const inviaSmsIscrizione = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrore('');

    if (!utenteAuth) return;
    if (!/^\+\d{8,15}$/.test(telefono.trim())) {
      setErrore('Inserisci il numero in formato internazionale, ad esempio +393401234567.');
      return;
    }

    setInCorso(true);
    try {
      const sessione = await multiFactor(utenteAuth).getSession();
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(
        { phoneNumber: telefono.trim(), session: sessione },
        await ottieniVerificatore(),
      );
      setIdVerifica(id);
      setCodiceSms('');
    } catch (eccezione) {
      azzeraVerificatore();
      if ((eccezione as { code?: string })?.code === 'auth/unverified-email') {
        if (utenteAuth) await inviaEmailVerifica(utenteAuth);
        setFase('verificaEmail');
        setErrore('Per attivare la verifica in due passaggi devi prima confermare il tuo indirizzo e-mail.');
      } else if (mfaNonDisponibile(eccezione)) {
        setMfaNonSupportata(true);
        setErrore(
          'La verifica in due passaggi non e abilitata su questo progetto Firebase ' +
            '(serve Identity Platform con MFA via SMS). Puoi proseguire e attivarla in seguito.',
        );
      } else {
        setErrore(messaggioErrore(eccezione));
      }
    } finally {
      setInCorso(false);
    }
  };

  /* ---------------- 2FA: conferma del codice ---------------- */
  const confermaCodice = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErrore('');

    if (codiceSms.trim().length < 6) {
      setErrore('Inserisci le 6 cifre ricevute via SMS.');
      return;
    }

    setInCorso(true);
    try {
      const credenziale = PhoneAuthProvider.credential(idVerifica, codiceSms.trim());
      const asserzione = PhoneMultiFactorGenerator.assertion(credenziale);

      if (fase === 'verificaMfa' && resolver) {
        const credenziali = await resolver.resolveSignIn(asserzione);
        setResolver(null);
        await dopoAutenticazione(credenziali.user);
        return;
      }

      if (!utenteAuth) return;
      await multiFactor(utenteAuth).enroll(asserzione, 'Telefono personale');
      await aggiornaUtente(utenteAuth.uid, { nTelefono: telefono.trim(), mfaAttiva: true });
      flussoInCorso.current = false;
      naviga('/', { replace: true });
    } catch (eccezione) {
      setErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  /** Prosegue senza secondo fattore quando il progetto non lo supporta. */
  const prosegueSenzaMfa = async () => {
    if (!utenteAuth) return;
    setInCorso(true);
    try {
      await aggiornaUtente(utenteAuth.uid, {
        nTelefono: telefono.trim() || profilo?.nTelefono || '',
        mfaAttiva: false,
        mfaSaltata: true,
      });
      flussoInCorso.current = false;
      naviga('/', { replace: true });
    } catch (eccezione) {
      setErrore(messaggioErrore(eccezione));
    } finally {
      setInCorso(false);
    }
  };

  if (!firebaseConfigurato) {
    return (
      <main className="md-page" style={{ maxWidth: 560 }}>
        <div className="md-card md-card--elevated md-stack" style={{ marginTop: 48 }}>
          <h1 className="md-headline-small" style={{ margin: 0 }}>Configurazione mancante</h1>
          <BannerErrore testo="Le credenziali Firebase non sono state impostate." />
          <p className="md-body-medium" style={{ margin: 0 }}>
            In locale: copia <code>.env.example</code> in <code>.env</code>, inserisci i valori del
            tuo progetto Firebase e riavvia il server di sviluppo.
          </p>
          <p className="md-body-medium" style={{ margin: 0 }}>
            In produzione (Railway, Firebase Hosting, ...): le variabili <code>VITE_*</code> vengono
            lette durante la <strong>build</strong>, non all avvio. Impostale nel servizio e rilancia
            il deploy. Le istruzioni complete sono nel README.
          </p>
        </div>
      </main>
    );
  }

  const titoloFase: Record<Fase, string> = {
    accesso: 'Accedi al tuo welfare',
    registrazione: 'Crea il tuo account',
    completaProfilo: 'Completa il profilo',
    verificaEmail: 'Conferma la tua e-mail',
    iscrizioneMfa: 'Verifica in due passaggi',
    verificaMfa: 'Verifica in due passaggi',
  };

  return (
    <main className="md-page" style={{ maxWidth: 480, paddingTop: 32 }}>
      <div className="md-row" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="md-row">
          <span
            className="md-avatar md-avatar--small"
            style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)' }}
          >
            <Icona nome="volunteer_activism" />
          </span>
          <span className="md-title-large">Welfare Aziendale</span>
        </div>
        <IconBottone
          icona={tema === 'dark' ? 'light_mode' : 'dark_mode'}
          etichetta="Cambia tema"
          onClick={cambiaTema}
        />
      </div>

      <div className="md-card md-card--elevated md-stack">
        <h1 className="md-headline-small" style={{ margin: 0 }}>{titoloFase[fase]}</h1>

        {errore && <BannerErrore testo={errore} />}

        {(fase === 'accesso' || fase === 'registrazione') && (
          <>
            <div className="md-segmented" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={fase === 'accesso'}
                className={`md-segmented__item ${fase === 'accesso' ? 'md-segmented__item--active' : ''}`}
                onClick={() => { flussoInCorso.current = false; setFase('accesso'); setErrore(''); }}
              >
                Accedi
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fase === 'registrazione'}
                className={`md-segmented__item ${fase === 'registrazione' ? 'md-segmented__item--active' : ''}`}
                onClick={() => { flussoInCorso.current = false; setFase('registrazione'); setErrore(''); }}
              >
                Registrati
              </button>
            </div>

            <Bottone variante="outlined" icona="account_circle" larghezzaPiena onClick={accediConGoogle} disabled={inCorso}>
              Continua con Google
            </Bottone>

            <div className="md-row">
              <hr className="md-divider" style={{ flex: 1 }} />
              <span className="md-body-small">oppure</span>
              <hr className="md-divider" style={{ flex: 1 }} />
            </div>

            <form className="md-stack" onSubmit={fase === 'accesso' ? accediConEmail : registrati}>
              {fase === 'registrazione' && (
                <>
                  <Campo
                    etichetta="Nome"
                    value={anagrafica.nome}
                    autoComplete="given-name"
                    onChange={(e) => setAnagrafica({ ...anagrafica, nome: e.target.value })}
                    required
                  />
                  <Campo
                    etichetta="Cognome"
                    value={anagrafica.cognome}
                    autoComplete="family-name"
                    onChange={(e) => setAnagrafica({ ...anagrafica, cognome: e.target.value })}
                    required
                  />
                  <Campo
                    etichetta="Codice fiscale"
                    value={anagrafica.cf}
                    maxLength={16}
                    supporto="16 caratteri, es. RSSMRA85T10A562S"
                    onChange={(e) => setAnagrafica({ ...anagrafica, cf: normalizzaCF(e.target.value) })}
                    required
                  />
                </>
              )}

              <Campo
                etichetta="E-mail"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Campo
                etichetta="Password"
                type={mostraPassword ? 'text' : 'password'}
                value={password}
                autoComplete={fase === 'accesso' ? 'current-password' : 'new-password'}
                onChange={(e) => setPassword(e.target.value)}
                required
                trailing={
                  <IconBottone
                    icona={mostraPassword ? 'visibility_off' : 'visibility'}
                    etichetta={mostraPassword ? 'Nascondi password' : 'Mostra password'}
                    piccolo
                    onClick={() => setMostraPassword((v) => !v)}
                  />
                }
              />
              <Bottone type="submit" larghezzaPiena disabled={inCorso}>
                {fase === 'accesso' ? 'Accedi' : 'Registrati'}
              </Bottone>
            </form>
          </>
        )}

        {fase === 'completaProfilo' && (
          <form className="md-stack" onSubmit={completaProfilo}>
            <p className="md-body-medium" style={{ margin: 0 }}>
              Per attivare il tuo welfare servono i dati anagrafici. Il codice fiscale identifica
              in modo univoco la tua posizione.
            </p>
            <Campo
              etichetta="Nome"
              value={anagrafica.nome}
              onChange={(e) => setAnagrafica({ ...anagrafica, nome: e.target.value })}
              required
            />
            <Campo
              etichetta="Cognome"
              value={anagrafica.cognome}
              onChange={(e) => setAnagrafica({ ...anagrafica, cognome: e.target.value })}
              required
            />
            <Campo
              etichetta="Codice fiscale"
              value={anagrafica.cf}
              maxLength={16}
              supporto="16 caratteri, es. RSSMRA85T10A562S"
              onChange={(e) => setAnagrafica({ ...anagrafica, cf: normalizzaCF(e.target.value) })}
              required
            />
            <Bottone type="submit" larghezzaPiena disabled={inCorso}>Continua</Bottone>
            <Bottone variante="text" larghezzaPiena onClick={() => void auth.signOut()}>
              Usa un altro account
            </Bottone>
          </form>
        )}

        {fase === 'verificaEmail' && (
          <div className="md-stack">
            <p className="md-body-medium" style={{ margin: 0 }}>
              {emailInviata
                ? `Abbiamo inviato un link di conferma a ${utenteAuth?.email ?? 'il tuo indirizzo'}. `
                : 'Conferma il tuo indirizzo e-mail per proseguire. '}
              La verifica dell indirizzo e richiesta da Firebase prima di attivare la verifica in
              due passaggi.
            </p>
            <Bottone larghezzaPiena icona="refresh" onClick={controllaVerificaEmail} disabled={inCorso}>
              Ho verificato l e-mail
            </Bottone>
            <Bottone
              variante="text"
              larghezzaPiena
              disabled={inCorso}
              onClick={() => utenteAuth && void inviaEmailVerifica(utenteAuth)}
            >
              Invia di nuovo il link
            </Bottone>
            <Bottone variante="text" larghezzaPiena onClick={() => void auth.signOut()}>
              Usa un altro account
            </Bottone>
          </div>
        )}

        {(fase === 'iscrizioneMfa' || fase === 'verificaMfa') && (
          <>
            {!idVerifica && fase === 'iscrizioneMfa' && (
              <form className="md-stack" onSubmit={inviaSmsIscrizione}>
                <p className="md-body-medium" style={{ margin: 0 }}>
                  Proteggi l accesso con la verifica in due passaggi: inserisci il numero di
                  cellulare a cui inviare il codice.
                </p>
                <Campo
                  etichetta="Numero di cellulare"
                  type="tel"
                  value={telefono}
                  placeholder="+393401234567"
                  supporto="Formato internazionale, con prefisso +39"
                  onChange={(e) => setTelefono(e.target.value)}
                  required
                />
                <Bottone type="submit" larghezzaPiena disabled={inCorso} icona="sms">
                  Invia codice
                </Bottone>
                {mfaNonSupportata && (
                  <Bottone variante="text" larghezzaPiena onClick={prosegueSenzaMfa} disabled={inCorso}>
                    Continua senza verifica in due passaggi
                  </Bottone>
                )}
              </form>
            )}

            {idVerifica && (
              <form className="md-stack" onSubmit={confermaCodice}>
                <p className="md-body-medium" style={{ margin: 0 }}>
                  Abbiamo inviato un codice di 6 cifre
                  {fase === 'verificaMfa' ? ' al numero registrato.' : ` al numero ${telefono}.`}
                </p>
                <Campo
                  etichetta="Codice di verifica"
                  inputMode="numeric"
                  maxLength={6}
                  value={codiceSms}
                  onChange={(e) => setCodiceSms(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <Bottone type="submit" larghezzaPiena disabled={inCorso}>Conferma</Bottone>
                <Bottone
                  variante="text"
                  larghezzaPiena
                  disabled={inCorso}
                  onClick={() => { setIdVerifica(''); setErrore(''); azzeraVerificatore(); }}
                >
                  Cambia numero o richiedi un nuovo codice
                </Bottone>
              </form>
            )}
          </>
        )}
      </div>

      <div ref={contenitoreRecaptcha} />
    </main>
  );
}
