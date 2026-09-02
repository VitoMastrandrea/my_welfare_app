import { multiFactor, type User } from 'firebase/auth';
import type { Utente } from '../types';

/**
 * true quando l'utente deve ancora registrare il secondo fattore.
 * Chi ha esplicitamente proseguito senza 2FA (progetto Firebase senza MFA)
 * non viene piu' bloccato, ma resta segnalato nel profilo.
 */
export function secondoFattoreRichiesto(utenteAuth: User | null, profilo: Utente | null): boolean {
  if (!utenteAuth || !profilo) return false;
  if (profilo.mfaSaltata) return false;
  return multiFactor(utenteAuth).enrolledFactors.length === 0;
}
