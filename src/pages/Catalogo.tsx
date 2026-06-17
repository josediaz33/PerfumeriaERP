import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Download, BookImage } from 'lucide-react'
import { db } from '../db/db'
import type { OlfactiveFamily } from '../db/types'
import { fmtPYG } from '../lib/format'
import { blobToBase64 } from '../lib/images'
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

function CatalogThumb({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let objectUrl: string | null = null
    db.images.get(imageId).then(img => {
      if (img) { objectUrl = URL.createObjectURL(img.blob); setUrl(objectUrl) }
    })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [imageId])
  if (!url) return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-5xl select-none">🌸</span>
    </div>
  )
  return <img src={url} alt="" className="w-full h-full object-cover" />
}

export function Catalogo() {
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const decantBatches = useLiveQuery(() => db.decantBatches.toArray()) ?? []
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'sealed' | 'decant'>('all')
  const [filterFamily, setFilterFamily] = useState<string>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const available = products.filter(p => {
    // Respetar flag explícito (undefined = visible por defecto)
    if (p.catalogVisible === false) return false
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

    // Logo
    const logoImg = await db.images.get('business-logo')
    const logoB64 = logoImg ? await blobToBase64(logoImg.blob) : null
    const logoFmt = logoImg?.mime === 'image/png' ? 'PNG' : 'JPEG'

    // Nombre del negocio desde config
    const configName = await db.config.where('key').equals('business_name').first()
    const businessName = configName?.value || 'JODA Parfums'
    const configPhone = await db.config.where('key').equals('business_phone').first()

    // Header oscuro/dorado igual que presupuestos
    doc.setFillColor(20, 18, 18)
    doc.rect(0, 0, 210, 38, 'F')
    if (logoB64) {
      doc.addImage(logoB64, logoFmt, 10, 4, 30, 30)
      doc.setTextColor(200, 169, 110)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 130, 80)
      doc.text('Catálogo de Fragancias', 44, 22)
      if (configPhone?.value) doc.text(configPhone.value, 44, 30)
    } else {
      doc.setTextColor(200, 169, 110)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text(businessName, 14, 18)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 130, 80)
      doc.text('Catálogo de Fragancias', 14, 26)
      if (configPhone?.value) doc.text(configPhone.value, 14, 33)
    }
    // Fecha top-right
    doc.setTextColor(160, 130, 80)
    doc.setFontSize(8)
    doc.text(new Date().toLocaleDateString('es-PY'), 196, 33, { align: 'right' })

    // Tabla de productos
    let y = 50
    doc.setFillColor(20, 18, 18)
    doc.rect(14, y, 182, 8, 'F')
    doc.setTextColor(200, 169, 110)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Perfume', 16, y + 5.5)
    doc.text('Marca', 80, y + 5.5)
    doc.text('Tipo', 128, y + 5.5)
    doc.text('Precio', 162, y + 5.5)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 27, 46)

    filtered.forEach((p, i) => {
      if (y > 265) { doc.addPage(); y = 20 }
      if (i % 2 === 1) {
        doc.setFillColor(248, 246, 240)
        doc.rect(14, y - 2, 182, 9, 'F')
      }
      const batches = decantBatches.filter(b => b.productId === p.id)
      const sizes = [...new Set(batches.map(b => b.sizeML))].sort((a, b) => a - b)
      doc.text(p.name.slice(0, 34), 16, y + 4)
      doc.text(p.brand.slice(0, 20), 80, y + 4)
      doc.text(p.type === 'sealed' ? 'Sellado' : 'Decants', 128, y + 4)
      if (p.type === 'sealed') {
        doc.text(p.sellingPricePYG > 0 ? `Gs. ${p.sellingPricePYG.toLocaleString('es-PY')}` : '—', 155, y + 4)
      } else if (sizes.length > 0) {
        const first = batches.find(b => b.sizeML === sizes[0])
        doc.text(first?.sellingPricePYG ? `${sizes[0]}ml: Gs. ${first.sellingPricePYG.toLocaleString('es-PY')}` : '—', 155, y + 4)
      } else {
        doc.text('Consultar', 155, y + 4)
      }
      y += 9
    })

    // Línea dorada y footer
    doc.setDrawColor(154, 123, 63)
    doc.setLineWidth(0.5)
    doc.line(14, y + 4, 196, y + 4)
    doc.setFontSize(7.5)
    doc.setTextColor(154, 123, 63)
    doc.text(`${filtered.length} producto${filtered.length !== 1 ? 's' : ''} · Generado ${new Date().toLocaleDateString('es-PY')}`, 105, y + 10, { align: 'center' })

    const url = doc.output('bloburi')
    window.open(url, '_blank')
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
              onClick={() => setFilterType(opt.value as 'all' | 'sealed' | 'decant')}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(p => {
          const batches = decantBatches.filter(b => b.productId === p.id)
          const availableSizes = [...new Set(batches.map(b => b.sizeML))].sort((a, b) => a - b)
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gradient-to-br from-amber-50 to-stone-100 overflow-hidden">
                {p.imageIds?.[0] ? (
                  <CatalogThumb imageId={p.imageIds[0]} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl select-none">🌸</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <Badge color={p.type === 'sealed' ? 'blue' : 'violet'}>
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
