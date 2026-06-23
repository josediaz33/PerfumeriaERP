import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sidebar } from './Sidebar'
import { db } from '../../db/db'

const SHADES = ['50','100','200','300','400','500','600','700','800','900','950']

function applyBrandColor(color: string) {
  let el = document.getElementById('brand-color-override') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'brand-color-override'
    document.head.appendChild(el)
  }
  el.textContent = (!color || color === 'violet')
    ? ''
    : `:root{${SHADES.map(s => `--color-violet-${s}:var(--color-${color}-${s})`).join(';')}}`
}

export function Layout() {
  const brandColor = useLiveQuery(
    () => db.config.where('key').equals('brand_color').first().then(r => r?.value ?? 'violet'),
    [], 'violet'
  )

  useEffect(() => { applyBrandColor(brandColor ?? 'violet') }, [brandColor])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
