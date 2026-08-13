import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AdminApp } from './admin/AdminApp.tsx'
import { PasswordRecovery } from './admin/PasswordRecovery.tsx'
import { DailyChallenge } from './pages/DailyChallenge.tsx'

// Supabase's password-recovery email always redirects to the project's Site
// URL root with a #access_token=...&type=recovery fragment — it can't be
// pointed at a specific app route. Catch it here, before the router, so it
// works no matter what "/" currently renders.
const isPasswordRecovery = window.location.hash.includes('type=recovery');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPasswordRecovery ? (
      <PasswordRecovery />
    ) : (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/daily" element={<DailyChallenge />} />
          <Route path="/daily/:date" element={<DailyChallenge />} />
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </BrowserRouter>
    )}
  </StrictMode>,
)
