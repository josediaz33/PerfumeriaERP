import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ChevronRight, Package, User, ShoppingBag, CheckCircle, AlertTriangle, ArrowRight, Truck, Pencil, X } from 'lucide-react'
import { db } from '../db/db'
import { fmtPYG, today, nowISO } from '../lib/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import type { SourcingRequest, SourcingLine, SupplierQuote } from '../db/types'
import type { SelectHTMLAttributes } from 'react'

function SelectField({ label, children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all ${className}`} {...props}>
        {children}
      </select>
    </div>
  )
}

// ─── Tipos locales ─────────────────────────────────────────────────────────────

type Tab = 'lines' | 'quotes' | 'compare'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', quoting: 'Cotizando', decided: 'Decidido', ordered: 'Ordenado', closed: 'Cerrado',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  quoting: 'bg-blue-100 text-blue-700',
  decided: 'bg-violet-100 text-violet-700',
  ordered: 'bg-amber-100 text-amber-700',
  closed: 'bg-green-100 text-green-700',
}

const MARGIN_ALERT_PCT = 20

// ─── Helpers de cálculo ────────────────────────────────────────────────────────

interface LineAnalysis {
  line: SourcingLine
  priceUSD: number | null
  subtotalUSD: number | null
  fletePYG: number
  costoPYG: number | null
  marginPct: number | null
}

interface QuoteAnalysis {
  quote: SupplierQuote
  supplierName: string
  lines: LineAnalysis[]
  totalCostPYG: number
  allLinesCovered: boolean
}

function analyzeQuote(
  quote: SupplierQuote,
  lines: SourcingLine[],
  supplierName: string,
): QuoteAnalysis {
  const totalSubtotalUSD = quote.lineItems.reduce((s, li) => {
    const l = lines.find(ln => ln.id === li.lineId)
    return s + li.priceUSD * (l?.quantity ?? 1)
  }, 0)

  const analysisLines: LineAnalysis[] = lines.map(line => {
    const item = quote.lineItems.find(li => li.lineId === line.id)
    if (!item) return { line, priceUSD: null, subtotalUSD: null, fletePYG: 0, costoPYG: null, marginPct: null }

    const subtotalUSD = item.priceUSD * line.quantity
    const fletePYG = totalSubtotalUSD > 0
      ? quote.estimatedShippingPYG * (subtotalUSD / totalSubtotalUSD)
      : 0
    const costoPYG = subtotalUSD * quote.exchangeRate + fletePYG

    let marginPct: number | null = null
    if (line.destination === 'client' && line.expectedSalePricePYG) {
      const revenue = line.expectedSalePricePYG * line.quantity
      marginPct = revenue > 0 ? Math.round(((revenue - costoPYG) / revenue) * 100) : null
    }

    return { line, priceUSD: item.priceUSD, subtotalUSD, fletePYG, costoPYG, marginPct }
  })

  const totalCostPYG = analysisLines.reduce((s, a) => s + (a.costoPYG ?? 0), 0)
  const allLinesCovered = lines.every(l => analysisLines.find(a => a.line.id === l.id)?.priceUSD !== null)

  return { quote, supplierName, lines: analysisLines, totalCostPYG, allLinesCovered }
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function Sourcing() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('lines')

  // ── Formulario nueva solicitud ──
  const [newNotes, setNewNotes] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)

  // ── Formulario nueva/editada línea ──
  const [editingLineId, setEditingLineId] = useState<number | null>(null)
  const [lineProductId, setLineProductId] = useState('0')
  const [lineFreeText, setLineFreeText] = useState('')
  const [lineBrand, setLineBrand] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [lineDest, setLineDest] = useState<'stock' | 'client'>('stock')
  const [lineCustomerId, setLineCustomerId] = useState('0')
  const [lineExpPrice, setLineExpPrice] = useState('')

  // ── Formulario nueva/editada cotización ──
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null)
  const [quoteSupplierId, setQuoteSupplierId] = useState('0')
  const [quoteShipping, setQuoteShipping] = useState('')
  const [quoteRate, setQuoteRate] = useState('')
  const [quotePrices, setQuotePrices] = useState<Record<number, string>>({})

  // ── Data ──
  const requests = useLiveQuery(() =>
    db.sourcingRequests.orderBy('createdAt').reverse().toArray(), [])
  const selected = requests?.find(r => r.id === selectedId) ?? null

  const lines = useLiveQuery(
    () => selectedId ? db.sourcingLines.where('requestId').equals(selectedId).toArray() : Promise.resolve([] as SourcingLine[]),
    [selectedId], [] as SourcingLine[]
  )
  const quotes = useLiveQuery(
    () => selectedId ? db.supplierQuotes.where('requestId').equals(selectedId).toArray() : Promise.resolve([] as SupplierQuote[]),
    [selectedId], [] as SupplierQuote[]
  )
  const products = useLiveQuery(() => db.products.toArray().then(arr => arr.sort((a, b) => a.name.localeCompare(b.name))), [])
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])
  const rate = useLiveQuery(() =>
    db.config.where('key').equals('usd_pyg_rate').first().then(r => r?.value ?? '7500'), [])

  // ─── Acciones: solicitudes ─────────────────────────────────────────────────

  async function handleNewRequest() {
    const id = await db.sourcingRequests.add({
      status: 'draft', notes: newNotes || undefined, createdAt: nowISO(), updatedAt: nowISO(),
    })
    setSelectedId(id as number)
    setTab('lines')
    setNewNotes('')
    setShowNewForm(false)
  }

  async function handleDeleteRequest() {
    if (!selected) return
    if (!confirm(`¿Eliminar la solicitud #${selected.id} y todas sus líneas y cotizaciones?`)) return
    await db.sourcingLines.where('requestId').equals(selected.id!).delete()
    await db.supplierQuotes.where('requestId').equals(selected.id!).delete()
    await db.sourcingRequests.delete(selected.id!)
    setSelectedId(null)
  }

  async function handleStatusChange(status: SourcingRequest['status']) {
    if (!selected) return
    await db.sourcingRequests.update(selected.id!, { status, updatedAt: nowISO() })
  }

  // ─── Acciones: líneas ─────────────────────────────────────────────────────

  function resetLineForm() {
    setEditingLineId(null)
    setLineProductId('0'); setLineFreeText(''); setLineBrand('')
    setLineQty('1'); setLineDest('stock'); setLineCustomerId('0'); setLineExpPrice('')
  }

  function handleEditLine(l: SourcingLine) {
    setEditingLineId(l.id!)
    setLineProductId(l.isFreeText ? '0' : String(l.productId ?? '0'))
    setLineFreeText(l.isFreeText ? l.productName : '')
    setLineBrand(l.isFreeText ? l.brand : '')
    setLineQty(String(l.quantity))
    setLineDest(l.destination)
    setLineCustomerId(String(l.customerId ?? '0'))
    setLineExpPrice(l.expectedSalePricePYG ? String(l.expectedSalePricePYG) : '')
  }

  async function handleSaveLine() {
    if (!selectedId) return
    const isFree = lineProductId === '0'
    if (isFree && !lineFreeText.trim()) return
    const prod = products?.find(p => p.id === parseInt(lineProductId))
    const lineData = {
      productId: prod?.id,
      productName: prod ? prod.name : lineFreeText.trim(),
      brand: prod ? prod.brand : lineBrand.trim(),
      isFreeText: isFree,
      quantity: parseInt(lineQty) || 1,
      destination: lineDest,
      customerId: lineDest === 'client' && lineCustomerId !== '0' ? parseInt(lineCustomerId) : undefined,
      customerName: lineDest === 'client' && lineCustomerId !== '0'
        ? customers?.find(c => c.id === parseInt(lineCustomerId))?.name
        : undefined,
      expectedSalePricePYG: lineDest === 'client' && lineExpPrice
        ? (parseFloat(lineExpPrice) || undefined)
        : undefined,
    }
    if (editingLineId !== null) {
      await db.sourcingLines.update(editingLineId, lineData)
    } else {
      await db.sourcingLines.add({ requestId: selectedId, ...lineData })
      if (selected?.status === 'draft') await db.sourcingRequests.update(selectedId, { status: 'quoting', updatedAt: nowISO() })
    }
    resetLineForm()
  }

  async function handleDeleteLine(id: number) {
    if (editingLineId === id) resetLineForm()
    await db.sourcingLines.delete(id)
    // Limpiar precios de ese line en todas las cotizaciones
    const affectedQuotes = await db.supplierQuotes.where('requestId').equals(selectedId!).toArray()
    for (const q of affectedQuotes) {
      await db.supplierQuotes.update(q.id!, {
        lineItems: q.lineItems.filter(li => li.lineId !== id),
        updatedAt: nowISO(),
      })
    }
  }

  // ─── Acciones: cotizaciones ───────────────────────────────────────────────

  function resetQuoteForm() {
    setEditingQuoteId(null)
    setQuoteSupplierId('0'); setQuoteShipping(''); setQuoteRate(rate ?? '7500'); setQuotePrices({})
  }

  function handleEditQuote(q: SupplierQuote) {
    setEditingQuoteId(q.id!)
    setQuoteSupplierId(String(q.supplierId))
    setQuoteShipping(String(q.estimatedShippingPYG))
    setQuoteRate(String(q.exchangeRate))
    const prices: Record<number, string> = {}
    q.lineItems.forEach(li => { prices[li.lineId] = String(li.priceUSD) })
    setQuotePrices(prices)
  }

  async function handleSaveQuote() {
    if (!selectedId || quoteSupplierId === '0') return
    const lineItems = (lines ?? [])
      .filter(l => l.id !== undefined && quotePrices[l.id!] && parseFloat(quotePrices[l.id!]) > 0)
      .map(l => ({ lineId: l.id!, priceUSD: parseFloat(quotePrices[l.id!]) }))

    if (editingQuoteId !== null) {
      await db.supplierQuotes.update(editingQuoteId, {
        supplierId: parseInt(quoteSupplierId),
        estimatedShippingPYG: parseFloat(quoteShipping) || 0,
        exchangeRate: parseFloat(quoteRate) || parseFloat(rate ?? '7500'),
        lineItems,
        updatedAt: nowISO(),
      })
    } else {
      await db.supplierQuotes.add({
        requestId: selectedId,
        supplierId: parseInt(quoteSupplierId),
        estimatedShippingPYG: parseFloat(quoteShipping) || 0,
        exchangeRate: parseFloat(quoteRate) || parseFloat(rate ?? '7500'),
        lineItems,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    }
    resetQuoteForm()
  }

  async function handleDeleteQuote(id: number) {
    if (editingQuoteId === id) resetQuoteForm()
    await db.supplierQuotes.delete(id)
  }

  // ─── Convertir a Order ────────────────────────────────────────────────────

  async function handleConvertToOrder(qa: QuoteAnalysis) {
    if (!selected || !lines) return
    const conf = confirm(`¿Crear orden de compra con ${qa.supplierName} por ${fmtPYG(Math.round(qa.totalCostPYG))} (incluye flete)?`)
    if (!conf) return

    const orderItems = lines
      .filter(l => {
        const la = qa.lines.find(a => a.line.id === l.id)
        return la?.priceUSD !== null && la?.priceUSD !== undefined && la.priceUSD > 0
      })
      .map(l => {
        const la = qa.lines.find(a => a.line.id === l.id)!
        const prod = products?.find(p => p.id === l.productId)
        return {
          productName: l.productName,
          brand: l.brand,
          sizeML: prod?.sizeML ?? 0,
          quantity: l.quantity,
          unitPriceUSD: la.priceUSD!,
        }
      })

    const subtotalUSD = orderItems.reduce((s, i) => s + i.unitPriceUSD * i.quantity, 0)
    const shippingUSD = qa.quote.estimatedShippingPYG / qa.quote.exchangeRate
    const totalUSD = subtotalUSD + shippingUSD
    const now = nowISO()
    const exchangeRate = qa.quote.exchangeRate

    await db.transaction('rw', [db.orders, db.products, db.sourcingRequests], async () => {
      // Pre-crear productos en inventario con stock 0 si no existen (igual que Proveedores)
      for (const item of orderItems) {
        const exists = (products ?? []).find(
          p => p.name.toLowerCase() === item.productName.toLowerCase() &&
               p.brand.toLowerCase() === item.brand.toLowerCase()
        )
        if (!exists) {
          await db.products.add({
            name: item.productName,
            brand: item.brand,
            olfactiveFamily: 'other',
            concentration: 'EDP',
            sizeML: item.sizeML,
            costUSD: item.unitPriceUSD,
            exchangeRateUsed: exchangeRate,
            costPYG: Math.round(item.unitPriceUSD * exchangeRate),
            sellingPricePYG: 0,
            stockSealed: 0, stockOpenML: 0,
            minStock: 1, type: 'sealed',
            createdAt: now, updatedAt: now,
          })
        }
      }

      await db.orders.add({
        supplierId: qa.quote.supplierId,
        items: orderItems,
        totalUSD,
        exchangeRate,
        totalPYG: Math.round(subtotalUSD * exchangeRate + qa.quote.estimatedShippingPYG),
        shippingTotalPYG: Math.round(qa.quote.estimatedShippingPYG),
        status: 'pending',
        orderDate: today(),
        notes: `Solicitud de cotización #${selected.id}${lines.some(l => l.destination === 'client') ? ' — contiene líneas para clientes' : ''}`,
        createdAt: now,
      })

      await db.sourcingRequests.update(selected.id!, {
        status: 'ordered',
        chosenQuoteId: qa.quote.id,
        updatedAt: now,
      })
    })
  }

  // ─── Cálculo de análisis comparativo ─────────────────────────────────────

  const analyses: QuoteAnalysis[] = (quotes ?? []).map(q => {
    const sup = suppliers?.find(s => s.id === q.supplierId)
    return analyzeQuote(q, lines ?? [], sup?.name ?? `Proveedor #${q.supplierId}`)
  })

  const bestSingleSupplier = analyses.length > 0
    ? analyses.reduce((best, a) => a.totalCostPYG < best.totalCostPYG ? a : best, analyses[0])
    : null

  // Mejor por línea (mix óptimo)
  const optimalMixCost = (lines ?? []).reduce((total, line) => {
    const best = analyses
      .map(a => a.lines.find(la => la.line.id === line.id))
      .filter(la => la?.costoPYG !== null && la?.costoPYG !== undefined)
      .sort((a, b) => (a!.costoPYG ?? 0) - (b!.costoPYG ?? 0))[0]
    return total + (best?.costoPYG ?? 0)
  }, 0)

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Comparador de proveedores"
        subtitle="Cotizá los mismos productos con varios proveedores y decidí de dónde conviene traer"
        action={
          <Button icon={<Plus size={15} />} onClick={() => setShowNewForm(true)}>
            Nueva solicitud
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* ── Lista de solicitudes ── */}
        <div className="w-72 shrink-0 space-y-2">
          {showNewForm && (
            <Card>
              <CardBody className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Nueva solicitud</p>
                <Input
                  label="Notas (opcional)"
                  placeholder="Ej: Reposición junio + pedidos cliente"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleNewRequest}>Crear</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setShowNewForm(false)}>Cancelar</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {!requests?.length && !showNewForm && (
            <p className="text-sm text-gray-400 text-center py-8">Sin solicitudes aún</p>
          )}

          {requests?.map(r => (
            <button
              key={r.id}
              onClick={() => { setSelectedId(r.id!); setTab('lines') }}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                r.id === selectedId
                  ? 'border-violet-300 bg-violet-50'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500">#{r.id}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              {r.notes && <p className="text-sm text-gray-700 truncate">{r.notes}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{r.createdAt.slice(0, 10)}</p>
            </button>
          ))}
        </div>

        {/* ── Panel de detalle ── */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">
            Seleccioná una solicitud o creá una nueva
          </div>
        ) : (
          <div className="flex-1 space-y-4 min-w-0">
            {/* Header del detalle */}
            <Card>
              <CardBody>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-700">Solicitud #{selected.id}</span>
                  {selected.notes && <span className="text-sm text-gray-500">{selected.notes}</span>}
                  <div className="ml-auto flex items-center gap-2">
                    <SelectField
                      value={selected.status}
                      onChange={e => handleStatusChange(e.target.value as SourcingRequest['status'])}
                      className="text-xs py-1"
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </SelectField>
                    <button
                      onClick={handleDeleteRequest}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {([['lines', 'Líneas'], ['quotes', 'Cotizaciones'], ['compare', 'Comparar']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {t === 'lines' && lines?.length ? <span className="ml-1.5 text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">{lines.length}</span> : null}
                  {t === 'quotes' && quotes?.length ? <span className="ml-1.5 text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">{quotes.length}</span> : null}
                </button>
              ))}
            </div>

            {/* ── TAB: LÍNEAS ── */}
            {tab === 'lines' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-gray-700">
                        {editingLineId ? 'Editar línea' : 'Agregar línea'}
                      </h3>
                      {editingLineId && (
                        <button onClick={resetLineForm} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                          <X size={12} /> Cancelar
                        </button>
                      )}
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField label="Producto del inventario" value={lineProductId} onChange={e => setLineProductId(e.target.value)}>
                        <option value="0">— Descripción libre —</option>
                        {products?.map(p => <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>)}
                      </SelectField>
                      {lineProductId === '0' ? (
                        <>
                          <Input label="Descripción" placeholder="Nombre del producto" value={lineFreeText} onChange={e => setLineFreeText(e.target.value)} />
                          <Input label="Marca" placeholder="Marca" value={lineBrand} onChange={e => setLineBrand(e.target.value)} />
                        </>
                      ) : null}
                      <Input label="Cantidad" type="number" min="1" value={lineQty} onChange={e => setLineQty(e.target.value)} />
                      <SelectField label="Destino" value={lineDest} onChange={e => setLineDest(e.target.value as 'stock' | 'client')}>
                        <option value="stock">Stock (reposición)</option>
                        <option value="client">Cliente (pedido específico)</option>
                      </SelectField>
                      {lineDest === 'client' && (
                        <>
                          <SelectField label="Cliente" value={lineCustomerId} onChange={e => setLineCustomerId(e.target.value)}>
                            <option value="0">— Sin especificar —</option>
                            {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </SelectField>
                          <Input label="Precio de venta esperado (Gs.)" type="number" placeholder="0" value={lineExpPrice} onChange={e => setLineExpPrice(e.target.value)} />
                        </>
                      )}
                    </div>
                    <Button icon={<Plus size={14} />} onClick={handleSaveLine}>
                      {editingLineId ? 'Actualizar línea' : 'Agregar línea'}
                    </Button>
                  </CardBody>
                </Card>

                {lines?.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Sin líneas. Agregá los productos que querés cotizar.</p>
                )}

                {lines && lines.length > 0 && (
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Producto</th>
                            <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">Cant.</th>
                            <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500">Destino</th>
                            <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500">P. venta esp.</th>
                            <th className="py-2.5 px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map(l => (
                            <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2.5 px-4">
                                <p className="font-medium text-gray-800">{l.productName}</p>
                                {l.brand && <p className="text-xs text-gray-400">{l.brand}</p>}
                                {l.isFreeText && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Libre</span>}
                              </td>
                              <td className="py-2.5 px-3 text-center text-gray-700">{l.quantity}</td>
                              <td className="py-2.5 px-3 text-center">
                                {l.destination === 'stock'
                                  ? <span className="flex items-center justify-center gap-1 text-xs text-blue-600"><Package size={11} />Stock</span>
                                  : <span className="flex items-center justify-center gap-1 text-xs text-violet-600"><User size={11} />{l.customerName ?? 'Cliente'}</span>
                                }
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600 text-xs">
                                {l.expectedSalePricePYG ? fmtPYG(l.expectedSalePricePYG) : '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleEditLine(l)} className={`p-1 transition-colors ${editingLineId === l.id ? 'text-violet-500' : 'text-gray-300 hover:text-violet-500'}`}>
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => handleDeleteLine(l.id!)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── TAB: COTIZACIONES ── */}
            {tab === 'quotes' && (
              <div className="space-y-4">
                {(!lines || lines.length === 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                    Primero agregá líneas de producto en la pestaña Líneas.
                  </div>
                )}

                {lines && lines.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-gray-700">
                          {editingQuoteId ? 'Editar oferta' : 'Cargar oferta de proveedor'}
                        </h3>
                        {editingQuoteId && (
                          <button onClick={resetQuoteForm} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={12} /> Cancelar
                          </button>
                        )}
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <SelectField label="Proveedor" value={quoteSupplierId} onChange={e => setQuoteSupplierId(e.target.value)}>
                          <option value="0">— Seleccionar —</option>
                          {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </SelectField>
                        <Input label="Flete estimado (Gs.)" type="number" placeholder="0" value={quoteShipping} onChange={e => setQuoteShipping(e.target.value)} />
                        <Input label="Cotización USD/PYG" type="number" placeholder={rate} value={quoteRate || rate || ''} onChange={e => setQuoteRate(e.target.value)} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Precio por línea (USD/unidad)</p>
                        <div className="space-y-2">
                          {lines.map(l => (
                            <div key={l.id} className="flex items-center gap-3">
                              <div className="flex-1 text-sm text-gray-700">
                                <span className="font-medium">{l.productName}</span>
                                {l.brand ? ` — ${l.brand}` : ''} × {l.quantity}
                              </div>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={quotePrices[l.id!] ?? ''}
                                onChange={e => setQuotePrices(p => ({ ...p, [l.id!]: e.target.value }))}
                                className="w-32 text-right"
                              />
                              <span className="text-xs text-gray-400 w-8">USD</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button icon={<Plus size={14} />} onClick={handleSaveQuote} disabled={quoteSupplierId === '0'}>
                        {editingQuoteId ? 'Actualizar oferta' : 'Guardar oferta'}
                      </Button>
                    </CardBody>
                  </Card>
                )}

                {quotes && quotes.length > 0 && (
                  <div className="space-y-3">
                    {quotes.map(q => {
                      const sup = suppliers?.find(s => s.id === q.supplierId)
                      const totalUSD = q.lineItems.reduce((s, li) => {
                        const l = lines?.find(ln => ln.id === li.lineId)
                        return s + li.priceUSD * (l?.quantity ?? 1)
                      }, 0)
                      return (
                        <Card key={q.id}>
                          <CardBody>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-gray-800">{sup?.name ?? `Proveedor #${q.supplierId}`}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Flete: {fmtPYG(q.estimatedShippingPYG)} · Cotización: {parseInt(q.exchangeRate.toString()).toLocaleString('es-PY')} Gs/USD
                                </p>
                                <p className="text-xs text-gray-500">
                                  Subtotal productos: USD {totalUSD.toFixed(2)} · Total c/flete: {fmtPYG(Math.round(totalUSD * q.exchangeRate + q.estimatedShippingPYG))}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {q.lineItems.map(li => {
                                    const l = lines?.find(ln => ln.id === li.lineId)
                                    return l ? (
                                      <span key={li.lineId} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                        {l.productName}: USD {li.priceUSD.toFixed(2)}
                                      </span>
                                    ) : null
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleEditQuote(q)} className={`p-1 transition-colors ${editingQuoteId === q.id ? 'text-violet-500' : 'text-gray-300 hover:text-violet-500'}`}>
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDeleteQuote(q.id!)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: COMPARAR ── */}
            {tab === 'compare' && (
              <div className="space-y-5">
                {analyses.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Cargá al menos una cotización para comparar.</p>
                )}

                {analyses.length > 0 && lines && lines.length > 0 && (
                  <>
                    {/* Tabla comparativa */}
                    <Card>
                      <CardHeader>
                        <h3 className="font-semibold text-gray-800">Tabla comparativa — Costo puesto (Gs.)</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Precio + flete prorrateado × cotización</p>
                      </CardHeader>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 min-w-40">Producto</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Cant.</th>
                              {analyses.map(a => (
                                <th key={a.quote.id} className="text-center py-2 px-3 text-xs font-semibold text-gray-700 min-w-36">
                                  {a.supplierName}
                                  <span className="block font-normal text-gray-400">Flete {fmtPYG(a.quote.estimatedShippingPYG)}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map(line => {
                              const costosLine = analyses.map(a => a.lines.find(la => la.line.id === line.id)?.costoPYG ?? null)
                              const minCosto = Math.min(...costosLine.filter(c => c !== null) as number[])
                              return (
                                <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="py-2.5 px-4">
                                    <p className="font-medium text-gray-800 text-xs">{line.productName}</p>
                                    {line.brand && <p className="text-[10px] text-gray-400">{line.brand}</p>}
                                    <div className="flex gap-1 mt-0.5">
                                      {line.destination === 'client'
                                        ? <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 rounded-full flex items-center gap-0.5"><User size={9} />{line.customerName ?? 'Cliente'}</span>
                                        : <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 rounded-full flex items-center gap-0.5"><Package size={9} />Stock</span>
                                      }
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-gray-600 text-xs">{line.quantity}</td>
                                  {analyses.map(a => {
                                    const la = a.lines.find(l => l.line.id === line.id)
                                    const isBest = la?.costoPYG !== null && la?.costoPYG === minCosto && costosLine.filter(c => c !== null).length > 1
                                    const hasMarginAlert = la?.marginPct !== null && la?.marginPct !== undefined && la.marginPct < MARGIN_ALERT_PCT
                                    return (
                                      <td key={a.quote.id} className={`py-2.5 px-3 text-center text-xs ${isBest ? 'bg-green-50' : ''}`}>
                                        {la?.costoPYG !== null && la?.costoPYG !== undefined ? (
                                          <div>
                                            <p className={`font-semibold ${isBest ? 'text-green-700' : 'text-gray-700'}`}>
                                              {fmtPYG(Math.round(la.costoPYG))}
                                            </p>
                                            <p className="text-gray-400">USD {la.priceUSD?.toFixed(2)}/u</p>
                                            {isBest && <span className="text-[10px] text-green-600 font-bold">✓ Mejor</span>}
                                            {hasMarginAlert && (
                                              <span className="flex items-center justify-center gap-0.5 text-[10px] text-red-500 font-semibold mt-0.5">
                                                <AlertTriangle size={9} /> Margen {la.marginPct}%
                                              </span>
                                            )}
                                            {!hasMarginAlert && la.marginPct !== null && la.marginPct !== undefined && (
                                              <span className="text-[10px] text-gray-400">Margen {la.marginPct}%</span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-300">—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                            {/* Fila de totales */}
                            <tr className="bg-gray-50 border-t-2 border-gray-200">
                              <td className="py-3 px-4 text-xs font-bold text-gray-700" colSpan={2}>Total costo puesto</td>
                              {analyses.map(a => (
                                <td key={a.quote.id} className={`py-3 px-3 text-center ${a === bestSingleSupplier ? 'bg-green-50' : ''}`}>
                                  <p className={`font-bold text-sm ${a === bestSingleSupplier ? 'text-green-700' : 'text-gray-800'}`}>
                                    {fmtPYG(Math.round(a.totalCostPYG))}
                                  </p>
                                  {a === bestSingleSupplier && <span className="text-[10px] text-green-600 font-bold">✓ Mejor total</span>}
                                  {!a.allLinesCovered && <span className="text-[10px] text-amber-500">Cubre parcialmente</span>}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    {/* Doble vista */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Escenario A: mejor proveedor único */}
                      {bestSingleSupplier && (
                        <Card>
                          <CardHeader>
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                              <Truck size={15} className="text-violet-600" />
                              Escenario A — Proveedor único
                            </h3>
                          </CardHeader>
                          <CardBody className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-900">{bestSingleSupplier.supplierName}</p>
                                <p className="text-xs text-gray-500">1 envío · Flete {fmtPYG(bestSingleSupplier.quote.estimatedShippingPYG)}</p>
                              </div>
                              <p className="text-xl font-bold text-violet-700">{fmtPYG(Math.round(bestSingleSupplier.totalCostPYG))}</p>
                            </div>
                            {!bestSingleSupplier.allLinesCovered && (
                              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-700 flex items-start gap-1.5">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                No cotiza todas las líneas. Revisá las celdas vacías.
                              </div>
                            )}
                            <Button
                              className="w-full"
                              icon={<ArrowRight size={14} />}
                              onClick={() => handleConvertToOrder(bestSingleSupplier)}
                            >
                              Crear orden de compra
                            </Button>
                          </CardBody>
                        </Card>
                      )}

                      {/* Escenario B: mix óptimo */}
                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <ShoppingBag size={15} className="text-violet-600" />
                            Escenario B — Mix óptimo
                          </h3>
                        </CardHeader>
                        <CardBody className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500">Mejor precio por ítem</p>
                              <p className="text-xs text-gray-400">Implica {analyses.length} envíos separados</p>
                            </div>
                            <p className="text-xl font-bold text-emerald-700">{fmtPYG(Math.round(optimalMixCost))}</p>
                          </div>
                          {bestSingleSupplier && optimalMixCost < bestSingleSupplier.totalCostPYG && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-xs text-emerald-700">
                              Ahorro teórico vs. proveedor único: {fmtPYG(Math.round(bestSingleSupplier.totalCostPYG - optimalMixCost))}
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {lines.map(line => {
                              const bestForLine = analyses
                                .map(a => ({ a, la: a.lines.find(la => la.line.id === line.id) }))
                                .filter(x => x.la?.costoPYG !== null && x.la?.costoPYG !== undefined)
                                .sort((x, y) => (x.la!.costoPYG ?? 0) - (y.la!.costoPYG ?? 0))[0]
                              return bestForLine ? (
                                <div key={line.id} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600 truncate max-w-32">{line.productName}</span>
                                  <span className="flex items-center gap-1 text-gray-500">
                                    <ChevronRight size={10} />
                                    <span className="font-medium text-gray-800">{bestForLine.a.supplierName}</span>
                                    <span className="text-violet-600 font-semibold">{fmtPYG(Math.round(bestForLine.la!.costoPYG!))}</span>
                                  </span>
                                </div>
                              ) : null
                            })}
                          </div>
                          <p className="text-[10px] text-gray-400 text-center">
                            Este escenario no genera una orden. Creá una orden por proveedor desde la tabla.
                          </p>
                        </CardBody>
                      </Card>
                    </div>

                    {/* Convertir cualquier proveedor */}
                    {analyses.length > 1 && (
                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <CheckCircle size={15} className="text-violet-600" />
                            Convertir a orden de compra
                          </h3>
                        </CardHeader>
                        <CardBody>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {analyses.map(a => (
                              <button
                                key={a.quote.id}
                                onClick={() => handleConvertToOrder(a)}
                                className="text-left p-3 border border-gray-100 rounded-xl hover:border-violet-300 hover:bg-violet-50 transition-colors group"
                              >
                                <p className="font-semibold text-gray-800 text-sm group-hover:text-violet-700">{a.supplierName}</p>
                                <p className="text-xs text-gray-500">{fmtPYG(Math.round(a.totalCostPYG))}</p>
                                {!a.allLinesCovered && <p className="text-[10px] text-amber-500 mt-0.5">Cubre parcialmente</p>}
                                <span className="text-xs text-violet-600 font-medium mt-1 flex items-center gap-1">
                                  Crear orden <ArrowRight size={11} />
                                </span>
                              </button>
                            ))}
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
