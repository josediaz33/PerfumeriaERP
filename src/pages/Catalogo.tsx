import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Download, BookImage, FileCode, X } from 'lucide-react'
import { db } from '../db/db'
import type { Product, OlfactiveFamily } from '../db/types'
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

const familyLabel = (f: OlfactiveFamily) => families.find(x => x.value === f)?.label ?? f

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
      <span className="text-5xl select-none">🌸</span>
    </div>
  )
  return <img src={url} alt="" className="w-full h-full object-cover" />
}

// ── CATX-06: ficha individual ──────────────────────────────────────────────────
function ProductModal({ product, onClose }: {
  product: Product
  onClose: () => void
}) {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="relative aspect-square max-h-64 bg-gradient-to-br from-amber-50 to-stone-100 overflow-hidden">
          {imgUrl ? (
            <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl select-none">🌸</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full shadow hover:bg-white transition-colors"
          >
            <X size={16} className="text-gray-600" />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-2 mb-3">
            <Badge color={product.type === 'sealed' ? 'blue' : product.type === 'tester' ? 'yellow' : 'violet'}>
              {product.type === 'sealed' ? 'Sellado' : product.type === 'tester' ? 'Tester' : 'Decants'}
            </Badge>
            {product.olfactiveFamily && (
              <Badge color="gray">{familyLabel(product.olfactiveFamily)}</Badge>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{product.brand}</p>
          <p className="text-sm text-gray-400 mt-1">{product.concentration} · {product.sizeML}ml</p>
          {product.notes && (
            <p className="text-sm text-gray-600 mt-3 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
              {product.notes}
            </p>
          )}
          <div className="mt-4">
            {product.type === 'sealed' || product.type === 'tester' ? (
              product.sellingPricePYG > 0 ? (
                <p className="text-2xl font-bold text-violet-600">{fmtPYG(product.sellingPricePYG)}</p>
              ) : (
                <p className="text-sm text-gray-400">Precio a consultar</p>
              )
            ) : (
              sizes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sizes.map(b => (
                    <div key={b.sizeML} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5 text-center">
                      <p className="text-xs text-violet-500 font-medium">{b.sizeML}ml</p>
                      <p className="text-sm font-bold text-violet-700">{fmtPYG(b.sellingPricePYG)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Ver disponibilidad</p>
              )
            )}
          </div>
          {(product.type === 'sealed' || product.type === 'tester') && (
            <p className="text-xs text-gray-400 mt-3">Stock: {product.stockSealed} unidad{product.stockSealed !== 1 ? 'es' : ''}</p>
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

  const available = products.filter(p => {
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
  async function exportHTML() {
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

    const n = filtered.length
    const date = new Date().toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' })

    const logoHtml = logoSrc
      ? '<img src="' + logoSrc + '" alt="' + escHtml(businessName) + '" />'
      : '<span class="li">' + escHtml(businessName.charAt(0).toUpperCase()) + '</span>'

    // Objeto de datos de producto para el JS del portal
    const pdData: Record<number, { name: string; brand: string; type: string; price: number }> = {}
    filtered.forEach(p => {
      pdData[p.id!] = {
        name: p.name,
        brand: p.brand,
        type: p.type,
        price: (p.type === 'sealed' || p.type === 'tester') ? p.sellingPricePYG : 0,
      }
    })

    // Generar tarjeta + modal por producto
    const productItems = await Promise.all(filtered.map(async p => {
      let imgTag = '<span class="ph">🌸</span>'
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
      const cardPrice = isDecant
        ? (szs.length > 0
          ? '<div class="chips">' + szs.map(b => '<span class="chip">' + b.sizeML + 'ml &middot; Gs. ' + b.sellingPricePYG.toLocaleString('es-PY') + '</span>').join('') + '</div>'
          : '<p class="consult">Consultar disponibilidad</p>')
        : (p.sellingPricePYG > 0
          ? '<p class="cprice">Gs. ' + p.sellingPricePYG.toLocaleString('es-PY') + '</p>'
          : '<p class="consult">Consultar precio</p>')

      // Tarjeta: link nativo → activa :target del modal
      const card =
        '<a href="#p-' + p.id + '" class="card" data-name="' + escHtml(p.name) + '" data-brand="' + escHtml(p.brand) + '">' +
        '<div class="ci">' + imgTag + '</div>' +
        '<div class="cb">' +
        '<span class="badge ' + bc + '">' + bl + '</span>' +
        '<div class="ct">' + escHtml(p.name) + '</div>' +
        '<div class="cbr">' + escHtml(p.brand) + '</div>' +
        '<div class="cm">' + escHtml(p.concentration) + ' &middot; ' + p.sizeML + 'ml</div>' +
        cardPrice +
        '<div class="cta">Ver y pedir &rarr;</div>' +
        '</div></a>'

      // Selector de tamaños para decants
      const sizeSelector = isDecant && szs.length > 0
        ? '<p class="sz-lbl">Elegí el tamaño</p>' +
          '<div class="sz-sel" id="sz-' + p.id + '">' +
          szs.map(b =>
            '<button class="sz-btn" onclick="setSz(' + p.id + ',' + b.sizeML + ',' + b.sellingPricePYG + ')">' +
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

      // Botón agregar: disabled para decants hasta que se elige tamaño
      const addDisabled = isDecant ? ' disabled' : ''

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
        '<button class="add-btn" id="add-' + p.id + '"' + addDisabled + ' onclick="addCart(' + p.id + ')">' +
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

    const css = [
      '*{margin:0;padding:0;box-sizing:border-box}',
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f4f2ee;color:#1a1a2e;min-height:100vh}',
      'header{background:linear-gradient(135deg,#141212,#1e1a1a);padding:20px 28px;display:flex;align-items:center;gap:16px}',
      '.lb{width:46px;height:46px;border-radius:11px;overflow:hidden;background:#2a2520;border:1px solid #3a3028;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.lb img{width:100%;height:100%;object-fit:cover}',
      '.li{font-size:20px;font-weight:800;color:#c8a96e}',
      '.ht{flex:1;min-width:0}',
      '.hn{color:#c8a96e;font-size:18px;font-weight:700;letter-spacing:-.2px}',
      '.hs{color:#7a6545;font-size:12px;margin-top:2px}',
      '.hd{color:#5e4e35;font-size:11px;white-space:nowrap}',
      'main{max-width:1200px;margin:0 auto;padding:24px 20px 100px}',
      '.bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:10px;flex-wrap:wrap}',
      '.cnt{font-size:13px;color:#999}',
      '.sw{position:relative}',
      '.sw input{padding:9px 14px 9px 38px;border:1.5px solid #ddd;border-radius:11px;font-size:14px;outline:none;width:230px;background:#fff;color:#333;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none}',
      '.sw input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12)}',
      '.sw svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#bbb;pointer-events:none}',
      // Grid
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}',
      // Card
      'a.card{text-decoration:none;color:inherit;display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;box-shadow:0 1px 4px rgba(0,0,0,.08);touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      'a.card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.12)}',
      '.ci{aspect-ratio:1;background:linear-gradient(135deg,#faf7ef,#ece8dd);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}',
      '.ci img{width:100%;height:100%;object-fit:cover;transition:transform .3s}',
      'a.card:hover .ci img{transform:scale(1.04)}',
      '.ph{font-size:52px;user-select:none}',
      '.cb{padding:12px;display:flex;flex-direction:column;flex:1}',
      '.badge{display:inline-block;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px}',
      '.bs{background:#dbeafe;color:#1e40af}.bt{background:#fef3c7;color:#92400e}.bd{background:#ede9fe;color:#5b21b6}.bf{background:#dcfce7;color:#14532d}',
      '.ct{font-size:14px;font-weight:700;color:#111;line-height:1.3}',
      '.cbr{font-size:12px;color:#777;margin-top:2px}',
      '.cm{font-size:11px;color:#bbb;margin-top:2px}',
      '.cprice{font-size:15px;font-weight:700;color:#7c3aed;margin-top:9px}',
      '.consult{font-size:11px;color:#bbb;margin-top:9px;font-style:italic}',
      '.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:9px}',
      '.chip{font-size:11px;font-weight:600;background:#ede9fe;color:#5b21b6;padding:3px 7px;border-radius:5px}',
      '.cta{font-size:12px;color:#7c3aed;font-weight:600;margin-top:auto;padding-top:10px;display:flex;align-items:center;gap:3px}',
      // Modal base — CSS :target (funciona sin JS en iOS Quick Look)
      '.mow{display:none;position:fixed;inset:0;z-index:100;align-items:flex-end;justify-content:center;padding:0}',
      '.mow:target{display:flex}',
      '.mow-bg{position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}',
      '.mo{position:relative;z-index:1;background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 -8px 40px rgba(0,0,0,.18);animation:slideup .25s ease}',
      '@media(min-width:600px){.mow{align-items:center;padding:20px}.mo{border-radius:20px;max-height:88vh}}',
      '@keyframes slideup{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.mi{aspect-ratio:4/3;background:linear-gradient(135deg,#faf7ef,#ece8dd);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:16px 16px 0 0}',
      '@media(min-width:600px){.mi{border-radius:16px 16px 0 0}}',
      '.mi img{width:100%;height:100%;object-fit:cover}',
      '.mi .ph{font-size:80px}',
      '.mb{padding:20px 20px 28px}',
      '.mbg{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '.mtit{font-size:22px;font-weight:800;color:#111;line-height:1.2}',
      '.mbrnd{font-size:14px;color:#888;margin-top:3px}',
      '.mmet{font-size:13px;color:#bbb;margin-top:2px}',
      '.mnts{font-size:13px;color:#555;background:#faf8f4;border-left:3px solid #c8a96e;border-radius:0 8px 8px 0;padding:10px 13px;margin-top:12px;line-height:1.6}',
      '.mpr{font-size:28px;font-weight:800;color:#7c3aed;margin-top:14px}',
      // Size selector
      '.sz-lbl{font-size:11px;font-weight:700;color:#888;margin-top:16px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}',
      '.sz-sel{display:flex;flex-wrap:wrap;gap:8px}',
      '.sz-btn{background:#faf5ff;border:2px solid #ede9fe;border-radius:11px;padding:10px 14px;cursor:pointer;text-align:center;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-width:72px;outline:none}',
      '.sz-btn:hover{border-color:#7c3aed;background:#ede9fe}',
      '.sz-btn.active{border-color:#7c3aed;background:#7c3aed;color:#fff}',
      '.sz-ml{display:block;font-size:15px;font-weight:800;line-height:1.2}',
      '.sz-pr{display:block;font-size:11px;margin-top:3px;opacity:.75}',
      '.sz-btn.active .sz-pr{opacity:.85}',
      // Quantity + Add
      '.act-row{display:flex;gap:10px;align-items:center;margin-top:16px}',
      '.qty-ctl{display:flex;align-items:center;background:#faf5ff;border-radius:11px;overflow:hidden;border:1.5px solid #ede9fe;flex-shrink:0}',
      '.qty-btn{width:38px;height:44px;border:none;background:transparent;font-size:20px;cursor:pointer;color:#7c3aed;font-weight:700;touch-action:manipulation;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;line-height:1}',
      '.qty-btn:active{background:#ede9fe}',
      '.qty-val{min-width:34px;text-align:center;font-size:16px;font-weight:800;color:#5b21b6}',
      '.add-btn{flex:1;padding:12px 16px;background:#7c3aed;color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s,transform .1s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;letter-spacing:.1px}',
      '.add-btn:hover:not(:disabled){background:#6d28d9}',
      '.add-btn:active:not(:disabled){transform:scale(.97)}',
      '.add-btn:disabled{background:#c4b5fd;cursor:default}',
      '.add-btn.ok{background:#16a34a!important}',
      // Shake animation for size selector
      '@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}',
      '.shake{animation:shake .35s ease}',
      // Close button
      'a.xcl{position:absolute;top:12px;right:12px;width:36px;height:36px;background:rgba(255,255,255,.92);border-radius:50%;font-size:16px;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#555;box-shadow:0 2px 8px rgba(0,0,0,.14);z-index:2;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer;line-height:1}',
      'a.xcl:hover{background:#fff;color:#111}',
      // Cart bar — fixed bottom
      '#cart-bar{position:fixed;bottom:0;left:0;right:0;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:13px 20px;display:none;align-items:center;justify-content:space-between;cursor:pointer;z-index:50;box-shadow:0 -4px 24px rgba(124,58,237,.4);touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      '.cb-l{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500}',
      '.cb-ic{font-size:17px}',
      '.cb-r{display:flex;align-items:center;gap:6px}',
      '.cb-total{font-size:15px;font-weight:800}',
      '.cb-cta{font-size:12px;background:rgba(255,255,255,.2);padding:4px 10px;border-radius:20px;font-weight:600}',
      // Cart modal
      '.cart-mo{max-width:480px}',
      '.cart-hdr{font-size:19px;font-weight:800;color:#111;margin-bottom:14px;padding-bottom:12px;border-bottom:1.5px solid #f0eee8}',
      '.ci-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f5f3ef}',
      '.ci-info{flex:1;min-width:0}',
      '.ci-name{font-size:14px;font-weight:700;color:#111;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ci-det{font-size:12px;color:#888;margin-top:1px}',
      '.ci-right{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}',
      '.ci-qty{display:flex;align-items:center;background:#faf5ff;border-radius:8px;overflow:hidden;border:1.5px solid #ede9fe}',
      '.ci-qty button{width:30px;height:28px;border:none;background:transparent;font-size:14px;cursor:pointer;color:#7c3aed;font-weight:700;touch-action:manipulation;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center}',
      '.ci-qty button:active{background:#ede9fe}',
      '.ci-qty span{min-width:22px;text-align:center;font-size:13px;font-weight:700;color:#5b21b6}',
      '.ci-sub{font-size:13px;font-weight:700;color:#7c3aed}',
      '.empty-cart{text-align:center;color:#ccc;padding:24px 0;font-style:italic;font-size:14px}',
      '.cart-footer{margin-top:6px}',
      '.cart-ttl-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0 12px;border-top:2px solid #ede9fe;font-size:14px;font-weight:600;color:#555}',
      '#cart-ttl{color:#7c3aed;font-size:20px;font-weight:800}',
      '.wa-btn{width:100%;padding:15px;background:#25D366;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;letter-spacing:.2px;box-shadow:0 4px 14px rgba(37,211,102,.35)}',
      '.wa-btn:hover{background:#22c55e}',
      '.wa-btn:active{transform:scale(.98)}',
      '.cart-note{font-size:11px;color:#bbb;text-align:center;margin-top:10px;line-height:1.5;font-style:italic}',
      'footer{text-align:center;padding:24px;color:#aaa;font-size:12px;border-top:1px solid #e8e4dc}',
      'footer b{color:#9a7b3f}',
      // Responsive
      '@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr);gap:11px}main{padding:16px 12px 90px}header{padding:14px 16px}.hd{display:none}.sw input{width:170px}}',
    ].join('\n')

    // JS del portal de pedidos
    const js = [
      'var PD=' + JSON.stringify(pdData) + ';',
      'var BP=' + JSON.stringify(waPhone) + ';',
      'var cart=[];var selSz={};var selQty={};',

      // Búsqueda
      'function fc(q){q=q.toLowerCase().trim();var t=0;',
      'document.querySelectorAll("a.card").forEach(function(c){',
      'var s=!q||c.dataset.name.toLowerCase().includes(q)||c.dataset.brand.toLowerCase().includes(q);',
      'c.style.display=s?"":"none";if(s)t++;});',
      'var el=document.getElementById("cnt");',
      'if(el)el.textContent=t+" producto"+(t!==1?"s":"")+" disponible"+(t!==1?"s":"");}',

      // Seleccionar tamaño
      'function setSz(id,ml,price){',
      'selSz[id]={ml:ml,price:price};',
      'document.querySelectorAll("#sz-"+id+" .sz-btn").forEach(function(b){b.classList.remove("active");});',
      'event.currentTarget.classList.add("active");',
      'var btn=document.getElementById("add-"+id);',
      'if(btn)btn.removeAttribute("disabled");}',

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
      'if(btn){btn.textContent="\\u2713 Agregado";btn.classList.add("ok");btn.setAttribute("disabled","");',
      'setTimeout(function(){',
      'btn.textContent="Agregar al pedido";btn.classList.remove("ok");',
      'if(isd){btn.setAttribute("disabled","");selSz[id]=null;',
      'document.querySelectorAll("#sz-"+id+" .sz-btn").forEach(function(b){b.classList.remove("active");});}',
      'else{btn.removeAttribute("disabled");}',
      'location.hash="#top";',
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
      'document.body.style.paddingBottom="70px";',
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
      'var sub="Gs. "+(c.price*c.qty).toLocaleString("es-PY");',
      'return "\\u2022 "+c.name+" ("+c.brand+") \\u2014 "+sz+" \\u00d7 "+c.qty+" = "+sub;',
      '});',
      'var total=cart.reduce(function(s,c){return s+c.price*c.qty;},0);',
      'var msg="\\u00a1Hola! Me gustar\\u00eda realizar el siguiente pedido:\\n\\n"+lines.join("\\n")+',
      '"\\n\\n*Total estimado: Gs. "+total.toLocaleString("es-PY")+"*"+',
      '"\\n\\n_Quedo a la espera de confirmar disponibilidad_ \\ud83c\\udf38";',
      'var url=BP?"https://wa.me/"+BP+"?text="+encodeURIComponent(msg):"https://wa.me/?text="+encodeURIComponent(msg);',
      'window.open(url,"_blank");}',

      // Escape key cierra modal
      'document.addEventListener("keydown",function(e){if(e.key==="Escape"&&location.hash.startsWith("#"))location.hash="#top";});',
    ].join('\n')

    const html = '<!DOCTYPE html>\n' +
      '<html lang="es">\n<head>\n' +
      '<meta charset="UTF-8"/>\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>\n' +
      '<meta name="theme-color" content="#141212"/>\n' +
      '<title>' + escHtml(businessName) + ' — Catálogo</title>\n' +
      '<style>\n' + css + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<div id="top"></div>\n' +
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
      '      <input type="search" placeholder="Buscar perfume o marca..." oninput="fc(this.value)" onkeyup="fc(this.value)" />\n' +
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
      '<div id="cart-bar" onclick="location.hash=\'#cart\'">\n' +
      '  <div class="cb-l"><span class="cb-ic">&#128722;</span><span id="cb-n">0 &iacute;tems</span></div>\n' +
      '  <div class="cb-r"><span class="cb-total" id="cb-total">Gs. 0</span><span class="cb-cta">Ver pedido &rarr;</span></div>\n' +
      '</div>\n' +
      '<script>\n' + js + '\n</script>\n' +
      '</body>\n</html>'

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = escHtml(businessName).replace(/[^a-zA-Z0-9]/g, '-') + '-catalogo.html'
    a.click()
    URL.revokeObjectURL(blobUrl)
  }

  return (
    <div>
      <PageHeader
        title="Catálogo"
        subtitle="Productos disponibles para compartir con clientes"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileCode size={15} />} onClick={exportHTML}>
              Exportar HTML
            </Button>
            <Button icon={<Download size={15} />} onClick={exportPDF}>
              Exportar PDF
            </Button>
          </div>
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
          const availableSizes = [
            { sizeML: 3, sellingPricePYG: p.price3ML ?? 0 },
            { sizeML: 5, sellingPricePYG: p.price5ML ?? 0 },
            { sizeML: 10, sellingPricePYG: p.price10ML ?? 0 },
            { sizeML: 30, sellingPricePYG: p.price30ML ?? 0 },
          ].filter(s => s.sellingPricePYG > 0)
          return (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedProduct(p)}
            >
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
                <Badge color={p.type === 'sealed' ? 'blue' : p.type === 'tester' ? 'yellow' : 'violet'}>
                  {p.type === 'sealed' ? 'Sellado' : p.type === 'tester' ? 'Tester' : 'Decants'}
                </Badge>
                <p className="font-semibold text-gray-900 mt-2 text-sm leading-tight">{p.name}</p>
                <p className="text-xs text-gray-500">{p.brand}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.concentration} · {p.sizeML}ml</p>
                {p.type === 'sealed' || p.type === 'tester' ? (
                  <p className="text-sm font-bold text-violet-600 mt-2">{fmtPYG(p.sellingPricePYG)}</p>
                ) : (
                  <div className="mt-2">
                    {availableSizes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {availableSizes.map(b => (
                          <div key={b.sizeML} className="text-xs bg-violet-50 text-violet-700 rounded px-1.5 py-0.5">
                            {b.sizeML}ml · {fmtPYG(b.sellingPricePYG)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Ver disponibilidad</p>
                    )}
                  </div>
                )}
                {(p.type === 'sealed' || p.type === 'tester') && (
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

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}
