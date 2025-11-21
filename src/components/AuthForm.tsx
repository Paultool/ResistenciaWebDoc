import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './AuthForm.css'

interface AuthFormProps {
  onRequestFullscreen?: () => void; 
  // 1. AGREGAR ESTA LÍNEA
  onClose?: () => void; 
}

// 2. AGREGAR onClose AQUÍ
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
            await new Promise(resolve => setTimeout(resolve, 50)); 
          }
          setMessage('Iniciando sistema...')
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
             await new Promise(resolve => setTimeout(resolve, 50)); 
           }
          setMessage('Registro exitoso. Verifica tu email.')
        }
      }
    } catch (err: any) {
      setError('Error del sistema: ' + err.message)
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
        
        {/* 3. AGREGAR ESTE BLOQUE PARA EL BOTÓN */}
        {onClose && (
            <button className="af-close-btn" onClick={onClose} type="button">
                ✕
            </button>
        )}
        
        <div className="af-header">
          <h2 className="af-title">{isLogin ? 'ACCESO AL SISTEMA' : 'NUEVO RECLUTA'}</h2>
          <p className="af-subtitle">
            {isLogin 
              ? 'Identifícate para continuar' 
              : 'Únete a La Resistencia'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="af-form">
          <div className="af-form-group">
            <label className="af-label" htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="af-input"
              placeholder="agente@resistencia.com"
              autoComplete="email"
            />
          </div>

          <div className="af-form-group">
            <label className="af-label" htmlFor="password">Código de Acceso</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="af-input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {!isLogin && (
            <div className="af-form-group">
              <label className="af-label" htmlFor="confirmPassword">Confirmar Código</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="af-input"
                placeholder="••••••••"
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
            {loading ? 'PROCESANDO...' : (isLogin ? 'INGRESAR' : 'REGISTRARSE')}
          </button>
        </form>

        <div className="af-footer">
          <p className="af-text">
            {isLogin ? '¿Aún no eres miembro?' : '¿Ya tienes credenciales?'}
            <button 
              type="button" 
              onClick={toggleMode}
              className="af-link"
            >
              {isLogin ? 'Solicitar Acceso' : 'Ingresar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthForm