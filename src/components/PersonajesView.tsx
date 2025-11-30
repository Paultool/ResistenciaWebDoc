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
    <div className="relative min-h-screen bg-black text-[#a8a8a8] font-mono selection:bg-[#33ff00] selection:text-black overflow-hidden flex flex-col">

      {/* Fondo Scanlines (Igual que Flujo Narrativo) */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20 fixed"
        style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}>
      </div>

      {/* Header de Estadísticas */}
      <div className="relative z-10 p-4 flex justify-between items-center border-b border-[#33ff00]/30 bg-black/80 backdrop-blur-sm">
        <div className="flex gap-4 text-xs md:text-sm">
          <span className="text-[#33ff00]">SUJETOS IDENTIFICADOS: <span className="font-bold text-white">{personajes.length}</span></span>
          <span className="text-[#33ff00]">ESTADO: <span className="font-bold text-white animate-pulse">EN LÍNEA</span></span>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-[#33ff00] hover:text-white border border-[#33ff00] px-3 py-1 text-xs uppercase">
            [ VOLVER ]
          </button>
        )}
      </div>

      {/* --- ÁREA PRINCIPAL (CARRUSEL) --- */}
      <div className="relative z-10 flex-grow flex items-center w-full overflow-hidden">

        {/* Botón Navegación Izquierda */}
        <button
          onClick={scrollLeft}
          className="hidden md:flex absolute left-4 z-50 w-12 h-12 border border-[#33ff00]/50 bg-black/50 text-[#33ff00] items-center justify-center hover:bg-[#33ff00] hover:text-black transition-all rounded-full backdrop-blur-md"
        >
          {'<'}
        </button>

        {/* Botón Navegación Derecha */}
        <button
          onClick={scrollRight}
          className="hidden md:flex absolute right-4 z-50 w-12 h-12 border border-[#33ff00]/50 bg-black/50 text-[#33ff00] items-center justify-center hover:bg-[#33ff00] hover:text-black transition-all rounded-full backdrop-blur-md"
        >
          {'>'}
        </button>

        {/* --- CONTENEDOR DE SCROLL --- */}
        <div
          ref={scrollContainerRef}
          className="w-full h-full flex items-center gap-6 overflow-x-auto px-6 md:px-16 snap-x snap-mandatory no-scrollbar py-8"
          style={{ scrollBehavior: 'smooth' }}
        >
          {personajes.map((personaje) => {
            const atributos = personaje.metadata || {}
            return (
              <div key={personaje.id}
                className="
                            relative shrink-0 snap-center
                            w-[85vw] landscape:w-[400px] landscape:h-[90vh] h-[60vh]
                            md:w-[200px] md:h-[500px]
                            border-2 border-[#33ff00]/30 bg-black overflow-hidden flex flex-col transition-all duration-300
                            hover:border-[#33ff00] hover:shadow-[0_0_20px_rgba(51,255,0,0.2)]
                        "
              >
                {/* Imagen */}
                <div className="relative h-3/5 w-full border-b border-[#33ff00]/30">
                  {personaje.imagen ? (
                    <img src={personaje.imagen} alt={personaje.nombre} className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-500" />
                  ) : (
                    <div className="w-full h-full bg-[#111] flex items-center justify-center">
                      <span className="text-[#33ff00]/20 font-bold text-4xl">?</span>
                    </div>
                  )}
                  {/* Overlay Ruido */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #33ff00 2px, #33ff00 4px)' }}></div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col justify-between flex-grow bg-black/90">
                  <div>
                    <h3 className="text-xl font-bold text-[#33ff00] uppercase mb-1 truncate">{personaje.nombre}</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-2">
                      {personaje.rol || 'ROL DESCONOCIDO'}
                    </p>
                    <p className="text-xs text-gray-300 line-clamp-3 font-sans">
                      {personaje.descripcion || 'DATOS NO DISPONIBLES.'}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedPersonaje(personaje)}
                    className="mt-4 w-full border border-[#33ff00] text-[#33ff00] py-2 text-xs font-bold uppercase hover:bg-[#33ff00] hover:text-black transition-all"
                  >
                    [ VER EXPEDIENTE ]
                  </button>
                </div>
              </div>
            )
          })}
          <div className="w-4 shrink-0"></div>
        </div>
      </div>

      {/* MODAL EXPEDIENTE (Estilo Hacker) */}
      {selectedPersonaje && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedPersonaje(null)}>
          <div className="relative w-full max-w-4xl bg-black border border-[#33ff00] shadow-[0_0_50px_rgba(51,255,0,0.2)] flex flex-col md:flex-row max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

            {/* Botón Cerrar */}
            <button onClick={() => setSelectedPersonaje(null)} className="absolute top-0 right-0 z-10 bg-[#33ff00] text-black w-10 h-10 flex items-center justify-center font-bold hover:bg-white transition-colors">X</button>

            {/* Columna Izquierda: Imagen */}
            <div className="w-full md:w-1/2 h-64 md:h-auto relative border-b md:border-b-0 md:border-r border-[#33ff00]/30">
              {selectedPersonaje.imagen ? (
                <img src={selectedPersonaje.imagen} alt={selectedPersonaje.nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#050505] text-[#33ff00]/20 text-6xl">?</div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent h-20"></div>
              <h2 className="absolute bottom-4 left-4 text-3xl md:text-4xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">{selectedPersonaje.nombre}</h2>
            </div>

            {/* Columna Derecha: Datos */}
            <div className="w-full md:w-1/2 p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <div className="mb-6">
                <h4 className="text-[#33ff00] text-xs uppercase tracking-[0.2em] mb-2 border-b border-[#33ff00]/30 pb-1">CLASIFICACIÓN</h4>
                <p className="text-white font-bold text-lg uppercase">{selectedPersonaje.rol || 'NO CLASIFICADO'}</p>
              </div>

              <div className="mb-6">
                <h4 className="text-[#33ff00] text-xs uppercase tracking-[0.2em] mb-2 border-b border-[#33ff00]/30 pb-1">PERFIL PSICOLÓGICO</h4>
                <p className="text-gray-300 text-sm leading-relaxed font-sans">{selectedPersonaje.descripcion}</p>
              </div>

              {selectedPersonaje.metadata && (
                <div className="mb-8">
                  <h4 className="text-[#33ff00] text-xs uppercase tracking-[0.2em] mb-3 border-b border-[#33ff00]/30 pb-1">ATRIBUTOS TÉCNICOS</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(selectedPersonaje.metadata).map(([key, value]) => (
                      <div key={key} className="bg-[#33ff00]/5 p-2 border border-[#33ff00]/20">
                        <span className="block text-[#33ff00] text-[10px] uppercase opacity-70">{key}</span>
                        <span className="block text-white text-sm font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleMeetCharacter(selectedPersonaje)}
                className="w-full bg-[#33ff00]/10 border border-[#33ff00] text-[#33ff00] py-4 font-bold uppercase tracking-widest hover:bg-[#33ff00] hover:text-black transition-all"
              >
                [+] REGISTRAR ENCUENTRO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonajesView