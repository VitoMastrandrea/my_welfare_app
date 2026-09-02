import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { auth, storage } from '../firebase';
import { aggiornaUtente } from './users';

const LATO_MAX = 320;

/** Ridimensiona e comprime l'immagine scelta, restituendo una data URL JPEG. */
export function ridimensionaImmagine(file: File): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    if (!file.type.startsWith('image/')) {
      rifiuta(new Error('Il file selezionato non e un immagine.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      rifiuta(new Error('Immagine troppo grande: il limite e 8 MB.'));
      return;
    }

    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error('Impossibile leggere il file.'));
    lettore.onload = () => {
      const immagine = new Image();
      immagine.onerror = () => rifiuta(new Error('Formato immagine non supportato.'));
      immagine.onload = () => {
        const lato = Math.min(immagine.width, immagine.height);
        const tela = document.createElement('canvas');
        tela.width = LATO_MAX;
        tela.height = LATO_MAX;
        const contesto = tela.getContext('2d');
        if (!contesto) {
          rifiuta(new Error('Canvas non disponibile in questo browser.'));
          return;
        }
        // Ritaglio quadrato centrato.
        contesto.drawImage(
          immagine,
          (immagine.width - lato) / 2,
          (immagine.height - lato) / 2,
          lato,
          lato,
          0,
          0,
          LATO_MAX,
          LATO_MAX,
        );
        risolvi(tela.toDataURL('image/jpeg', 0.82));
      };
      immagine.src = lettore.result as string;
    };
    lettore.readAsDataURL(file);
  });
}

/**
 * Salva la foto profilo. Prova prima Firebase Storage; se il bucket non e'
 * configurato o non e' raggiungibile ripiega sulla data URL compressa
 * (circa 20 KB, ben sotto il limite di 1 MB per documento Firestore).
 */
export async function caricaFotoProfilo(uid: string, file: File): Promise<string> {
  const dataUrl = await ridimensionaImmagine(file);
  let url = dataUrl;

  if (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) {
    try {
      const destinazione = ref(storage, `profile-photos/${uid}.jpg`);
      await uploadString(destinazione, dataUrl, 'data_url');
      url = await getDownloadURL(destinazione);
    } catch {
      // Storage non disponibile: si prosegue con la data URL.
      url = dataUrl;
    }
  }

  await aggiornaUtente(uid, { photoURL: url });
  if (auth.currentUser && auth.currentUser.uid === uid && url.startsWith('http')) {
    await updateProfile(auth.currentUser, { photoURL: url });
  }
  return url;
}
