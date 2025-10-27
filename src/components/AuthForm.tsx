import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './AuthForm.css'

// 1. Añadir la interfaz de props para Fullscreen
interface AuthFormProps {
  // Función para reafirmar la pantalla completa
  onRequestFullscreen?: () => void; 
}

// 2. Aceptar la prop
const AuthForm: React.FC<AuthFormProps> = ({ onRequestFullscreen }) => {
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
        // Iniciar sesión
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          if (onRequestFullscreen) {
            // 🔑 FIX CLAVE DE TIEMPO:
            // 1. Reafirma la solicitud de Fullscreen.
            onRequestFullscreen()
            
            // 2. Espera 50ms antes de que el estado de AuthContext cambie.
            // Esto asegura que el navegador tenga tiempo de procesar el re-request 
            // de fullscreen, manteniendo la interfaz en FullScreen al cargar el Dashboard.
            await new Promise(resolve => setTimeout(resolve, 50)); 
          }
          setMessage('¡Inicio de sesión exitoso!')
          // NOTA: El cambio de estado de AuthContext ocurre inmediatamente después de este bloque.
        }
      } else {
        // Registro
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
             // Aplicar la misma espera para el registro
             onRequestFullscreen()
             await new Promise(resolve => setTimeout(resolve, 50)); 
           }
          setMessage('¡Registro exitoso! Revisa tu email para confirmar tu cuenta.')
        }
      }
    } catch (err: any) {
      setError('Error inesperado: ' + err.message)
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
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isLogin ? '🔑 Iniciar Sesión' : '📝 Registro'}</h2>
          <p className="auth-subtitle">
            {isLogin 
              ? 'Accede a tu cuenta de La Resistencia' 
              : 'Únete a la narrativa urbana'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">📧 Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-control"
              placeholder="tu@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">🔒 Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="form-control"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">🔒 Confirmar Contraseña</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="form-control"
                placeholder="Repite tu contraseña"
              />
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              ❌ {error}
            </div>
          )}

          {message && (
            <div className="alert alert-success">
              ✅ {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '⏳ Procesando...' : (isLogin ? '🚪 Entrar' : '📝 Registrarse')}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button 
              type="button" 
              onClick={toggleMode}
              className="btn btn-link"
            >
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthForm