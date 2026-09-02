import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, firebaseConfigurato } from '../firebase';
import { ascoltaUtente } from '../services/users';
import type { Utente } from '../types';

interface StatoAutenticazione {
  /** Account Firebase Auth attualmente collegato. */
  utenteAuth: User | null;
  /** Documento Firestore con i dati anagrafici e il credito. */
  profilo: Utente | null;
  /** true finche' non si conosce lo stato di autenticazione. */
  caricamento: boolean;
  /** true quando l account esiste ma manca il profilo (registrazione da completare). */
  profiloDaCompletare: boolean;
  isAdmin: boolean;
  esci: () => Promise<void>;
}

const Contesto = createContext<StatoAutenticazione | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utenteAuth, setUtenteAuth] = useState<User | null>(null);
  const [profilo, setProfilo] = useState<Utente | null>(null);
  const [caricamentoAuth, setCaricamentoAuth] = useState(firebaseConfigurato);
  const [caricamentoProfilo, setCaricamentoProfilo] = useState(false);

  useEffect(() => {
    if (!firebaseConfigurato) return;
    return onAuthStateChanged(auth, (utente) => {
      setUtenteAuth(utente);
      setCaricamentoAuth(false);
      if (!utente) {
        setProfilo(null);
        setCaricamentoProfilo(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!utenteAuth) return;
    setCaricamentoProfilo(true);
    return ascoltaUtente(
      utenteAuth.uid,
      (documento) => {
        setProfilo(documento);
        setCaricamentoProfilo(false);
      },
      () => {
        setProfilo(null);
        setCaricamentoProfilo(false);
      },
    );
  }, [utenteAuth]);

  const valore = useMemo<StatoAutenticazione>(
    () => ({
      utenteAuth,
      profilo,
      caricamento: caricamentoAuth || caricamentoProfilo,
      profiloDaCompletare: Boolean(utenteAuth) && !caricamentoProfilo && profilo === null,
      isAdmin: profilo?.ruolo === 'admin',
      esci: async () => {
        await signOut(auth);
      },
    }),
    [utenteAuth, profilo, caricamentoAuth, caricamentoProfilo],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): StatoAutenticazione {
  const contesto = useContext(Contesto);
  if (!contesto) throw new Error('useAuth richiede AuthProvider.');
  return contesto;
}
