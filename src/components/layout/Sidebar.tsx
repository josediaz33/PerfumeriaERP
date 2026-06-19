import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
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
  Users,
  TrendingUp,
  Settings,
} from 'lucide-react'
import { db } from '../../db/db'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/contabilidad', label: 'Contabilidad', icon: BookOpen },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/decants', label: 'Decants', icon: Droplets },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/logistica', label: 'Logística', icon: MapPin },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/catalogo', label: 'Catálogo', icon: BookImage },
  { to: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { to: '/utilidades', label: 'Utilidades', icon: TrendingUp },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  const logoImg = useLiveQuery(() => db.images.get('business-logo'))
  const nameConfig = useLiveQuery(() => db.config.where('key').equals('business_name').first())
  const businessName = nameConfig?.value || 'JODA Parfums'

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoRef = useRef<string | null>(null)

  useEffect(() => {
    if (logoRef.current) URL.revokeObjectURL(logoRef.current)
    if (logoImg?.blob) {
      const url = URL.createObjectURL(logoImg.blob)
      logoRef.current = url
      setLogoUrl(url)
    } else {
      logoRef.current = null
      setLogoUrl(null)
    }
    return () => { if (logoRef.current) URL.revokeObjectURL(logoRef.current) }
  }, [logoImg])

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-4 py-3 border-b border-gray-100">
        {logoUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={businessName}
              className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-black/8"
            />
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">{businessName}</p>
              <p className="text-xs text-gray-400">Sistema de gestión</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-base leading-none select-none">
                {businessName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">{businessName}</p>
              <p className="text-xs text-gray-400">Sistema de gestión</p>
            </div>
          </div>
        )}
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
        <p className="text-xs text-gray-400 text-center">v2.0 — Fase 2</p>
      </div>
    </aside>
  )
}
