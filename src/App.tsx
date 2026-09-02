import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { TemaProvider } from './context/TemaContext';
import { RottaProtetta } from './components/RottaProtetta';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminUtentiPage } from './pages/AdminUtentiPage';
import { AdminAttivitaPage } from './pages/AdminAttivitaPage';

export default function App() {
  return (
    <TemaProvider>
      <SnackbarProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Pagina 1 */}
              <Route path="/login" element={<LoginPage />} />

              {/* Pagine 2 e 3: la dashboard si adatta al ruolo */}
              <Route
                path="/"
                element={
                  <RottaProtetta>
                    <DashboardPage />
                  </RottaProtetta>
                }
              />

              {/* Pagina 5 */}
              <Route
                path="/admin/utenti"
                element={
                  <RottaProtetta soloAdmin>
                    <AdminUtentiPage />
                  </RottaProtetta>
                }
              />

              {/* Pagina 6 */}
              <Route
                path="/admin/attivita"
                element={
                  <RottaProtetta soloAdmin>
                    <AdminAttivitaPage />
                  </RottaProtetta>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </SnackbarProvider>
    </TemaProvider>
  );
}
