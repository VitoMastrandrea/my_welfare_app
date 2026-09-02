import { useNavigate } from 'react-router-dom';
import { IconBottone } from './md3';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../context/TemaContext';

interface Props {
  titolo: string;
  /** Percorso a cui tornare: se presente mostra la freccia indietro. */
  indietro?: string;
}

export function BarraSuperiore({ titolo, indietro }: Props) {
  const naviga = useNavigate();
  const { esci, utenteAuth } = useAuth();
  const { tema, cambiaTema } = useTema();

  return (
    <header className="md-top-app-bar">
      {indietro && (
        <IconBottone icona="arrow_back" etichetta="Torna indietro" onClick={() => naviga(indietro)} />
      )}
      <h1 className="md-top-app-bar__title md-title-large">{titolo}</h1>
      <IconBottone
        icona={tema === 'dark' ? 'light_mode' : 'dark_mode'}
        etichetta={tema === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
        onClick={cambiaTema}
      />
      {utenteAuth && <IconBottone icona="logout" etichetta="Esci" onClick={() => void esci()} />}
    </header>
  );
}
