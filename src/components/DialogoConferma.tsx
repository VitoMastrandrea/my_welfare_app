import { Bottone, Dialog, BannerErrore } from './md3';

interface Props {
  aperto: boolean;
  titolo: string;
  messaggio: string;
  etichettaConferma?: string;
  onConferma: () => void;
  onChiudi: () => void;
  inCorso?: boolean;
}

/** Conferma distruttiva (eliminazione utente o attivita'). */
export function DialogoConferma({
  aperto,
  titolo,
  messaggio,
  etichettaConferma = 'Elimina',
  onConferma,
  onChiudi,
  inCorso,
}: Props) {
  return (
    <Dialog
      aperto={aperto}
      titolo={titolo}
      onChiudi={onChiudi}
      azioni={
        <>
          <Bottone variante="text" onClick={onChiudi} disabled={inCorso}>Cancella</Bottone>
          <Bottone variante="danger" icona="delete" onClick={onConferma} disabled={inCorso}>
            {etichettaConferma}
          </Bottone>
        </>
      }
    >
      <BannerErrore testo={messaggio} />
    </Dialog>
  );
}
