import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import '../styles/resistance-theme.css'
import './AuthForm.css'

interface AuthFormProps {
  onRequestFullscreen?: () => void
  onClose?: () => void
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
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          setMessage('ACCESO CONCEDIDO...')
        }
      } else {
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden')
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres')
          setLoading(false)
          return
        }

        const { error } = await signUp(email, password)
        if (error) {
          setError(error.message)
        } else {
          if (onRequestFullscreen) {
            onRequestFullscreen()
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          setMessage('REGISTRO EXITOSO. VERIFICA TU EMAIL.')
        }
      }
    } catch (err: any) {
      setError('ERROR DEL SISTEMA: ' + err.message)
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
    <div className="auth-container scanlines">
      {/* Background Matrix Effect */}
      <div className="matrix-bg"></div>

      <div className="auth-terminal">
        {/* Close Button */}
        {onClose && (
          <button className="auth-close-btn terminal-btn" onClick={onClose} type="button">
            [X]
          </button>
        )}

        {/* Header */}
        <div className="auth-header">
          <div className="auth-title mono-text-green">
            [ SISTEMA DE RESISTENCIA ]
          </div>
          <div className="auth-subtitle mono-text-amber">
            {isLogin ? '&gt;&gt;&gt; ACCESO RESTRINGIDO' : '&gt;&gt;&gt; NUEVO RECLUTA'}
          </div>
          <div className="auth-status mono-text-muted">
            {isLogin ? 'IDENTIFICACIÓN REQUERIDA' : 'REGISTRO DE AGENTE'}
          </div>
        </div>

        <div className="terminal-separator"></div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label mono-text-green" htmlFor="email">
              &gt; USUARIO:
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input mono-text"
              placeholder="agente@resistencia.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label mono-text-green" htmlFor="password">
              &gt; CÓDIGO DE ACCESO:
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="form-input mono-text"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label mono-text-green" htmlFor="confirmPassword">
                &gt; CONFIRMAR CÓDIGO:
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="form-input mono-text"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <div className="auth-alert alert-error mono-text">
              [!] {error}
            </div>
          )}

          {message && (
            <div className="auth-alert alert-success mono-text">
              [✓] {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn terminal-btn"
          >
            {loading ? '[ PROCESANDO... ]' : (isLogin ? '[ ACCEDER AL SISTEMA ]' : '[ REGISTRAR AGENTE ]')}
          </button>
        </form>

        <div className="terminal-separator"></div>

        {/* Footer */}
        <div className="auth-footer">
          <p className="auth-toggle-text mono-text-muted">
            {isLogin ? '¿NO TIENES ACCESO?' : '¿YA TIENES CREDENCIALES?'}
          </p>
          <button
            type="button"
            onClick={toggleMode}
            className="auth-toggle-btn mono-text-amber"
          >
            &gt; {isLogin ? 'SOLICITAR ACCESO' : 'INGRESAR'}
          </button>
        </div>

        {/* Version Info */}
        <div className="auth-version mono-text-muted">
          v1.0.0 | CLASSIFIED | {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default AuthForm