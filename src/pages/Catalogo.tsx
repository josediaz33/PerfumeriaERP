import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Download, FileCode, X, Globe, Copy, Check, SlidersHorizontal, Eye, EyeOff } from 'lucide-react'
import { db, getConfig } from '../db/db'
import type { Product, OlfactiveFamily } from '../db/types'
import { fmtPYG } from '../lib/format'
import { blobToBase64 } from '../lib/images'
import { Button } from '../components/ui/Button'

const families: { value: OlfactiveFamily; label: string }[] = [
  { value: 'floral', label: 'Floral' }, { value: 'woody', label: 'Amaderado' },
  { value: 'oriental', label: 'Oriental' }, { value: 'fresh', label: 'Fresco' },
  { value: 'citrus', label: 'Cítrico' }, { value: 'aromatic', label: 'Aromático' },
  { value: 'gourmand', label: 'Gourmand' }, { value: 'chypre', label: 'Chypre' },
  { value: 'fougere', label: 'Fougère' }, { value: 'other', label: 'Otro' },
]

const familyLabel = (f: OlfactiveFamily) => families.find(x => x.value === f)?.label ?? f

function ImagePlaceholder({ size = 56 }: { size?: number }) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Frasco de perfume minimalista */}
      <rect x="18" y="26" width="20" height="22" rx="5" fill="#e2dbd2" />
      <rect x="22" y="17" width="12" height="10" rx="3" fill="#e2dbd2" />
      <rect x="25" y="11" width="6" height="7" rx="2" fill="#d4cabf" />
      <rect x="26.5" y="7" width="3" height="5" rx="1.5" fill="#c4b8aa" />
      {/* Reflejo sutil */}
      <rect x="22" y="30" width="3" height="12" rx="1.5" fill="#ede8e1" />
    </svg>
  )
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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
      <ImagePlaceholder size={48} />
    </div>
  )
  return <img src={url} alt="" className="w-full h-full object-cover" />
}

// ── CATX-06: ficha individual ──────────────────────────────────────────────────
function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    if (product.imageIds?.[0]) {
      db.images.get(product.imageIds[0]).then(img => {
        if (img) { url = URL.createObjectURL(img.blob); setImgUrl(url) }
      })
    }
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [product])

  const sizes = [
    { sizeML: 3, sellingPricePYG: product.price3ML ?? 0 },
    { sizeML: 5, sellingPricePYG: product.price5ML ?? 0 },
    { sizeML: 10, sellingPricePYG: product.price10ML ?? 0 },
    { sizeML: 30, sellingPricePYG: product.price30ML ?? 0 },
  ].filter(s => s.sellingPricePYG > 0)

  const typeLabel = product.type === 'sealed' ? 'Sellado' : product.type === 'tester' ? 'Tester' : 'Decants'
  const typeColor = product.type === 'sealed'
    ? 'bg-sky-50 text-sky-700'
    : product.type === 'tester'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-violet-50 text-violet-700'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Imagen */}
        <div className="relative aspect-[4/3] bg-gradient-to-b from-stone-50 to-stone-100 overflow-hidden">
          {imgUrl ? (
            <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImagePlaceholder size={80} />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full shadow-sm flex items-center justify-center hover:bg-white transition-colors"
          >
            <X size={15} className="text-gray-600" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 pb-6">
          {/* Tags */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
            {product.olfactiveFamily && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {familyLabel(product.olfactiveFamily)}
              </span>
            )}
          </div>

          {/* Nombre y marca */}
          <h2 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">{product.name}</h2>
          <p className="text-sm text-gray-400 font-medium mt-0.5 uppercase tracking-wide">{product.brand}</p>
          <p className="text-xs text-gray-300 mt-1">{product.concentration} · {product.sizeML}ml</p>

          {/* Notas */}
          {product.notes && (
            <p className="text-sm text-gray-500 mt-3 leading-relaxed border-l-2 border-stone-200 pl-3">
              {product.notes}
            </p>
          )}

          {/* Precio */}
          <div className="mt-4">
            {product.type === 'sealed' || product.type === 'tester' ? (
              product.sellingPricePYG > 0 ? (
                <p className="text-2xl font-bold text-gray-900 tracking-tight">{fmtPYG(product.sellingPricePYG)}</p>
              ) : (
                <p className="text-sm text-gray-300 italic">Precio a consultar</p>
              )
            ) : sizes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sizes.map(b => (
                  <div key={b.sizeML} className="bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2 text-center">
                    <p className="text-xs text-gray-400 font-medium">{b.sizeML}ml</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtPYG(b.sellingPricePYG)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-300 italic">Ver disponibilidad</p>
            )}
          </div>

          {/* Stock */}
          {(product.type === 'sealed' || product.type === 'tester') && (
            <p className="text-xs text-gray-300 mt-3">
              {product.stockSealed} unidad{product.stockSealed !== 1 ? 'es' : ''} en stock
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function Catalogo() {
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const decantBatches = useLiveQuery(() => db.decantBatches.toArray()) ?? []
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'sealed' | 'decant'>('all')
  const [filterFamily, setFilterFamily] = useState<string>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState('')
  const [publishError, setPublishError] = useState('')
  const [urlCopied, setUrlCopied] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Para el export (HTML/PDF): respeta catalogVisible=true como "forzar visible sin stock"
  const catalogAvailable = products.filter(p => {
    if (p.catalogVisible === false) return false
    if (p.catalogVisible === true) return true  // forzado visible aunque sin stock
    if (p.type === 'sealed' && p.stockSealed <= 0) return false
    if (p.type === 'decant_source' && p.stockOpenML <= 0) return false
    return true
  })

  // Para la vista interna de gestión: muestra TODOS los no-explícitamente-ocultos
  // (incluyendo sin stock) para poder togglear la visibilidad de cualquiera
  const available = products.filter(p => p.catalogVisible !== false)

  const filtered = available.filter(p => {
    if (filterType === 'sealed' && p.type !== 'sealed') return false
    if (filterType === 'decant' && p.type !== 'decant_source') return false
    if (filterFamily !== 'all' && p.olfactiveFamily !== filterFamily) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.brand.toLowerCase().includes(search.toLowerCase())) return false
    if (minPrice && p.sellingPricePYG < parseInt(minPrice)) return false
    if (maxPrice && p.sellingPricePYG > parseInt(maxPrice)) return false
    return true
  })

  // Toggle visibilidad en catálogo:
  // - Sin stock, no forzado (undefined) → true (forzar visible)
  // - Sin stock, forzado (true)         → undefined (vuelve a oculto por stock)
  // - Con stock, visible (undefined)    → false (ocultar explícitamente)
  // - Con stock, oculto (false)         → undefined (restaurar)
  // - Forzado (true) y con stock        → undefined (quitar forzado, pero sigue visible por stock)
  async function toggleCatalogVisible(p: Product) {
    const hasStock = (p.type === 'sealed' && p.stockSealed > 0)
      || (p.type === 'decant_source' && p.stockOpenML > 0)
      || (p.type === 'tester' && (p.stockSealed ?? 0) > 0)

    let next: boolean | undefined
    if (p.catalogVisible === false) {
      next = undefined  // restaurar a por-stock
    } else if (p.catalogVisible === true) {
      next = undefined  // quitar forzado
    } else {
      // undefined: decide por stock
      next = hasStock ? false : true
    }
    await db.products.update(p.id!, { catalogVisible: next })
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const logoImg = await db.images.get('business-logo')
    const logoB64 = logoImg ? await blobToBase64(logoImg.blob) : null
    const logoFmt = logoImg?.mime === 'image/png' ? 'PNG' : 'JPEG'
    const configName = await db.config.where('key').equals('business_name').first()
    const businessName = configName?.value || 'JODA Parfums'
    const configPhone = await db.config.where('key').equals('business_phone').first()

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
    doc.setTextColor(160, 130, 80)
    doc.setFontSize(8)
    doc.text(new Date().toLocaleDateString('es-PY'), 196, 33, { align: 'right' })

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

    doc.setDrawColor(154, 123, 63)
    doc.setLineWidth(0.5)
    doc.line(14, y + 4, 196, y + 4)
    doc.setFontSize(7.5)
    doc.setTextColor(154, 123, 63)
    doc.text(`${filtered.length} producto${filtered.length !== 1 ? 's' : ''} · Generado ${new Date().toLocaleDateString('es-PY')}`, 105, y + 10, { align: 'center' })

    const url = doc.output('bloburi')
    window.open(url, '_blank')
  }

  // ── CATX-07/08/09: Mini portal de pedidos — HTML autocontenido, interactivo, compatible iOS ──
  async function buildCatalogHTML(): Promise<{ html: string; filename: string }> {
    const configName = await db.config.where('key').equals('business_name').first()
    const businessName = configName?.value || 'JODA Parfums'
    const configPhone = await db.config.where('key').equals('business_phone').first()
    const businessPhone = configPhone?.value || ''
    // Formatear número para WhatsApp (Paraguay: 0981... → 595981...)
    const waPhone = businessPhone
      ? businessPhone.replace(/\D/g, '').replace(/^0/, '595')
      : '595984272863'

    const logoImg = await db.images.get('business-logo')
    const logoSrc = logoImg ? await blobToBase64(logoImg.blob) : null

    // El export usa catalogAvailable (no los filtros de la vista interna)
    const exportProducts = catalogAvailable
    const n = exportProducts.length
    const date = new Date().toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' })

    const logoHtml = logoSrc
      ? '<img src="' + logoSrc + '" alt="' + escHtml(businessName) + '" />'
      : '<span class="li">' + escHtml(businessName.charAt(0).toUpperCase()) + '</span>'

    // Objeto de datos de producto para el JS del portal
    const pdData: Record<number, { name: string; brand: string; type: string; price: number }> = {}
    exportProducts.forEach(p => {
      pdData[p.id!] = {
        name: p.name,
        brand: p.brand,
        type: p.type,
        price: (p.type === 'sealed' || p.type === 'tester') ? p.sellingPricePYG : 0,
      }
    })

    // Generar tarjeta + modal por producto
    const productItems = await Promise.all(exportProducts.map(async p => {
      let imgTag = '<div class="ph"><svg width="54" height="54" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="26" width="20" height="22" rx="5" fill="#e2dbd2"/><rect x="22" y="17" width="12" height="10" rx="3" fill="#e2dbd2"/><rect x="25" y="11" width="6" height="7" rx="2" fill="#d4cabf"/><rect x="26.5" y="7" width="3" height="5" rx="1.5" fill="#c4b8aa"/><rect x="22" y="30" width="3" height="12" rx="1.5" fill="#ede8e1"/></svg></div>'
      if (p.imageIds?.[0]) {
        const img = await db.images.get(p.imageIds[0])
        if (img) {
          const dataUri = await blobToBase64(img.blob)
          imgTag = '<img src="' + dataUri + '" alt="' + escHtml(p.name) + '" loading="lazy" />'
        }
      }

      const szs = [
        { sizeML: 3, sellingPricePYG: p.price3ML ?? 0 },
        { sizeML: 5, sellingPricePYG: p.price5ML ?? 0 },
        { sizeML: 10, sellingPricePYG: p.price10ML ?? 0 },
        { sizeML: 30, sellingPricePYG: p.price30ML ?? 0 },
      ].filter(s => s.sellingPricePYG > 0)

      const isDecant = p.type === 'decant_source'
      const bc = p.type === 'sealed' ? 'bs' : p.type === 'tester' ? 'bt' : 'bd'
      const bl = p.type === 'sealed' ? 'Sellado' : p.type === 'tester' ? 'Tester' : 'Decants'
      const famBadge = p.olfactiveFamily
        ? '<span class="badge bf">' + escHtml(familyLabel(p.olfactiveFamily)) + '</span>'
        : ''

      // Bloque de precio en la tarjeta
      const minSzPrice = szs.length > 0 ? Math.min(...szs.map(s => s.sellingPricePYG)) : 0
      const cardPrice = isDecant
        ? (szs.length > 0
          ? '<p class="cprice">desde Gs. ' + minSzPrice.toLocaleString('es-PY') + '</p>'
          : '<p class="consult">Consultar disponibilidad</p>')
        : (p.sellingPricePYG > 0
          ? '<p class="cprice">Gs. ' + p.sellingPricePYG.toLocaleString('es-PY') + '</p>'
          : '<p class="consult">Consultar precio</p>')

      // Tarjeta: link nativo → activa :target del modal
      const card =
        '<a href="#p-' + p.id + '" class="card" data-name="' + escHtml(p.name) + '" data-brand="' + escHtml(p.brand) + '">' +
        '<div class="ci">' + imgTag + '<span class="badge ' + bc + ' cbadge">' + bl + '</span></div>' +
        '<div class="cb">' +
        '<div class="cbr">' + escHtml(p.brand) + '</div>' +
        '<div class="ct">' + escHtml(p.name) + '</div>' +
        '<div class="cm">' + escHtml(p.concentration) + ' &middot; ' + p.sizeML + 'ml</div>' +
        cardPrice +
        '</div></a>'

      // Selector de tamaños para decants
      const sizeSelector = isDecant && szs.length > 0
        ? '<p class="sz-lbl">Elegí el tamaño</p>' +
          '<div class="sz-sel" id="sz-' + p.id + '">' +
          szs.map(b =>
            '<button class="sz-btn" onclick="setSz(' + p.id + ',' + b.sizeML + ',' + b.sellingPricePYG + ',this)">' +
            '<span class="sz-ml">' + b.sizeML + 'ml</span>' +
            '<span class="sz-pr">Gs. ' + b.sellingPricePYG.toLocaleString('es-PY') + '</span>' +
            '</button>'
          ).join('') +
          '</div>'
        : ''

      // Precio en modal (sealed/tester)
      const modalPrice = !isDecant
        ? (p.sellingPricePYG > 0
          ? '<div class="mpr">Gs. ' + p.sellingPricePYG.toLocaleString('es-PY') + '</div>'
          : '<p class="consult">Precio a consultar</p>')
        : ''

      // Botón agregar: clase .unready para decants hasta que se elige tamaño (evita atributo disabled, problemático en iOS WKWebView)
      const addClass = isDecant ? 'add-btn unready' : 'add-btn'

      // Modal con :target CSS + controles de pedido
      const modal =
        '<div id="p-' + p.id + '" class="mow">' +
        '<a href="#top" class="mow-bg"></a>' +
        '<div class="mo">' +
        '<a href="#top" class="xcl">&#x2715;</a>' +
        '<div class="mi">' + imgTag + '</div>' +
        '<div class="mb">' +
        '<div class="mbg"><span class="badge ' + bc + '">' + bl + '</span>' + famBadge + '</div>' +
        '<div class="mtit">' + escHtml(p.name) + '</div>' +
        '<div class="mbrnd">' + escHtml(p.brand) + '</div>' +
        '<div class="mmet">' + escHtml(p.concentration) + ' &middot; ' + p.sizeML + 'ml</div>' +
        (p.notes ? '<div class="mnts">' + escHtml(p.notes) + '</div>' : '') +
        modalPrice +
        sizeSelector +
        '<div class="act-row">' +
        '<div class="qty-ctl">' +
        '<button class="qty-btn" onclick="adjQty(' + p.id + ',-1)">&#8722;</button>' +
        '<span class="qty-val" id="qty-' + p.id + '">1</span>' +
        '<button class="qty-btn" onclick="adjQty(' + p.id + ',1)">+</button>' +
        '</div>' +
        '<button class="' + addClass + '" id="add-' + p.id + '" onclick="addCart(' + p.id + ')">' +
        'Agregar al pedido' +
        '</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>'

      return { card, modal }
    }))

    const productCards = productItems.map(x => x.card)
    const productModals = productItems.map(x => x.modal)

    // Modal del carrito (también :target)
    const cartModal =
      '<div id="cart" class="mow">' +
      '<a href="#top" class="mow-bg"></a>' +
      '<div class="mo cart-mo">' +
      '<a href="#top" class="xcl">&#x2715;</a>' +
      '<div class="mb">' +
      '<div class="cart-hdr">Tu pedido</div>' +
      '<div id="cart-items"><p class="empty-cart">Tu pedido est&aacute; vac&iacute;o.</p></div>' +
      '<div class="cart-footer">' +
      '<div class="cart-ttl-row"><span>Total estimado</span><span id="cart-ttl">Gs. 0</span></div>' +
      '<button class="wa-btn" onclick="sendWA()">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.552 4.101 1.515 5.828L.057 23.75l6.101-1.6A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 01-5.042-1.38l-.361-.214-3.741.981 1-3.639-.235-.374A9.9 9.9 0 0112 2.1c5.413 0 9.9 4.387 9.9 9.9 0 5.514-4.387 9.9-9.9 9.9z"/></svg>' +
      'Enviar pedido por WhatsApp' +
      '</button>' +
      '<p class="cart-note">Los precios son orientativos y est&aacute;n sujetos a disponibilidad de stock. Te contactaremos para confirmar.</p>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'

    const css = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;background:#f4f2ee;color:#111;min-height:100vh;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.wv-banner{display:none;background:#111;color:#fff;padding:12px 16px;text-align:center}
.wv-banner strong{display:block;font-size:13px;font-weight:600;margin-bottom:2px}
.wv-banner span{display:block;font-size:11px;opacity:.6}
header{background:#fff;border-bottom:1px solid #e9e7e4;padding:0 28px;height:60px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:40}
.lb{width:34px;height:34px;border-radius:6px;overflow:hidden;background:#f5efe0;border:1px solid #e8dcc8;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lb img{width:100%;height:100%;object-fit:cover}
.li{font-size:15px;font-weight:800;color:#8b6a3e}
.ht{flex:1;min-width:0}
.hn{color:#111;font-size:15px;font-weight:700;letter-spacing:-.3px;line-height:1}
.hs{color:#bbb;font-size:9px;margin-top:2px;letter-spacing:.8px;text-transform:uppercase}
.hd{color:#ccc;font-size:11px;white-space:nowrap}
main{max-width:1440px;margin:0 auto;padding:28px 20px calc(100px + env(safe-area-inset-bottom,0px))}
.bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:12px;flex-wrap:wrap}
.cnt{font-size:10px;color:#bbb;letter-spacing:.6px;text-transform:uppercase;font-weight:500}
.sw{position:relative}
.sw input{padding:10px 14px 10px 38px;border:1.5px solid #e8e5e0;border-radius:8px;font-size:13px;outline:none;width:220px;background:#fff;color:#111;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
.sw input:focus{border-color:#555;box-shadow:0 0 0 3px rgba(0,0,0,.05)}
.sw input::placeholder{color:#ccc}
.sw svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#ccc;pointer-events:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
a.card{text-decoration:none;color:inherit;display:flex;flex-direction:column;background:#fff;border-radius:14px;overflow:hidden;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .22s ease,box-shadow .22s ease;box-shadow:0 1px 4px rgba(0,0,0,.06),0 2px 12px rgba(0,0,0,.05)}
a.card:hover{transform:translateY(-4px);box-shadow:0 8px 28px rgba(0,0,0,.12)}
a.card:hover .ci img{transform:scale(1.05)}
.ci{aspect-ratio:3/4;background:#f2f0ec;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;position:relative}
.ci img{width:100%;height:100%;object-fit:cover;transition:transform .45s ease;display:block}
.ph{display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:linear-gradient(160deg,#f2f0ec,#e8e4dc)}
.badge{font-size:8px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:4px 8px;border-radius:3px;line-height:1}
.cbadge{position:absolute;top:10px;left:10px;color:#fff;background:rgba(0,0,0,.52);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.bs,.bt,.bd{background:rgba(0,0,0,.52);color:#fff}
.bf{display:none}
.cb{padding:13px 14px 16px}
.cbr{font-size:9px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:1.3px;margin-bottom:5px}
.ct{font-size:14px;font-weight:500;color:#111;line-height:1.4}
.cm{font-size:11px;color:#ccc;margin-top:3px}
.cprice{font-size:14px;font-weight:600;color:#111;margin-top:9px}
.consult{font-size:11px;color:#ccc;margin-top:9px;font-style:italic}
.chips{display:none}
.chip{display:none}
.mow{display:none;position:fixed;inset:0;z-index:100;align-items:flex-end;justify-content:center;padding:0}
.mow:target{display:flex}
.mow-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.mo{position:relative;z-index:1;background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 -4px 32px rgba(0,0,0,.16);animation:slideup .3s cubic-bezier(.32,.72,0,1)}
@media(min-width:600px){.mow{align-items:center;padding:20px}.mo{border-radius:18px;max-height:88vh}}
@keyframes slideup{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
.mi{aspect-ratio:1;background:#f5f4f1;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:18px 18px 0 0}
@media(min-width:600px){.mi{border-radius:18px 18px 0 0}}
.mi img{width:100%;height:100%;object-fit:cover}
.mb{padding:22px 22px calc(28px + env(safe-area-inset-bottom,0px))}
.mbg{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.mbg .badge{background:#f0efed;color:#888;font-size:9px;padding:4px 9px;border-radius:4px}
.mbg .bf{display:inline-block;background:#f0efed;color:#888}
.mtit{font-size:22px;font-weight:700;color:#111;line-height:1.25;letter-spacing:-.4px}
.mbrnd{font-size:10px;color:#aaa;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px}
.mmet{font-size:11px;color:#ccc;margin-top:3px}
.mnts{font-size:13px;color:#555;border-left:2px solid #e4ddd0;padding:10px 14px;margin-top:16px;line-height:1.7;background:#faf8f5;border-radius:0 6px 6px 0}
.mpr{font-size:30px;font-weight:700;color:#111;margin-top:18px;letter-spacing:-.5px}
a.xcl{position:absolute;top:12px;right:12px;width:32px;height:32px;background:rgba(255,255,255,.88);border-radius:50%;font-size:14px;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#555;box-shadow:0 1px 8px rgba(0,0,0,.14);z-index:2;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer;line-height:1}
.sz-lbl{font-size:10px;font-weight:600;color:#aaa;margin-top:20px;margin-bottom:10px;text-transform:uppercase;letter-spacing:.9px}
.sz-sel{display:flex;flex-wrap:wrap;gap:8px}
.sz-btn{background:#fff;border:1px solid #e4e2de;border-radius:5px;padding:11px 14px;cursor:pointer;text-align:center;transition:border-color .15s,background .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-width:76px;outline:none}
.sz-btn:hover{border-color:#666}
.sz-btn.active{border-color:#111;background:#111;color:#fff}
.sz-ml{display:block;font-size:15px;font-weight:700;line-height:1.2}
.sz-pr{display:block;font-size:10px;margin-top:3px;opacity:.6}
.sz-btn.active .sz-pr{opacity:.75}
.act-row{display:flex;gap:10px;align-items:center;margin-top:18px}
.qty-ctl{display:flex;align-items:center;background:#f5f4f1;border-radius:5px;overflow:hidden;border:1px solid #e4e2de;flex-shrink:0}
.qty-btn{width:40px;height:46px;border:none;background:transparent;font-size:20px;cursor:pointer;color:#333;font-weight:400;touch-action:manipulation;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;line-height:1}
.qty-btn:active{background:#eae8e4}
.qty-val{min-width:32px;text-align:center;font-size:15px;font-weight:600;color:#111}
.add-btn{flex:1;padding:14px 16px;background:#111;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,transform .1s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;letter-spacing:.3px}
.add-btn:hover:not(.unready){background:#333}
.add-btn:active:not(.unready){transform:scale(.98)}
.add-btn.unready{background:#bbb;cursor:default}
.add-btn.ok{background:#16a34a!important}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.shake{animation:shake .3s ease}
#cart-bar{position:fixed;bottom:0;left:0;right:0;background:#111;color:#fff;text-decoration:none;padding:14px 24px;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px));display:none;align-items:center;justify-content:space-between;cursor:pointer;z-index:50;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.cb-l{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:400;color:rgba(255,255,255,.55);letter-spacing:.2px}
.cb-ic{font-size:18px}
.cb-r{display:flex;align-items:center;gap:10px}
.cb-total{font-size:15px;font-weight:700;color:#fff}
.cb-cta{font-size:11px;background:rgba(255,255,255,.12);padding:5px 14px;border-radius:4px;font-weight:600;color:#fff;letter-spacing:.2px}
.cart-mo{max-width:480px}
.cart-hdr{font-size:17px;font-weight:700;color:#111;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #eae8e4;letter-spacing:-.2px}
.ci-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f3f1ee}
.ci-info{flex:1;min-width:0}
.ci-name{font-size:13px;font-weight:600;color:#111;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-det{font-size:11px;color:#bbb;margin-top:2px}
.ci-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
.ci-qty{display:flex;align-items:center;background:#f5f4f1;border-radius:4px;overflow:hidden;border:1px solid #e4e2de}
.ci-qty button{width:28px;height:28px;border:none;background:transparent;font-size:14px;cursor:pointer;color:#333;touch-action:manipulation;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center}
.ci-qty button:active{background:#eae8e4}
.ci-qty span{min-width:22px;text-align:center;font-size:13px;font-weight:600;color:#111}
.ci-sub{font-size:12px;font-weight:600;color:#111}
.empty-cart{text-align:center;color:#ccc;padding:32px 0;font-size:13px}
.cart-footer{margin-top:10px}
.cart-ttl-row{display:flex;justify-content:space-between;align-items:center;padding:16px 0 14px;border-top:1px solid #eae8e4;font-size:12px;font-weight:500;color:#999;text-transform:uppercase;letter-spacing:.4px}
#cart-ttl{color:#111;font-size:22px;font-weight:700;letter-spacing:-.4px;text-transform:none}
.wa-btn{width:100%;padding:15px;background:#25D366;color:#fff;border:none;border-radius:7px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;letter-spacing:.2px}
.wa-btn:active{transform:scale(.98)}
.cart-note{font-size:11px;color:#ccc;text-align:center;margin-top:12px;line-height:1.6}
footer{text-align:center;padding:32px 20px;color:#ccc;font-size:10px;border-top:1px solid #e9e7e4;letter-spacing:.7px;text-transform:uppercase}
footer b{color:#8b6a3e;font-weight:600}
@media(max-width:640px){.grid{grid-template-columns:repeat(2,1fr);gap:12px}main{padding:16px 14px calc(90px + env(safe-area-inset-bottom,0px))}.bar{margin-bottom:16px}header{padding:0 16px}.hd{display:none}.sw input{width:148px}}
`

    // JS del portal de pedidos
    const js = [
      'var PD=' + JSON.stringify(pdData) + ';',
      'var BP=' + JSON.stringify(waPhone) + ';',
      'var BN=' + JSON.stringify(businessName) + ';',
      'var cart=[];var selSz={};var selQty={};',

      // Búsqueda
      'function fc(q){q=(q||"").toLowerCase().trim();var t=0;',
      'document.querySelectorAll("a.card").forEach(function(c){',
      'var s=!q||(c.dataset.name||"").toLowerCase().includes(q)||(c.dataset.brand||"").toLowerCase().includes(q);',
      'c.style.display=s?"flex":"none";if(s)t++;});',
      'var el=document.getElementById("cnt");',
      'if(el)el.textContent=t+" producto"+(t!==1?"s":"")+" disponible"+(t!==1?"s":"");}',

      // Seleccionar tamaño — recibe `this`; usa classList en lugar de atributo disabled (más confiable en iOS)
      'function setSz(id,ml,price,btn){',
      'selSz[id]={ml:ml,price:price};',
      'document.querySelectorAll("#sz-"+id+" .sz-btn").forEach(function(b){b.classList.remove("active");});',
      'if(btn)btn.classList.add("active");',
      'var ab=document.getElementById("add-"+id);',
      'if(ab)ab.classList.remove("unready");}',

      // Ajustar cantidad
      'function adjQty(id,d){',
      'if(!selQty[id])selQty[id]=1;',
      'selQty[id]=Math.max(1,selQty[id]+d);',
      'var el=document.getElementById("qty-"+id);',
      'if(el)el.textContent=selQty[id];}',

      // Agregar al carrito
      'function addCart(id){',
      'var p=PD[id];if(!p)return;',
      'var isd=p.type==="decant_source";',
      'var sz=selSz[id];',
      'if(isd&&!sz){',
      'var sel=document.getElementById("sz-"+id);',
      'if(sel){sel.classList.add("shake");setTimeout(function(){sel.classList.remove("shake");},400);}return;}',
      'var qty=selQty[id]||1;',
      'var ml=isd?sz.ml:null;',
      'var price=isd?sz.price:p.price;',
      'var key=id+"-"+(ml||"s");',
      'var ex=cart.findIndex(function(c){return c.key===key;});',
      'if(ex>=0){cart[ex].qty+=qty;}',
      'else{cart.push({key:key,id:id,name:p.name,brand:p.brand,ml:ml,qty:qty,price:price});}',
      'selQty[id]=1;',
      'var qv=document.getElementById("qty-"+id);if(qv)qv.textContent="1";',
      'var btn=document.getElementById("add-"+id);',
      'if(btn){btn.textContent="\\u2713 Agregado";btn.classList.add("ok","unready");',
      'setTimeout(function(){',
      'btn.textContent="Agregar al pedido";btn.classList.remove("ok");',
      'if(isd){btn.classList.add("unready");selSz[id]=null;',
      'document.querySelectorAll("#sz-"+id+" .sz-btn").forEach(function(b){b.classList.remove("active");});}',
      'else{btn.classList.remove("unready");}',
      'var at=document.querySelector(\'a[href="#top"]\');if(at)at.click();',
      '},750);}',
      'updateCart();}',

      // Actualizar UI del carrito
      'function updateCart(){',
      'var total=cart.reduce(function(s,c){return s+c.price*c.qty;},0);',
      'var count=cart.reduce(function(s,c){return s+c.qty;},0);',
      'var bar=document.getElementById("cart-bar");',
      'if(!bar)return;',
      'if(count>0){',
      'bar.style.display="flex";',
      'document.body.style.paddingBottom="calc(80px + env(safe-area-inset-bottom,0px))";',
      'document.getElementById("cb-n").textContent=count+" "+(count===1?"ítem":"ítems");',
      'document.getElementById("cb-total").textContent="Gs. "+total.toLocaleString("es-PY");',
      '}else{bar.style.display="none";document.body.style.paddingBottom="";}',
      'var itemsEl=document.getElementById("cart-items");',
      'if(!itemsEl)return;',
      'if(cart.length===0){itemsEl.innerHTML="<p class=\'empty-cart\'>Tu pedido est&aacute; vac&iacute;o.</p>";}',
      'else{itemsEl.innerHTML=cart.map(function(c){',
      'var sz=c.ml?c.ml+"ml":"Sellado";',
      'var sub="Gs. "+(c.price*c.qty).toLocaleString("es-PY");',
      'return "<div class=\'ci-row\'><div class=\'ci-info\'><div class=\'ci-name\'>"+c.name+"</div>"+',
      '"<div class=\'ci-det\'>"+c.brand+" &middot; "+sz+"</div></div>"+',
      '"<div class=\'ci-right\'>"+',
      '"<div class=\'ci-qty\'>"+',
      '"<button onclick=\'cartAdj(\\\""+c.key+"\\\",-1)\'>&#8722;</button>"+',
      '"<span>"+c.qty+"</span>"+',
      '"<button onclick=\'cartAdj(\\\""+c.key+"\\\",1)\'>+</button>"+',
      '"</div><div class=\'ci-sub\'>"+sub+"</div></div></div>";',
      '}).join("");}',
      'var ttl=document.getElementById("cart-ttl");',
      'if(ttl)ttl.textContent="Gs. "+total.toLocaleString("es-PY");}',

      // Ajustar cantidad desde el carrito
      'function cartAdj(key,d){',
      'var i=cart.findIndex(function(c){return c.key===key;});',
      'if(i<0)return;',
      'cart[i].qty+=d;',
      'if(cart[i].qty<=0)cart.splice(i,1);',
      'updateCart();}',

      // Enviar por WhatsApp
      'function sendWA(){',
      'if(cart.length===0)return;',
      'var lines=cart.map(function(c){',
      'var sz=c.ml?c.ml+"ml":"Sellado";',
      'return "\\u2022 "+c.brand+" \\u2014 "+c.name+" | "+sz+" | \\u00d7"+c.qty+" \\u2192 Gs. "+(c.price*c.qty).toLocaleString("es-PY");',
      '});',
      'var total=cart.reduce(function(s,c){return s+c.price*c.qty;},0);',
      'var msg="*Pedido \\u2014 "+BN+"*\\n\\n"+lines.join("\\n")+',
      '"\\n\\n*Total: Gs. "+total.toLocaleString("es-PY")+"*"+',
      '"\\n\\nAguardo confirmaci\\u00f3n de disponibilidad y datos de entrega.";',
      'var url=BP?"https://wa.me/"+BP+"?text="+encodeURIComponent(msg):"https://wa.me/?text="+encodeURIComponent(msg);',
      'window.open(url,"_blank");}',

      // Escape key cierra modal
      'document.addEventListener("keydown",function(e){if(e.key==="Escape"&&location.hash.startsWith("#")){var at=document.querySelector(\'a[href="#top"]\');if(at)at.click();}});',
    ].join('\n')

    const html = '<!DOCTYPE html>\n' +
      '<html lang="es">\n<head>\n' +
      '<meta charset="UTF-8"/>\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"/>\n' +
      '<meta name="theme-color" content="#141212"/>\n' +
      '<title>' + escHtml(businessName) + ' — Catálogo</title>\n' +
      '<style>\n' + css + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<div id="top"></div>\n' +
      '<div id="wv-banner" class="wv-banner">' +
      '<strong>Para hacer pedidos, abrí este catálogo en Safari</strong>' +
      '<span>Tocá &#8943; o el ícono Compartir → "Abrir en Safari"</span>' +
      '</div>\n' +
      '<script>(function(){' +
      'var ua=navigator.userAgent;' +
      'var isIOS=/iPhone|iPad|iPod/i.test(ua);' +
      'var inWV=isIOS&&/AppleWebKit/i.test(ua)&&!/Safari\\/\\d/.test(ua);' +
      'if(inWV){var b=document.getElementById("wv-banner");if(b)b.style.display="block";}' +
      '})();</script>\n' +
      '<header>\n' +
      '  <div class="lb">' + logoHtml + '</div>\n' +
      '  <div class="ht">\n' +
      '    <div class="hn">' + escHtml(businessName) + '</div>\n' +
      '    <div class="hs">Cat&aacute;logo de Fragancias' + (businessPhone ? ' &middot; ' + escHtml(businessPhone) : '') + '</div>\n' +
      '  </div>\n' +
      '  <span class="hd">' + date + '</span>\n' +
      '</header>\n' +
      '<main>\n' +
      '  <div class="bar">\n' +
      '    <span class="cnt" id="cnt">' + n + ' producto' + (n !== 1 ? 's' : '') + ' disponible' + (n !== 1 ? 's' : '') + '</span>\n' +
      '    <div class="sw">\n' +
      '      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>\n' +
      '      <input type="search" placeholder="Buscar perfume o marca..." oninput="fc(this.value)" onkeyup="fc(this.value)" onsearch="fc(this.value)" onchange="fc(this.value)" autocomplete="off" autocorrect="off" autocapitalize="off" />\n' +
      '    </div>\n' +
      '  </div>\n' +
      '  <div class="grid">\n' + productCards.join('\n') + '\n  </div>\n' +
      '</main>\n' +
      '<footer><b>' + escHtml(businessName) + '</b> &middot; ' + date + '</footer>\n' +
      // Todos los modales de productos
      productModals.join('\n') + '\n' +
      // Modal del carrito
      cartModal + '\n' +
      // Barra de carrito fija
      '<a id="cart-bar" href="#cart">\n' +
      '  <div class="cb-l"><span class="cb-ic">&#128722;</span><span id="cb-n">0 &iacute;tems</span></div>\n' +
      '  <div class="cb-r"><span class="cb-total" id="cb-total">Gs. 0</span><span class="cb-cta">Ver pedido &rarr;</span></div>\n' +
      '</a>\n' +
      '<script>\n' + js + '\n</script>\n' +
      '</body>\n</html>'

    const filename = escHtml(businessName).replace(/[^a-zA-Z0-9]/g, '-') + '-catalogo.html'
    return { html, filename }
  }

  async function exportHTML() {
    const { html, filename } = await buildCatalogHTML()
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(blobUrl)
  }

  async function publishGitHub() {
    const token = await getConfig('github_token')
    const username = await getConfig('github_username')
    const repo = await getConfig('github_repo')

    if (!token || !username || !repo) {
      setPublishError('Configurá GitHub Pages en Configuración antes de publicar.')
      return
    }

    setPublishing(true)
    setPublishError('')
    setPublishedUrl('')

    try {
      const { html } = await buildCatalogHTML()

      // Encode UTF-8 → base64 (btoa solo acepta Latin-1)
      const bytes = new TextEncoder().encode(html)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const content = btoa(binary)

      const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/catalogo.html`
      const headers = {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      }

      // Obtener SHA del archivo actual (necesario para actualizar)
      let sha: string | undefined
      const getRes = await fetch(apiUrl, { headers })
      if (getRes.ok) {
        const data = await getRes.json()
        sha = data.sha
      } else if (getRes.status !== 404) {
        throw new Error(`Error al acceder al repositorio (${getRes.status})`)
      }

      // Crear o actualizar archivo
      const body: Record<string, string> = { message: 'Actualizar catálogo', content }
      if (sha) body.sha = sha

      const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) })
      if (!putRes.ok) {
        const err = await putRes.json()
        throw new Error(err.message ?? `Error ${putRes.status}`)
      }

      const pageUrl = repo === `${username}.github.io`
        ? `https://${username}.github.io/catalogo.html`
        : `https://${username}.github.io/${repo}/catalogo.html`

      setPublishedUrl(pageUrl)
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Error desconocido al publicar')
    } finally {
      setPublishing(false)
    }
  }

  async function copyPublishedUrl() {
    if (!publishedUrl) return
    await navigator.clipboard.writeText(publishedUrl)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  return (
    <div className="min-h-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Catálogo</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'fragancia disponible' : 'fragancias disponibles'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<Globe size={14} />} onClick={publishGitHub} disabled={publishing}>
            {publishing ? 'Publicando...' : 'Publicar'}
          </Button>
          <Button variant="secondary" size="sm" icon={<FileCode size={14} />} onClick={exportHTML}>HTML</Button>
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportPDF}>PDF</Button>
        </div>
      </div>

      {/* ── Banners ── */}
      {publishedUrl && (
        <div className="mb-5 bg-green-50 border border-green-100 rounded-2xl p-4 flex items-start gap-3">
          <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">Catálogo publicado</p>
            <p className="text-xs font-mono text-green-600 mt-0.5 break-all">{publishedUrl}</p>
            <p className="text-xs text-green-400 mt-0.5">Puede tardar 1–2 minutos en actualizarse.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={copyPublishedUrl}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
              {urlCopied ? <Check size={11} /> : <Copy size={11} />}
              {urlCopied ? 'Copiado' : 'Copiar'}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent('Nuestro catálogo: ' + publishedUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="px-2.5 py-1 bg-[#25D366] hover:bg-[#22c55e] text-white text-xs font-semibold rounded-lg transition-colors">
              WA
            </a>
            <button onClick={() => setPublishedUrl('')} className="p-1 text-green-400 hover:text-green-600 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      )}
      {publishError && (
        <div className="mb-5 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-red-400 font-bold shrink-0 text-sm">!</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Error al publicar</p>
            <p className="text-xs text-red-500 mt-0.5">{publishError}</p>
          </div>
          <button onClick={() => setPublishError('')} className="p-1 text-red-300 hover:text-red-500 transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Búsqueda + toggle filtros ── */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-colors placeholder:text-gray-300"
              placeholder="Buscar fragancia o marca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
              showFilters || filterFamily !== 'all' || minPrice || maxPrice
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {(filterFamily !== 'all' || minPrice || maxPrice) && (
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            )}
          </button>
        </div>

        {/* Pills de tipo */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {([
            { value: 'all', label: 'Todos' },
            { value: 'sealed', label: 'Sellados' },
            { value: 'decant', label: 'Decants' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`flex-none px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filterType === opt.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="w-px bg-gray-100 self-stretch mx-1 shrink-0" />
          {families.map(f => (
            <button
              key={f.value}
              onClick={() => setFilterFamily(prev => prev === f.value ? 'all' : f.value)}
              className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filterFamily === f.value ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Panel filtros avanzados */}
        {showFilters && (
          <div className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Precio mínimo</label>
              <input type="number" placeholder="Gs. 0"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                value={minPrice} onChange={e => setMinPrice(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Precio máximo</label>
              <input type="number" placeholder="Sin límite"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
            {(minPrice || maxPrice) && (
              <button onClick={() => { setMinPrice(''); setMaxPrice('') }}
                className="self-end p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer">
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Grid / Empty state ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ImagePlaceholder size={36} />
          </div>
          <p className="text-gray-500 font-medium">Sin fragancias disponibles</p>
          <p className="text-sm text-gray-300 mt-1">
            {search || filterFamily !== 'all' || filterType !== 'all'
              ? 'Probá con otros filtros'
              : 'Agregá stock desde Inventario'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(p => {
            const availableSizes = [
              { sizeML: 3, sellingPricePYG: p.price3ML ?? 0 },
              { sizeML: 5, sellingPricePYG: p.price5ML ?? 0 },
              { sizeML: 10, sellingPricePYG: p.price10ML ?? 0 },
              { sizeML: 30, sellingPricePYG: p.price30ML ?? 0 },
            ].filter(s => s.sellingPricePYG > 0)
            const minDecantPrice = availableSizes.length > 0
              ? Math.min(...availableSizes.map(s => s.sellingPricePYG)) : null
            const typeLabel = p.type === 'sealed' ? 'Sellado' : p.type === 'tester' ? 'Tester' : 'Decant'
            const typePill = p.type === 'sealed'
              ? 'bg-sky-500/10 text-sky-700'
              : p.type === 'tester' ? 'bg-amber-500/10 text-amber-700'
              : 'bg-violet-500/10 text-violet-700'

            const hasStock = (p.type === 'sealed' && p.stockSealed > 0)
              || (p.type === 'decant_source' && p.stockOpenML > 0)
              || (p.type === 'tester' && (p.stockSealed ?? 0) > 0)
            const isForced = p.catalogVisible === true
            const isHidden = p.catalogVisible === false
            // Mensaje y colores del botón ojo
            const eyeTitle = isForced
              ? 'Forzado visible (sin stock igual aparece en catálogo) — clic para quitar'
              : isHidden
                ? 'Oculto del catálogo — clic para restaurar'
                : hasStock
                  ? 'Visible en catálogo (hay stock) — clic para ocultar'
                  : 'Sin stock: no está en catálogo — clic para forzar visible'
            const eyeBtnClass = isForced
              ? 'bg-green-500 text-white'
              : isHidden
                ? 'bg-red-500 text-white'
                : hasStock
                  ? 'bg-white/70 text-gray-400 hover:bg-white/90 hover:text-gray-700'
                  : 'bg-orange-400 text-white'

            return (
              <button
                key={p.id}
                className={`group text-left bg-white rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                  !hasStock && !isForced
                    ? 'border-orange-100 opacity-60 hover:opacity-80'
                    : 'border-gray-100 hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5'
                }`}
                onClick={() => setSelectedProduct(p)}
              >
                {/* Imagen portrait */}
                <div className="relative aspect-[3/4] bg-gradient-to-b from-stone-50 to-stone-100 overflow-hidden">
                  {p.imageIds?.[0] ? (
                    <CatalogThumb imageId={p.imageIds[0]} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImagePlaceholder size={52} />
                    </div>
                  )}
                  {/* Badge tipo */}
                  <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${typePill}`}>
                    {typeLabel}
                  </span>
                  {/* Botón visibilidad catálogo */}
                  <button
                    title={eyeTitle}
                    onClick={e => { e.stopPropagation(); toggleCatalogVisible(p) }}
                    className={`absolute top-2 right-2 p-1 rounded-full backdrop-blur-sm transition-colors cursor-pointer ${eyeBtnClass}`}
                  >
                    {isHidden || (!hasStock && !isForced) ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                  {/* Badge "Sin stock" para productos no forzados */}
                  {!hasStock && !isForced && (
                    <div className="absolute bottom-0 inset-x-0 bg-orange-400/80 backdrop-blur-sm text-white text-[9px] font-semibold text-center py-0.5">
                      Sin stock
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest truncate">{p.brand}</p>
                  <p className={`text-sm font-semibold leading-snug mt-0.5 line-clamp-2 transition-colors ${!hasStock && !isForced ? 'text-gray-400' : 'text-gray-900 group-hover:text-violet-700'}`}>
                    {p.name}
                  </p>
                  <div className="mt-2">
                    {p.type === 'sealed' || p.type === 'tester' ? (
                      p.sellingPricePYG > 0
                        ? <p className="text-sm font-bold text-gray-900">{fmtPYG(p.sellingPricePYG)}</p>
                        : <p className="text-xs text-gray-300 italic">A consultar</p>
                    ) : (
                      minDecantPrice
                        ? <p className="text-sm font-bold text-gray-900">desde {fmtPYG(minDecantPrice)}</p>
                        : <p className="text-xs text-gray-300 italic">Ver disponibilidad</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  )
}
