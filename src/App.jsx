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

function ProtectedRoute({ children, adminOnly = false }) {
  const { utente, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!utente) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />

  return children
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/giri" element={<ProtectedRoute adminOnly><GiriPage /></ProtectedRoute>} />
          <Route path="/consegna" element={<ProtectedRoute><ConsegnaPage /></ProtectedRoute>} />
          <Route path="/storico" element={<ProtectedRoute><StoricoPage /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute adminOnly><ReportPage /></ProtectedRoute>} />
          <Route path="/utenti" element={<ProtectedRoute adminOnly><UtentiPage /></ProtectedRoute>} />
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
