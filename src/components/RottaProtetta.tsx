import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Caricamento } from './md3';
import { useAuth } from '../context/AuthContext';
import { secondoFattoreRichiesto } from '../services/mfa';

interface Props {
  children: ReactNode;
  /** Se true la rotta e' accessibile solo agli amministratori. */
  soloAdmin?: boolean;
}

/** Filtra l accesso alle pagine in base ad autenticazione e ruolo. */
export function RottaProtetta({ children, soloAdmin }: Props) {
  const { utenteAuth, profilo, caricamento, isAdmin } = useAuth();

  if (caricamento) return <Caricamento />;
  if (!utenteAuth || !profilo) return <Navigate to="/login" replace />;
  if (secondoFattoreRichiesto(utenteAuth, profilo)) return <Navigate to="/login" replace />;
  if (soloAdmin && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
