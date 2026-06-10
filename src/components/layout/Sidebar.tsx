import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  Package,
  Droplets,
  ShoppingCart,
  Truck,
  MapPin,
  BookImage,
  FileText,
  TrendingUp,
  Settings,
} from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/contabilidad', label: 'Contabilidad', icon: BookOpen },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/decants', label: 'Decants', icon: Droplets },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/logistica', label: 'Logística', icon: MapPin },
  { to: '/catalogo', label: 'Catálogo', icon: BookImage },
  { to: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { to: '/utilidades', label: 'Utilidades', icon: TrendingUp },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌸</span>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">JODA Parfums</p>
            <p className="text-xs text-gray-500">Sistema de gestión</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">v1.0 — Fase 1 MVP</p>
      </div>
    </aside>
  )
}
