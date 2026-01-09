import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AuthCallback from './views/AuthCallback.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import './index.css'

// Simple routing based on pathname
const pathname = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      {pathname === '/auth/callback' ? <AuthCallback /> : <App />}
    </AuthProvider>
  </React.StrictMode>,
)
