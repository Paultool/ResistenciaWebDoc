import React, { useState, useEffect, useRef } from 'react'
import { obtenerPersonajes, Personaje } from '../supabaseClient'
import { gameServiceUser as gameService } from '../services/GameServiceUser'
import { useAuth } from '../contexts/AuthContext'
import './PersonajesView.css'

interface PersonajesViewProps {
  onBack?: () => void
}

const PersonajesView: React.FC<PersonajesViewProps> = ({ onBack }) => {
  const { user } = useAuth()
  const [personajes, setPersonajes] = useState<Personaje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPersonaje, setSelectedPersonaje] = useState<Personaje | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cargarPersonajes()
  }, [])

  const cargarPersonajes = async () => {
    try {
      setLoading(true)
      setError(null)
      const personajesData = await obtenerPersonajes()
      setPersonajes(personajesData)
    } catch (err: any) {
      console.error('Error:', err)
      setError('ERROR DE SISTEMA: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMeetCharacter = async (personaje: Personaje) => {
    if (!user?.id) return
    try {
      const gameEvent = await gameService.meetCharacter(user.id, personaje.nombre.toString())
      if (gameEvent) {
        alert(`[ REGISTRO ACTUALIZADO ]\nSujeto: ${personaje.nombre}\nXP Ganada: +${gameEvent.xp_ganado}`)
        window.dispatchEvent(new Event('statsUpdated'))
      } else {
        alert(`[ INFORMACIÓN ]\nEl sujeto ${personaje.nombre} ya está registrado en la base de datos.`)
      }
    } catch (error: any) {
      console.error('Error:', error)
      alert('ERROR AL PROCESAR SOLICITUD.')
    }
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="pv-container flex items-center justify-center">
        <div className="text-[#33ff00] text-xl animate-pulse font-mono">
          {'>'} CARGANDO BASE DE DATOS DE SUJETOS...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pv-container">
        <div className="pv-header">
          <h2>BASE DE DATOS</h2>
        </div>
        <div className="pv-status">
          <p>[ ! ] {error}</p>
          <button onClick={cargarPersonajes} className="pv-btn-retry">REINTENTAR CONEXIÓN</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pv-container">

      {/* HEADER */}
      <div className="pv-header">
        <div>
          <h2>BASE DE DATOS</h2>
          <p>REGISTRO DE SUJETOS CLAVE</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="border border-[#33ff00] text-[#33ff00] bg-transparent px-4 py-2 font-bold uppercase hover:bg-[#33ff00] hover:text-black transition-all"
          >
            [ X ] CERRAR
          </button>
        )}
      </div>

      <div className="pv-stats">
        <span className="pv-stat-item">SUJETOS IDENTIFICADOS: <span className="pv-stat-highlight">{personajes.length}</span></span>
        <span className="pv-stat-item">ESTADO: <span style={{ color: '#33ff00' }}>EN LÍNEA</span></span>
      </div>

      {/* CAROUSEL CONTAINER */}
      <div className="pv-carousel-wrapper">
        <button className="pv-nav-btn pv-nav-left" onClick={scrollLeft}>{'<'}</button>

        {/* GRID */}
        <div className="pv-grid" ref={scrollContainerRef}>
          {personajes.map((personaje) => {
            const atributos = personaje.metadata || {}

            return (
              <div key={personaje.id} className="pv-card">

                {/* Imagen Mugshot */}
                <div className="pv-image-container">
                  {personaje.imagen ? (
                    <img src={personaje.imagen} alt={personaje.nombre} loading="lazy" />
                  ) : (
                    <div className="pv-placeholder">?</div>
                  )}
                </div>

                <div className="pv-info">
                  <h3 className="pv-name">{personaje.nombre}</h3>
                  <p className="pv-rol">{personaje.rol || 'ROL DESCONOCIDO'}</p>

                  <p className="pv-desc">
                    {personaje.descripcion || 'DATOS NO DISPONIBLES.'}
                  </p>

                  {atributos.edad && (
                    <div className="pv-meta-row">
                      <span className="pv-meta-label">EDAD:</span> {atributos.edad}
                    </div>
                  )}

                  {atributos.profesion && (
                    <div className="pv-meta-row">
                      <span className="pv-meta-label">OCUPACIÓN:</span> {atributos.profesion}
                    </div>
                  )}
                </div>

                <div className="pv-actions">
                  <button onClick={() => setSelectedPersonaje(personaje)} className="pv-btn">
                    [ VER EXPEDIENTE ]
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button className="pv-nav-btn pv-nav-right" onClick={scrollRight}>{'>'}</button>
      </div>

      {/* MODAL EXPEDIENTE */}
      {selectedPersonaje && (
        <div className="pv-modal-overlay" onClick={() => setSelectedPersonaje(null)}>
          <div className="pv-modal" onClick={(e) => e.stopPropagation()}>

            <div className="pv-modal-header">
              <h2 className="pv-modal-title">{selectedPersonaje.nombre}</h2>
              <button onClick={() => setSelectedPersonaje(null)} className="pv-modal-close">X</button>
            </div>

            <div className="pv-modal-content">
              {/* Columna Izquierda: Imagen */}
              <div className="pv-modal-img-container">
                {selectedPersonaje.imagen ? (
                  <img src={selectedPersonaje.imagen} alt={selectedPersonaje.nombre} />
                ) : (
                  <div className="pv-placeholder" style={{ color: '#33ff00', fontSize: '5rem' }}>?</div>
                )}
              </div>

              {/* Columna Derecha: Info */}
              <div className="pv-modal-info">
                <div>
                  <h4 className="pv-section-title">CLASIFICACIÓN / ROL</h4>
                  <p className="pv-modal-desc" style={{ color: '#33ff00', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {selectedPersonaje.rol || 'NO CLASIFICADO'}
                  </p>
                </div>

                <div>
                  <h4 className="pv-section-title">PERFIL PSICOLÓGICO / BIO</h4>
                  <p className="pv-modal-desc">{selectedPersonaje.descripcion}</p>
                </div>

                {selectedPersonaje.metadata && (
                  <div>
                    <h4 className="pv-section-title">ATRIBUTOS TÉCNICOS</h4>
                    <div className="pv-attr-grid">
                      {Object.entries(selectedPersonaje.metadata).map(([key, value]) => (
                        <div key={key} className="pv-attr-row">
                          <span className="pv-attr-key">{key}</span>
                          <span className="pv-attr-val">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pv-modal-actions">
              <button
                onClick={() => handleMeetCharacter(selectedPersonaje)}
                className="pv-btn"
                style={{ width: 'auto', display: 'inline-block', border: '1px solid #fff', color: '#fff' }}
              >
                [+] REGISTRAR ENCUENTRO (+25 XP)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonajesView