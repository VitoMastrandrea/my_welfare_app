import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const configurazione: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configurazioneCompleta = Boolean(
  configurazione.apiKey && configurazione.projectId && configurazione.appId,
);

/** Sviluppo locale con la Firebase Emulator Suite (`npm run emulators`). */
export const usaEmulatori = import.meta.env.VITE_USE_EMULATORS === 'true';

/** Progetto usato dagli emulatori quando non e' indicato in .env. */
const progettoDemo = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-welfare';

/** false quando il file .env non e' stato compilato: la UI mostra le istruzioni. */
export const firebaseConfigurato = usaEmulatori || configurazioneCompleta;

export const app = initializeApp(
  configurazioneCompleta
    ? configurazione
    : {
        apiKey: 'demo-api-key',
        authDomain: `${progettoDemo}.firebaseapp.com`,
        projectId: progettoDemo,
        storageBucket: `${progettoDemo}.appspot.com`,
        appId: 'demo-app-id',
      },
);

export const auth = getAuth(app);
auth.useDeviceLanguage();

export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (usaEmulatori) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
} else if (firebaseConfigurato) {
  void setPersistence(auth, browserLocalPersistence);
}
