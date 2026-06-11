import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { seedInitialData } from './db/db'

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

export default function App() {
  useEffect(() => { seedInitialData() }, [])

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
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
