import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const isMobileBuild = import.meta.env.VITE_APP_ENV === 'mobile'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <AppLoadingScreen enabled={isMobileBuild} />
    </ErrorBoundary>
  </StrictMode>,
)
