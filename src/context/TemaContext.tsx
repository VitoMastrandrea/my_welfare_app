import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Tema = 'light' | 'dark';

interface ContestoTema {
  tema: Tema;
  cambiaTema: () => void;
}

const Contesto = createContext<ContestoTema | null>(null);
const CHIAVE = 'welfare-tema';

function temaIniziale(): Tema {
  try {
    const salvato = localStorage.getItem(CHIAVE);
    if (salvato === 'light' || salvato === 'dark') return salvato;
  } catch {
    /* localStorage non disponibile */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaIniziale);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try {
      localStorage.setItem(CHIAVE, tema);
    } catch {
      /* niente da fare */
    }
  }, [tema]);

  const valore = useMemo<ContestoTema>(
    () => ({ tema, cambiaTema: () => setTema((precedente) => (precedente === 'dark' ? 'light' : 'dark')) }),
    [tema],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTema(): ContestoTema {
  const contesto = useContext(Contesto);
  if (!contesto) throw new Error('useTema richiede TemaProvider.');
  return contesto;
}
