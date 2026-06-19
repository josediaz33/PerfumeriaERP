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

  // Precios configurados en el producto (no en batches — los batches son lotes físicos)
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

  // ── CATX-07/08: HTML export autocontenida — modales via CSS :target (funciona en iOS Quick Look) ──
  async function exportHTML() {
    const configName = await db.config.where('key').equals('business_name').first()
    const businessName = configName?.value || 'JODA Parfums'
    const configPhone = await db.config.where('key').equals('business_phone').first()
    const businessPhone = configPhone?.value || ''

    const logoImg = await db.images.get('business-logo')
    const logoSrc = logoImg ? await blobToBase64(logoImg.blob) : null

    const n = filtered.length
    const date = new Date().toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' })

    const logoHtml = logoSrc
      ? '<img src="' + logoSrc + '" alt="' + escHtml(businessName) + '" />'
      : '<span class="li">' + escHtml(businessName.charAt(0).toUpperCase()) + '</span>'

    // Cada producto genera una tarjeta (link) + un modal (:target) embebido
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

      const bc = p.type === 'sealed' ? 'bs' : p.type === 'tester' ? 'bt' : 'bd'
      const bl = p.type === 'sealed' ? 'Sellado' : p.type === 'tester' ? 'Tester' : 'Decants'

      // Bloque precio para tarjeta
      const cardPrice = p.type === 'decant_source'
        ? (szs.length > 0
          ? '<div class="chips">' + szs.map(b => '<span class="chip">' + b.sizeML + 'ml &middot; Gs. ' + b.sellingPricePYG.toLocaleString('es-PY') + '</span>').join('') + '</div>'
          : '<p class="consult">Consultar disponibilidad</p>')
        : (p.sellingPricePYG > 0
          ? '<p class="cprice">Gs. ' + p.sellingPricePYG.toLocaleString('es-PY') + '</p>'
          : '<p class="consult">Consultar precio</p>')

      // Bloque precio para modal (layout expandido)
      const modalPrice = p.type === 'decant_source'
        ? (szs.length > 0
          ? '<div class="msz">' + szs.map(b => '<div class="mch"><div class="mchl">' + b.sizeML + 'ml</div><div class="mchp">Gs. ' + b.sellingPricePYG.toLocaleString('es-PY') + '</div></div>').join('') + '</div>'
          : '<p class="consult">Consultar disponibilidad</p>')
        : (p.sellingPricePYG > 0
          ? '<div class="mpr">Gs. ' + p.sellingPricePYG.toLocaleString('es-PY') + '</div>'
          : '<p class="consult">Precio a consultar</p>')

      const famBadge = p.olfactiveFamily
        ? '<span class="badge" style="background:#dcfce7;color:#14532d">' + escHtml(familyLabel(p.olfactiveFamily)) + '</span>'
        : ''

      // Tarjeta: <a> link nativo → cambia el hash de URL → activa :target del modal
      const card =
        '<a href="#p-' + p.id + '" class="card" data-name="' + escHtml(p.name) + '" data-brand="' + escHtml(p.brand) + '">' +
        '<div class="ci">' + imgTag + '</div>' +
        '<div class="cb">' +
        '<span class="badge ' + bc + '">' + bl + '</span>' +
        '<div class="ct">' + escHtml(p.name) + '</div>' +
        '<div class="cbr">' + escHtml(p.brand) + '</div>' +
        '<div class="cm">' + escHtml(p.concentration) + ' &middot; ' + p.sizeML + 'ml</div>' +
        cardPrice +
        '</div></a>'

      // Modal: :target lo muestra; botón cierre y backdrop van a #top (sin JS)
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
        '<div class="mpr-w">' + modalPrice + '</div>' +
        '</div>' +
        '</div>' +
        '</div>'

      return { card, modal }
    }))

    const productCards = productItems.map(x => x.card)
    const productModals = productItems.map(x => x.modal)

    const css = [
      '*{margin:0;padding:0;box-sizing:border-box}',
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f4f2ee;color:#1a1a2e;min-height:100vh}',
      'header{background:linear-gradient(135deg,#141212,#1e1a1a);padding:22px 32px;display:flex;align-items:center;gap:18px}',
      '.lb{width:50px;height:50px;border-radius:12px;overflow:hidden;background:#2a2520;border:1px solid #3a3028;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.lb img{width:100%;height:100%;object-fit:cover}',
      '.li{font-size:22px;font-weight:800;color:#c8a96e}',
      '.ht{flex:1;min-width:0}',
      '.hn{color:#c8a96e;font-size:19px;font-weight:700;letter-spacing:-.2px}',
      '.hs{color:#7a6545;font-size:12px;margin-top:3px}',
      '.hd{color:#5e4e35;font-size:12px;white-space:nowrap}',
      'main{max-width:1200px;margin:0 auto;padding:28px 24px}',
      '.bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;gap:10px;flex-wrap:wrap}',
      '.cnt{font-size:13px;color:#999}',
      '.sw{position:relative}',
      '.sw input{padding:8px 14px 8px 36px;border:1.5px solid #ddd;border-radius:10px;font-size:13px;outline:none;width:220px;background:#fff;color:#333;transition:border-color .2s,box-shadow .2s}',
      '.sw input:focus{border-color:#9a7b3f;box-shadow:0 0 0 3px rgba(154,123,63,.12)}',
      '.sw svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#bbb;pointer-events:none}',
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px}',
      'a.card{text-decoration:none;color:inherit;display:block;background:#fff;border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;box-shadow:0 1px 4px rgba(0,0,0,.07);touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      'a.card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.13)}',
      '.ci{aspect-ratio:1;background:linear-gradient(135deg,#faf7ef,#ece8dd);display:flex;align-items:center;justify-content:center;overflow:hidden}',
      '.ci img{width:100%;height:100%;object-fit:cover;transition:transform .3s}',
      'a.card:hover .ci img{transform:scale(1.05)}',
      '.ph{font-size:52px;user-select:none}',
      '.cb{padding:13px}',
      '.badge{display:inline-block;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px}',
      '.bs{background:#dbeafe;color:#1e40af}.bt{background:#fef3c7;color:#92400e}.bd{background:#ede9fe;color:#5b21b6}',
      '.ct{font-size:14px;font-weight:700;color:#111;line-height:1.3}',
      '.cbr{font-size:12px;color:#777;margin-top:2px}',
      '.cm{font-size:11px;color:#bbb;margin-top:2px}',
      '.cprice{font-size:15px;font-weight:700;color:#7c3aed;margin-top:10px}',
      '.consult{font-size:11px;color:#bbb;margin-top:10px;font-style:italic}',
      '.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}',
      '.chip{font-size:11px;font-weight:600;background:#ede9fe;color:#5b21b6;padding:3px 8px;border-radius:6px}',
      // Modales CSS :target — funcionan sin JS en iOS Quick Look / WhatsApp
      '.mow{display:none;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;padding:20px}',
      '.mow:target{display:flex}',
      '.mow-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}',
      '.mo{position:relative;z-index:1;background:#fff;border-radius:20px;max-width:420px;width:100%;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 32px 80px rgba(0,0,0,.22);animation:up .22s ease}',
      '@keyframes up{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.mi{aspect-ratio:4/3;background:linear-gradient(135deg,#faf7ef,#ece8dd);display:flex;align-items:center;justify-content:center;overflow:hidden}',
      '.mi img{max-width:100%;max-height:100%;object-fit:contain;padding:16px}',
      '.mi .ph{font-size:80px}',
      '.mb{padding:22px 24px 28px}',
      '.mbg{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}',
      '.mtit{font-size:22px;font-weight:800;color:#111;line-height:1.2}',
      '.mbrnd{font-size:14px;color:#888;margin-top:4px}',
      '.mmet{font-size:13px;color:#bbb;margin-top:3px}',
      '.mnts{font-size:13px;color:#555;background:#faf8f4;border-left:3px solid #c8a96e;border-radius:0 8px 8px 0;padding:12px 14px;margin-top:14px;line-height:1.6}',
      '.mpr{font-size:26px;font-weight:800;color:#7c3aed}',
      '.mpr-w{margin-top:14px}',
      '.msz{display:flex;flex-wrap:wrap;gap:8px}',
      '.mch{background:#ede9fe;color:#5b21b6;padding:10px 16px;border-radius:10px;text-align:center}',
      '.mchl{font-size:11px;color:#7c3aed;margin-bottom:2px}',
      '.mchp{font-size:14px;font-weight:700}',
      'a.xcl{position:absolute;top:14px;right:14px;width:40px;height:40px;background:rgba(255,255,255,.92);border-radius:50%;font-size:18px;display:flex;align-items:center;justify-content:center;text-decoration:none;color:#444;box-shadow:0 2px 8px rgba(0,0,0,.15);z-index:2;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer;line-height:1}',
      'a.xcl:hover{background:#fff;color:#111}',
      'footer{text-align:center;padding:28px;color:#aaa;font-size:12px;border-top:1px solid #e8e4dc;margin-top:4px}',
      'footer b{color:#9a7b3f}',
      '@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr);gap:12px}main{padding:18px 14px}header{padding:16px 18px}.hd{display:none}.sw input{width:160px}}',
    ].join('\n')

    // JS solo como enhancement — la interactividad base funciona sin JS via :target
    const js = [
      'function fc(q){',
      '  q=q.toLowerCase().trim();var t=0;',
      '  document.querySelectorAll("a.card").forEach(function(c){',
      '    var s=!q||c.dataset.name.toLowerCase().includes(q)||c.dataset.brand.toLowerCase().includes(q);',
      '    c.style.display=s?"":"none";if(s)t++;',
      '  });',
      '  var el=document.getElementById("cnt");',
      '  if(el)el.textContent=t+" producto"+(t!==1?"s":"")+" disponible"+(t!==1?"s":"");',
      '}',
      'document.addEventListener("keydown",function(e){',
      '  if(e.key==="Escape"&&location.hash.startsWith("#p-"))location.hash="#top";',
      '});',
    ].join('\n')

    const html = '<!DOCTYPE html>\n' +
      '<html lang="es">\n<head>\n' +
      '<meta charset="UTF-8"/>\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"/>\n' +
      '<title>' + escHtml(businessName) + ' — Catálogo de Fragancias</title>\n' +
      '<style>\n' + css + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<div id="top"></div>\n' +
      '<header>\n' +
      '  <div class="lb">' + logoHtml + '</div>\n' +
      '  <div class="ht">\n' +
      '    <div class="hn">' + escHtml(businessName) + '</div>\n' +
      '    <div class="hs">Catálogo de Fragancias' + (businessPhone ? ' &middot; ' + escHtml(businessPhone) : '') + '</div>\n' +
      '  </div>\n' +
      '  <span class="hd">' + date + '</span>\n' +
      '</header>\n' +
      '<main>\n' +
      '  <div class="bar">\n' +
      '    <span class="cnt" id="cnt">' + n + ' producto' + (n !== 1 ? 's' : '') + ' disponible' + (n !== 1 ? 's' : '') + '</span>\n' +
      '    <div class="sw">\n' +
      '      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>\n' +
      '      <input type="text" placeholder="Buscar perfume o marca..." oninput="fc(this.value)" onkeyup="fc(this.value)" />\n' +
      '    </div>\n' +
      '  </div>\n' +
      '  <div class="grid" id="grid">\n' + productCards.join('\n') + '\n  </div>\n' +
      '</main>\n' +
      '<footer><b>' + escHtml(businessName) + '</b> &middot; ' + date + '</footer>\n' +
      productModals.join('\n') + '\n' +
      '<script>\n' + js + '\n</script>\n' +
      '</body>\n</html>'

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = escHtml(businessName).replace(/[^a-zA-Z0-9]/g, '-') + '-catalogo.html'
    a.click()
    URL.revokeObjectURL(url)
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

      {/* CATX-06: ficha individual */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}
