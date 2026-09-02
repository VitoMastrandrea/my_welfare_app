import { useRef, useState } from 'react';
import { Icona } from './md3';
import { caricaFotoProfilo } from '../services/photo';
import { messaggioErrore } from '../services/errors';
import { useSnackbar } from '../context/SnackbarContext';

interface Props {
  uid: string;
  nome: string;
  cognome: string;
  photoURL: string;
  /** Se false la foto non e' modificabile (es. anteprima di un altro utente). */
  modificabile?: boolean;
  piccola?: boolean;
}

function iniziali(nome: string, cognome: string): string {
  return `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase() || '?';
}

/** Foto profilo cliccabile: un click apre la selezione del file e la salva. */
export function FotoProfilo({ uid, nome, cognome, photoURL, modificabile = true, piccola }: Props) {
  const inputFile = useRef<HTMLInputElement>(null);
  const [inCaricamento, setInCaricamento] = useState(false);
  const { mostraErrore, mostraSuccesso } = useSnackbar();

  const alCambioFile = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const file = evento.target.files?.[0];
    evento.target.value = '';
    if (!file) return;

    setInCaricamento(true);
    try {
      await caricaFotoProfilo(uid, file);
      mostraSuccesso('Foto profilo aggiornata.');
    } catch (errore) {
      mostraErrore(messaggioErrore(errore));
    } finally {
      setInCaricamento(false);
    }
  };

  const contenuto = photoURL ? (
    <img src={photoURL} alt={`Foto di ${nome} ${cognome}`} />
  ) : (
    <span>{iniziali(nome, cognome)}</span>
  );

  if (!modificabile) {
    return <span className={`md-avatar ${piccola ? 'md-avatar--small' : ''}`}>{contenuto}</span>;
  }

  return (
    <>
      <button
        type="button"
        className={`md-avatar ${piccola ? 'md-avatar--small' : ''}`}
        onClick={() => inputFile.current?.click()}
        aria-label="Cambia foto profilo"
        title="Cambia foto profilo"
        disabled={inCaricamento}
      >
        {inCaricamento ? <Icona nome="hourglass_top" /> : contenuto}
        {!piccola && (
          <span className="md-avatar__overlay">
            <Icona nome="photo_camera" style={{ fontSize: 18 }} />
          </span>
        )}
      </button>
      <input
        ref={inputFile}
        type="file"
        accept="image/*"
        className="md-visually-hidden"
        onChange={alCambioFile}
      />
    </>
  );
}
