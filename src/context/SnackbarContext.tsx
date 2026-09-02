import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type TipoMessaggio = 'error' | 'success' | 'info';

interface Messaggio {
  id: number;
  testo: string;
  tipo: TipoMessaggio;
}

interface ContestoSnackbar {
  mostraErrore: (testo: string) => void;
  mostraSuccesso: (testo: string) => void;
  mostraInfo: (testo: string) => void;
}

const Contesto = createContext<ContestoSnackbar | null>(null);

const ICONE: Record<TipoMessaggio, string> = {
  error: 'error',
  success: 'check_circle',
  info: 'info',
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);

  const rimuovi = useCallback((id: number) => {
    setMessaggi((precedenti) => precedenti.filter((m) => m.id !== id));
  }, []);

  const mostra = useCallback(
    (testo: string, tipo: TipoMessaggio) => {
      const id = Date.now() + Math.random();
      setMessaggi((precedenti) => [...precedenti.slice(-2), { id, testo, tipo }]);
      window.setTimeout(() => rimuovi(id), tipo === 'error' ? 6000 : 4000);
    },
    [rimuovi],
  );

  const valore = useMemo<ContestoSnackbar>(
    () => ({
      mostraErrore: (testo) => mostra(testo, 'error'),
      mostraSuccesso: (testo) => mostra(testo, 'success'),
      mostraInfo: (testo) => mostra(testo, 'info'),
    }),
    [mostra],
  );

  return (
    <Contesto.Provider value={valore}>
      {children}
      <div className="md-snackbar-host" role="status" aria-live="polite">
        {messaggi.map((messaggio) => (
          <div key={messaggio.id} className={`md-snackbar md-snackbar--${messaggio.tipo}`}>
            <span className="material-symbols-rounded md-snackbar__icon">{ICONE[messaggio.tipo]}</span>
            <span className="md-snackbar__text">{messaggio.testo}</span>
            <button
              type="button"
              className="md-icon-button md-icon-button--small"
              aria-label="Chiudi messaggio"
              onClick={() => rimuovi(messaggio.id)}
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
        ))}
      </div>
    </Contesto.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSnackbar(): ContestoSnackbar {
  const contesto = useContext(Contesto);
  if (!contesto) throw new Error('useSnackbar richiede SnackbarProvider.');
  return contesto;
}
