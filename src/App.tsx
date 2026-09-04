import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { LockScreen } from './components/layout/LockScreen'
import { seedInitialData, seedCategories, getConfig } from './db/db'

import { Dashboard } from './pages/Dashboard'
import { Cuentas } from './pages/Cuentas'
import { Contabilidad } from './pages/Contabilidad'
import { Inventario } from './pages/Inventario'
import { Decants } from './pages/Decants'
import { Ventas } from './pages/Ventas'
import { Proveedores } from './pages/Proveedores'
import { Logistica } from './pages/Logistica'
import { Catalogo } from './pages/Catalogo'
import { Presupuestos } from './pages/Presupuestos'
import { Clientes } from './pages/Clientes'
import { Utilidades } from './pages/Utilidades'
import { Configuracion } from './pages/Configuracion'
import { Sourcing } from './pages/Sourcing'

export default function App() {
  const [pinState, setPinState] = useState<'loading' | 'locked' | 'unlocked'>('loading')
  const [storedPin, setStoredPin] = useState('')

  useEffect(() => {
    seedInitialData()
    seedCategories()  // seed categorías de género al primer arranque / upgrade a v7
    getConfig('pin_code').then(pin => {
      if (!pin) {
        setPinState('unlocked')
      } else if (sessionStorage.getItem('joda_unlocked') === '1') {
        setPinState('unlocked')
      } else {
        setStoredPin(pin)
        setPinState('locked')
      }
    })
  }, [])

  if (pinState === 'loading') return <div className="fixed inset-0 bg-[#1e1b2e]" />
  if (pinState === 'locked') return (
    <LockScreen storedPin={storedPin} onUnlock={() => {
      sessionStorage.setItem('joda_unlocked', '1')
      setPinState('unlocked')
    }} />
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/contabilidad" element={<Contabilidad />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/decants" element={<Decants />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/utilidades" element={<Utilidades />} />
          <Route path="/sourcing" element={<Sourcing />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
