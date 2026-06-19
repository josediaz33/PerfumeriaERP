import { useState, useEffect, useRef } from 'react'
import { Delete } from 'lucide-react'
import { db, getConfig } from '../../db/db'

interface Props {
  storedPin: string
  onUnlock: () => void
}

export function LockScreen({ storedPin, onUnlock }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [businessName, setBusinessName] = useState('JODA Parfums')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoRef = useRef<string | null>(null)

  useEffect(() => {
    getConfig('business_name').then(n => { if (n) setBusinessName(n) })
    db.images.get('business-logo').then(img => {
      if (img) {
        const url = URL.createObjectURL(img.blob)
        logoRef.current = url
        setLogoUrl(url)
      }
    })
    return () => { if (logoRef.current) URL.revokeObjectURL(logoRef.current) }
  }, [])

  function pressKey(digit: string) {
    if (pin.length >= storedPin.length || shake) return
    const next = pin + digit
    setPin(next)
    setError(false)

    if (next.length === storedPin.length) {
      setTimeout(() => {
        if (next === storedPin) {
          onUnlock()
        } else {
          setError(true)
          setShake(true)
          setTimeout(() => { setPin(''); setError(false); setShake(false) }, 700)
        }
      }, 80)
    }
  }

  function backspace() {
    if (shake) return
    setPin(p => p.slice(0, -1))
    setError(false)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="fixed inset-0 bg-[#1e1b2e] flex flex-col items-center justify-center select-none">
      <div className="flex flex-col items-center gap-0 mb-8">
        {logoUrl ? (
          <img src={logoUrl} alt={businessName} className="h-20 object-contain mb-4" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-[#9a7b3f]/20 border border-[#9a7b3f]/30 flex items-center justify-center mb-4">
            <span className="text-4xl">🌸</span>
          </div>
        )}
        <h1 className="text-xl font-bold text-[#c8a96e] tracking-wide">{businessName}</h1>
        <p className="text-sm text-[#9a7b3f]/70 mt-1">Ingresá tu PIN de acceso</p>
      </div>

      <div className={`flex gap-4 mb-2 transition-transform ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}`}>
        {Array.from({ length: storedPin.length }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              i < pin.length
                ? error ? 'bg-red-400 scale-110' : 'bg-[#9a7b3f] scale-110'
                : 'bg-white/15'
            }`}
          />
        ))}
      </div>

      <p className={`text-sm mb-6 h-5 transition-opacity ${error ? 'text-red-400 opacity-100' : 'opacity-0'}`}>
        PIN incorrecto
      </p>

      <div className="grid grid-cols-3 gap-2.5 w-60">
        {keys.map((k, i) => {
          if (k === '') return <div key={i} />
          if (k === 'del') return (
            <button
              key={i}
              onClick={backspace}
              className="h-14 flex items-center justify-center rounded-2xl text-[#9a7b3f] hover:bg-white/10 active:bg-white/5 transition-all cursor-pointer"
            >
              <Delete size={20} />
            </button>
          )
          return (
            <button
              key={k}
              onClick={() => pressKey(k)}
              className="h-14 flex items-center justify-center rounded-2xl text-white text-xl font-semibold bg-white/10 hover:bg-white/20 active:scale-95 active:bg-white/5 transition-all cursor-pointer border border-white/5"
            >
              {k}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: translateX(0) }
          20% { transform: translateX(-8px) }
          40% { transform: translateX(8px) }
          60% { transform: translateX(-6px) }
          80% { transform: translateX(6px) }
        }
      `}</style>
    </div>
  )
}
