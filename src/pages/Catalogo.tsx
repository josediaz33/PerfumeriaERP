import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Download, BookImage } from 'lucide-react'
import { db } from '../db/db'
import type { OlfactiveFamily } from '../db/types'
import { fmtPYG } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

const families: { value: OlfactiveFamily; label: string }[] = [
  { value: 'floral', label: 'Floral' }, { value: 'woody', label: 'Amaderado' },
  { value: 'oriental', label: 'Oriental' }, { value: 'fresh', label: 'Fresco' },
  { value: 'citrus', label: 'Cítrico' }, { value: 'aromatic', label: 'Aromático' },
  { value: 'gourmand', label: 'Gourmand' }, { value: 'chypre', label: 'Chypre' },
  { value: 'fougere', label: 'Fougère' }, { value: 'other', label: 'Otro' },
]

export function Catalogo() {
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const decantBatches = useLiveQuery(() => db.decantBatches.toArray()) ?? []
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'sealed' | 'decant'>('all')
  const [filterFamily, setFilterFamily] = useState<string>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const catalogRef = useRef<HTMLDivElement>(null)

  const available = products.filter(p => {
    if (p.type === 'sealed' && p.stockSealed <= 0) return false
    if (p.type === 'decant_source' && p.stockOpenML <= 0) return false
    return true
  })

  const filtered = available.filter(p => {
    if (filterType === 'sealed' && p.type !== 'sealed') return false
    if (filterType === 'decant' && p.type !== 'decant_source') return false
    if (filterFamily !== 'all' && p.olfactiveFamily !== filterFamily) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.brand.toLowerCase().includes(search.toLowerCase())) return false
    if (minPrice && p.sellingPricePYG < parseInt(minPrice)) return false
    if (maxPrice && p.sellingPricePYG > parseInt(maxPrice)) return false
    return true
  })

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    let y = 20
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('JODA Parfums', 105, y, { align: 'center' })
    y += 8
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Catálogo de Productos Disponibles', 105, y, { align: 'center' })
    y += 15

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(120, 60, 220)
    doc.rect(14, y, 182, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text('Perfume', 16, y + 5)
    doc.text('Marca', 70, y + 5)
    doc.text('Tipo', 110, y + 5)
    doc.text('Precio', 150, y + 5)
    doc.text('Stock', 175, y + 5)
    y += 10

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 27, 46)

    filtered.forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      if (i % 2 === 0) {
        doc.setFillColor(248, 247, 255)
        doc.rect(14, y - 1, 182, 7, 'F')
      }
      doc.text(p.name.slice(0, 28), 16, y + 4)
      doc.text(p.brand.slice(0, 18), 70, y + 4)
      doc.text(p.type === 'sealed' ? 'Sellado' : 'Decant', 110, y + 4)
      doc.text(p.sellingPricePYG > 0 ? `Gs. ${p.sellingPricePYG.toLocaleString('es-PY')}` : '—', 140, y + 4)
      doc.text(p.type === 'sealed' ? `${p.stockSealed} u.` : `${p.stockOpenML} ml`, 175, y + 4)
      y += 8
    })

    y += 5
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PY')} · ${filtered.length} productos`, 105, y, { align: 'center' })

    doc.save(`catalogo-joda-parfums-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Catálogo"
        subtitle="Productos disponibles para compartir con clientes"
        action={
          <Button icon={<Download size={15} />} onClick={exportPDF}>
            Exportar PDF
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Buscar perfume o marca..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[{ value: 'all', label: 'Todos' }, { value: 'sealed', label: 'Sellados' }, { value: 'decant', label: 'Decants' }].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value as any)}
              className={`px-3 py-1 rounded-md text-sm cursor-pointer transition-colors ${filterType === opt.value ? 'bg-white text-violet-700 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          value={filterFamily}
          onChange={e => setFilterFamily(e.target.value)}
        >
          <option value="all">Todas las familias</option>
          {families.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input
          type="number"
          placeholder="Precio mín."
          className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          value={minPrice}
          onChange={e => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          placeholder="Precio máx."
          className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
        />
      </div>

      <p className="text-sm text-gray-500 mb-4">{filtered.length} producto{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}</p>

      {/* Grid de productos */}
      <div ref={catalogRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(p => {
          const batches = decantBatches.filter(b => b.productId === p.id)
          const availableSizes = [...new Set(batches.map(b => b.sizeML))].sort((a, b) => a - b)
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">🌸</span>
                )}
              </div>
              <div className="p-3">
                <Badge color={p.type === 'sealed' ? 'blue' : 'violet'} >
                  {p.type === 'sealed' ? 'Sellado' : 'Decants'}
                </Badge>
                <p className="font-semibold text-gray-900 mt-2 text-sm leading-tight">{p.name}</p>
                <p className="text-xs text-gray-500">{p.brand}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.concentration} · {p.sizeML}ml</p>
                {p.type === 'sealed' ? (
                  <p className="text-sm font-bold text-violet-600 mt-2">{fmtPYG(p.sellingPricePYG)}</p>
                ) : (
                  <div className="mt-2">
                    {availableSizes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {availableSizes.map(s => {
                          const b = batches.find(x => x.sizeML === s)
                          return b?.sellingPricePYG ? (
                            <div key={s} className="text-xs bg-violet-50 text-violet-700 rounded px-1.5 py-0.5">
                              {s}ml · {fmtPYG(b.sellingPricePYG)}
                            </div>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Ver disponibilidad</p>
                    )}
                  </div>
                )}
                {p.type === 'sealed' && (
                  <p className="text-xs text-gray-400 mt-1">Stock: {p.stockSealed} u.</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <BookImage size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No hay productos disponibles</p>
          <p className="text-sm text-gray-400">Agrega stock en el módulo de Inventario</p>
        </div>
      )}
    </div>
  )
}
