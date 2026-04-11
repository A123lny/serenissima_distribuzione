import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Layout/Navbar'
import BottomNav from './components/Layout/BottomNav'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import GiriPage from './pages/GiriPage'
import ConsegnaPage from './pages/ConsegnaPage'
import StoricoPage from './pages/StoricoPage'
import ReportPage from './pages/ReportPage'
import UtentiPage from './pages/UtentiPage'

function ProtectedRoute({ children, permesso }) {
  const { utente, loading, haPermesso } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!utente) return <Navigate to="/login" replace />
  if (permesso && !haPermesso(permesso)) return <Navigate to="/" replace />

  return children
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/giri" element={<ProtectedRoute permesso="giri"><GiriPage /></ProtectedRoute>} />
          <Route path="/consegna" element={<ProtectedRoute permesso="consegne"><ConsegnaPage /></ProtectedRoute>} />
          <Route path="/storico" element={<ProtectedRoute permesso="storico"><StoricoPage /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute permesso="report"><ReportPage /></ProtectedRoute>} />
          <Route path="/utenti" element={<ProtectedRoute permesso="utenti"><UtentiPage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNavWrapper />
    </div>
  )
}

function BottomNavWrapper() {
  const { utente } = useAuth()
  if (!utente) return null
  return <BottomNav />
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppLayout />
      </HashRouter>
    </AuthProvider>
  )
}
