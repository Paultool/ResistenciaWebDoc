import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import './AuthForm.css'

interface AuthFormProps {
  onRequestFullscreen?: () => void;
  onClose?: () => void;
}

const authTranslations = {
  es: {
    loginTitle: 'INICIO DE SESIÓN',
    registerTitle: 'NUEVO USUARIO',
    subtitleLogin: '> IDENTIFÍCATE PARA ACCEDER',
    subtitleRegister: '> INICIANDO PROTOCOLO DE RECLUTAMIENTO',
    emailLabel: 'ID DE USUARIO (EMAIL)',
    passwordLabel: 'CLAVE DE ACCESO',
    confirmPasswordLabel: 'CONFIRMAR CLAVE',
    emailPlaceholder: 'agente@resistencia.com',
    passwordPlaceholder: '••••••••',
    errorPasswordMismatch: 'CONTRASEÑAS NO COINCIDEN',
    errorPasswordShort: 'CONTRASEÑA MUY CORTA (MIN 6 CARACTERES)',
    errorSystem: 'ERROR DEL SISTEMA: ',
    successAccess: 'ACCESO CONCEDIDO. INICIALIZANDO...',
    successRegister: 'REGISTRO EXITOSO. VERIFICA EMAIL.',
    submitLogin: '[ INICIAR SESIÓN ]',
    submitRegister: '[ REGISTRARSE ]',
    noAccount: '¿SIN CREDENCIALES?',
    hasAccount: '¿YA TIENES CUENTA?',
    linkRequest: 'SOLICITAR ACCESO',
    linkLogin: 'INGRESAR',
    abort: 'ABORTAR CONEXIÓN'
  },
  en: {
    loginTitle: 'SYSTEM LOGIN',
    registerTitle: 'NEW USER',
    subtitleLogin: '> IDENTIFY TO ACCESS',
    subtitleRegister: '> INITIATING RECRUITMENT PROTOCOL',
    emailLabel: 'USER ID (EMAIL)',
    passwordLabel: 'ACCESS KEY',
    confirmPasswordLabel: 'CONFIRM KEY',
    emailPlaceholder: 'agent@resistance.com',
    passwordPlaceholder: '••••••••',
    errorPasswordMismatch: 'PASSWORD MISMATCH',
    errorPasswordShort: 'PASSWORD TOO SHORT (MIN 6 CHARS)',
    errorSystem: 'SYSTEM ERROR: ',
    successAccess: 'ACCESS GRANTED. INITIALIZING...',
    successRegister: 'REGISTRATION SUCCESS. CHECK EMAIL.',
    submitLogin: '[ LOGIN ]',
    submitRegister: '[ REGISTER ]',
    noAccount: 'NO CREDENTIALS?',
    hasAccount: 'ALREADY HAVE AN ACCOUNT?',
    linkRequest: 'REQUEST ACCESS',
    linkLogin: 'ENTER',
    abort: 'ABORT CONNECTION'
  }
}

const AuthForm: React.FC<AuthFormProps> = ({ onRequestFullscreen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const { signIn, signUp } = useAuth()
  const { language } = useLanguage()
  const t = authTranslations[language]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          if (onRequestFullscreen) {
            onRequestFullscreen()
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          setMessage(t.successAccess)
        }
      } else {
        if (password !== confirmPassword) {
          setError(t.errorPasswordMismatch)
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError(t.errorPasswordShort)
          setLoading(false)
          return
        }

        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          if (onRequestFullscreen) {
            onRequestFullscreen()
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          setMessage(t.successRegister)
        }
      }
    } catch (err: any) {
      setError(t.errorSystem + err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setError('')
    setMessage('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="af-container">
      <div className="af-card">

        {/* Botón Cerrar Táctico */}
        {onClose && (
          <button className="af-close-btn" onClick={onClose} type="button" title={t.abort}>
            ✕
          </button>
        )}

        {/* Header Terminal */}
        <div className="af-header">
          <h2 className="af-title">{isLogin ? t.loginTitle : t.registerTitle}</h2>
          <p className="af-subtitle">
            {isLogin
              ? t.subtitleLogin
              : t.subtitleRegister}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="af-form">
          <div className="af-form-group">
            <label className="af-label" htmlFor="email">{t.emailLabel}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="af-input"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
            />
          </div>

          <div className="af-form-group">
            <label className="af-label" htmlFor="password">{t.passwordLabel}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="af-input"
              placeholder={t.passwordPlaceholder}
              autoComplete="current-password"
            />
          </div>

          {!isLogin && (
            <div className="af-form-group">
              <label className="af-label" htmlFor="confirmPassword">{t.confirmPasswordLabel}</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="af-input"
                placeholder={t.passwordPlaceholder}
              />
            </div>
          )}

          {error && (
            <div className="af-alert af-alert-error">
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div className="af-alert af-alert-success">
              🚀 {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="af-btn-submit"
          >
            {loading ? '...' : (isLogin ? t.submitLogin : t.submitRegister)}
          </button>
        </form>

        <div className="af-footer">
          <p className="af-text">
            {isLogin ? t.noAccount : t.hasAccount}
            <button
              type="button"
              onClick={toggleMode}
              className="af-link"
            >
              {isLogin ? t.linkRequest : t.linkLogin}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthForm