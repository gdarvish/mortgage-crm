import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import './index.css'
import App from './App.tsx'

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

// reCAPTCHA is optional — the app runs without a site key configured.
const tree = recaptchaSiteKey ? (
  <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey}>
    <App />
  </GoogleReCaptchaProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{tree}</StrictMode>,
)
