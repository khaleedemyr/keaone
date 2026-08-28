import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FeedbackProvider } from './components/feedback'
import { LoadingOverlay } from './components/LoadingOverlay'
import { I18nProvider } from './i18n'
import { ThemeProvider } from './theme'
import { UiSkinProvider } from './uiSkin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <UiSkinProvider>
          <FeedbackProvider>
            <LoadingOverlay />
            <App />
          </FeedbackProvider>
        </UiSkinProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
