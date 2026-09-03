/**
 * ProductAutocomplete — selector de producto con búsqueda y miniatura de imagen.
 *
 * Reemplaza los <select> nativos de productos en Ventas, Logística y Presupuestos.
 * Cada fila del dropdown muestra: miniatura de imagen · nombre · marca/tamaño · badge de stock.
 *
 * Props:
 *   label?           — etiqueta visible encima del input
 *   value            — productId como string ('0' o '' = sin selección)
 *   onChange         — callback cuando cambia la selección (recibe el nuevo productId como string)
 *   onProductSelect? — callback opcional con el objeto Product completo al seleccionar
 *   products         — array de productos a mostrar en el dropdown
 *   placeholder?     — placeholder del input (por defecto 'Buscar producto...')
 *   showStock?       — mostrar badge de stock (por defecto true)
 *   className?       — clase adicional para el contenedor externo
 */

import { useState, useEffect, useRef } from 'react'
import { X, Package } from 'lucide-react'
import { db } from '../../db/db'
import type { Product } from '../../db/types'

// ─── MiniThumb ─────────────────────────────────────────────────────────────────
// Carga la imagen del producto desde IndexedDB y la muestra como miniatura.
// Revoca el ObjectURL al desmontar o cambiar de imagen para evitar memory leaks.
// imageId: pasar p.imageIds?.[0] (el campo en Product es imageIds: string[])

interface MiniThumbProps {
  imageId?: string   // ID de imagen de db.images; undefined → placeholder
  size?: number
}

function MiniThumb({ imageId, size = 32 }: MiniThumbProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!imageId) { setUrl(null); return }
    let objectUrl: string | null = null
    db.images.get(imageId).then(img => {
      if (!img) return
      objectUrl = URL.createObjectURL(img.blob)
      setUrl(objectUrl)
    }).catch(() => setUrl(null))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageId])

  const px = `${size}px`

  if (!url) {
    return (
      <div
        className="shrink-0 rounded bg-gray-100 flex items-center justify-center text-gray-300"
        style={{ width: px, height: px }}
      >
        <Package size={size * 0.5} />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      className="shrink-0 rounded object-cover bg-white"
      style={{ width: px, height: px }}
    />
  )
}

// ─── ProductAutocomplete ────────────────────────────────────────────────────────

interface ProductAutocompleteProps {
  label?: string
  value: string                            // productId como string; '0' o '' = sin selección
  onChange: (id: string) => void           // nuevo productId como string
  onProductSelect?: (p: Product) => void   // producto seleccionado (opcional, para autoFill)
  products: Product[]
  placeholder?: string
  showStock?: boolean
  className?: string
}

const MAX_DROPDOWN = 60

export function ProductAutocomplete({
  label,
  value,
  onChange,
  onProductSelect,
  products,
  placeholder = 'Buscar por nombre o marca...',
  showStock = true,
  className = '',
}: ProductAutocompleteProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedProduct = (value && value !== '0')
    ? products.find(p => String(p.id) === value) ?? null
    : null

  // Cuando se selecciona un producto externamente (p.ej. cambio de tab que resetea a '0'),
  // limpiamos también el texto de búsqueda.
  useEffect(() => {
    if (!value || value === '0') setSearch('')
  }, [value])

  const filtered = products.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
  }).slice(0, MAX_DROPDOWN)

  const displayedInDropdown = search ? filtered : products.slice(0, MAX_DROPDOWN)

  function handleSelect(p: Product) {
    onChange(String(p.id))
    onProductSelect?.(p)
    setSearch('')
    setOpen(false)
  }

  function handleClear() {
    onChange('0')
    setSearch('')
    inputRef.current?.focus()
  }

  const inputValue = selectedProduct
    ? `${selectedProduct.brand} — ${selectedProduct.name}`
    : search

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={inputValue}
          onChange={e => {
            setSearch(e.target.value)
            onChange('0')
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
        />
        {selectedProduct && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); handleClear() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && displayedInDropdown.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto max-h-64">
          {displayedInDropdown.map(p => {
            const isWatch = p.category === 'watch'
            const sizeInfo = isWatch ? 'Reloj' : p.sizeML ? `${p.sizeML}ml` : ''
            const stockLabel = p.type === 'decant_source'
              ? `${p.stockOpenML}ml`
              : `${p.stockSealed} u.`
            const hasStock = p.stockSealed > 0 || p.stockOpenML > 0
            const isSelected = String(p.id) === value

            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => handleSelect(p)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-violet-50 text-left text-sm border-b border-gray-50 last:border-0 transition-colors ${isSelected ? 'bg-violet-50' : ''}`}
              >
                {/* Miniatura — usa la primera imagen del producto */}
                <MiniThumb imageId={p.imageIds?.[0]} size={32} />

                {/* Nombre + subtítulo */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{p.name}</span>
                  <span className="text-xs text-gray-400">
                    {p.brand}{sizeInfo ? ` · ${sizeInfo}` : ''}
                  </span>
                </div>

                {/* Badge de stock */}
                {showStock && (
                  <span className={`text-xs shrink-0 px-1.5 py-0.5 rounded-full font-medium ${
                    hasStock ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {stockLabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {open && search.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-400">
          Sin resultados para &quot;{search}&quot;
        </div>
      )}
    </div>
  )
}
