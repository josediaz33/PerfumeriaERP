import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, FileText, Download, X, Edit2, Trash2, Package, Zap, Tag } from 'lucide-react'
import { db } from '../db/db'
import { blobToBase64 } from '../lib/images'
import type { BudgetStatus } from '../db/types'
import { fmtPYG, fmtDate, today, nowISO } from '../lib/format'
import { upsertCustomer } from '../lib/customers'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { CustomerAutocomplete } from '../components/ui/CustomerAutocomplete'
import { Badge } from '../components/ui/Badge'

const statusColors: Record<BudgetStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  draft: 'gray', sent: 'blue', accepted: 'green', rejected: 'red',
}
const statusLabels: Record<BudgetStatus, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado',
}

interface BudgetLineItem {
  productId: string
  description: string
  type: 'sealed' | 'tester' | 'decant' | 'partial' | 'custom'
  sizeML: string
  quantity: string
  unitPrice: string
  descuentoPct: string
  sobrePedido: boolean
  costoEstimado: string
}

function findSupplyForSize(supplies: import('../db/types').Supply[], sizeML: number) {
  return supplies.find(s => s.sizeML === sizeML)
    ?? supplies.find(s => (s.type as string) === `${sizeML}ml`)
}

export function Presupuestos() {
  const navigate = useNavigate()
  const products = useLiveQuery(() => db.products.toArray()) ?? []
  const budgets = useLiveQuery(() => db.budgets.orderBy('createdAt').reverse().toArray()) ?? []
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray()) ?? []
  const supplies = useLiveQuery(() => db.supplies.toArray()) ?? []
  const localOrderIds = useLiveQuery(async () => {
    const orders = await db.localOrders.toArray()
    return new Set(orders.map(o => o.id!))
  }) ?? new Set<number>()

  const [showNew, setShowNew] = useState(false)
  const [showDetail, setShowDetail] = useState<number | null>(null)
  const [editBudgetId, setEditBudgetId] = useState<number | null>(null)
  const [showQuickLoad, setShowQuickLoad] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')
  const [quickSelections, setQuickSelections] = useState<Record<number, string>>({})
  const [quickDiscount, setQuickDiscount] = useState('0')

  const emptyLine = (discPct = '0'): BudgetLineItem => ({
    productId: '0', description: '', type: 'sealed', sizeML: '5',
    quantity: '1', unitPrice: '', descuentoPct: discPct, sobrePedido: false, costoEstimado: '',
  })
  const emptyForm = {
    customerName: '', customerPhone: '', discount: '0',
    esMayorista: false, descuentoMayoristaBase: '0',
    notes: '', validUntil: '',
    items: [emptyLine()] as BudgetLineItem[],
  }
  const [form, setForm] = useState(emptyForm)

  // Cálculos: subtotal bruto → descuentos por línea → subtotal neto → descuento global → total
  const subtotalBruto = form.items.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 0), 0)
  const subtotalNeto = form.items.reduce((s, i) => {
    const gross = (parseFloat(i.unitPrice) || 0) * (parseInt(i.quantity) || 0)
    return s + gross * (1 - (parseFloat(i.descuentoPct) || 0) / 100)
  }, 0)
  const descLineaTotal = subtotalBruto - subtotalNeto
  const descGlobalAmt = subtotalNeto * (parseFloat(form.discount) / 100 || 0)
  const total = subtotalNeto - descGlobalAmt

  // Análisis de rentabilidad (solo interno)
  const profitLines = form.items.map(item => {
    const p = products.find(x => String(x.id) === item.productId)
    const qty = parseInt(item.quantity) || 1
    const grossPrice = parseFloat(item.unitPrice) || 0
    const discPct = parseFloat(item.descuentoPct) || 0
    const effectivePrice = grossPrice * (1 - discPct / 100)
    const sizeML = parseInt(item.sizeML) || 5
    let unitCost = 0
    let costDetail = ''

    if (item.sobrePedido && item.costoEstimado) {
      unitCost = parseFloat(item.costoEstimado) || 0
      costDetail = 'Costo estimado manual'
    } else if (p && item.type !== 'custom') {
      if (item.type === 'sealed' || item.type === 'tester') {
        unitCost = p.costPYG
        costDetail = `CPP: ${fmtPYG(Math.round(p.costPYG))}`
      } else if (item.type === 'decant') {
        // TODO(PROVISIONAL-CATEGORY): sizeML ?? 1 para evitar división por undefined en no-fragancias
        const cpm = p.type === 'decant_source' ? p.costPYG : p.costPYG / (p.sizeML ?? 1)
        const supply = findSupplyForSize(supplies, sizeML)
        const supplyCost = supply?.costPYG ?? 0
        unitCost = cpm * sizeML + supplyCost
        costDetail = `${fmtPYG(Math.round(cpm * sizeML))} líquido + ${fmtPYG(supplyCost)} frasco`
      } else if (item.type === 'partial') {
        // TODO(PROVISIONAL-CATEGORY): sizeML ?? 1 para evitar división por undefined en no-fragancias
        const cpm = p.type === 'decant_source' ? p.costPYG : p.costPYG / (p.sizeML ?? 1)
        unitCost = cpm * sizeML
        costDetail = `CPM: ${fmtPYG(Math.round(cpm))}/ml`
      }
    }

    const totalRevenue = effectivePrice * qty
    const totalCost = unitCost * qty
    const profit = totalRevenue - totalCost
    const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0
    return { description: item.description || '—', qty, unitCost: Math.round(unitCost), effectivePrice, grossPrice, discPct, totalRevenue, totalCost: Math.round(totalCost), profit: Math.round(profit), margin, costDetail, sobrePedido: item.sobrePedido }
  }).filter(l => l.effectivePrice > 0 || l.grossPrice > 0)

  const totalRevAfterGlobal = profitLines.reduce((s, l) => s + l.totalRevenue, 0) * (1 - (parseFloat(form.discount) / 100 || 0))
  const totalCostAll = profitLines.reduce((s, l) => s + l.totalCost, 0)
  const totalProfit = totalRevAfterGlobal - totalCostAll
  const overallMargin = totalRevAfterGlobal > 0 ? Math.round((totalProfit / totalRevAfterGlobal) * 100) : 0

  function updateItem(i: number, field: keyof BudgetLineItem, val: string | boolean) {
    setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, [field]: val } : x) }))
  }

  const sealedProds = products.filter(p => p.type === 'sealed' || p.type === 'tester')
  const decantProds = products.filter(p => p.type === 'decant_source')

  function getProductsForType(t: BudgetLineItem['type']) {
    if (t === 'sealed' || t === 'tester') return sealedProds
    if (t === 'decant' || t === 'partial') return decantProds
    return []
  }

  function autoFill(i: number, productId: string, type: BudgetLineItem['type'], sizeML: string) {
    const p = products.find(x => String(x.id) === productId)
    if (!p || productId === '0') {
      setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, productId, type, sizeML } : x) }))
      return
    }
    const size = parseInt(sizeML) || 5
    const priceMap: Record<number, number | undefined> = { 3: p.price3ML, 5: p.price5ML, 10: p.price10ML, 30: p.price30ML }
    let desc = ''
    let price = ''
    if (type === 'sealed') { desc = `${p.brand} — ${p.name} ${p.sizeML}ml`; price = String(p.sellingPricePYG) }
    else if (type === 'tester') { desc = `${p.brand} — ${p.name} ${p.sizeML}ml (tester)`; price = String(p.sellingPricePYG) }
    else if (type === 'decant') { desc = `${p.brand} — ${p.name} ${size}ml (decant)`; price = priceMap[size] ? String(priceMap[size]) : '' }
    else if (type === 'partial') {
      desc = `${p.brand} — ${p.name} ${size}ml (parcial)`
      const cpm = p.type === 'decant_source' ? p.costPYG : p.costPYG / p.sizeML
      price = String(Math.round(cpm * size))
    }
    setForm(f => ({
      ...f,
      items: f.items.map((x, j) => j === i ? { ...x, productId, type, sizeML, description: desc || x.description, unitPrice: price || x.unitPrice } : x),
    }))
  }

  function handleLineTypeChange(i: number, type: BudgetLineItem['type']) {
    setForm(f => ({
      ...f,
      items: f.items.map((x, j) => j === i ? { ...x, type, productId: '0', description: '', unitPrice: '' } : x),
    }))
  }

  function openEditBudget(b: typeof budgets[0]) {
    setEditBudgetId(b.id!)
    setForm({
      customerName: b.customerName,
      customerPhone: b.customerPhone ?? '',
      discount: String(b.discount),
      esMayorista: b.esMayorista ?? false,
      descuentoMayoristaBase: String(b.descuentoMayoristaBase ?? '0'),
      notes: b.notes ?? '',
      validUntil: b.validUntil ?? '',
      items: b.items.map(i => ({
        productId: String(i.productId ?? '0'),
        description: i.description,
        type: i.type as 'sealed' | 'decant',
        sizeML: String(i.sizeML ?? '5'),
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        descuentoPct: String(i.descuentoPct ?? '0'),
        sobrePedido: i.sobrePedido ?? false,
        costoEstimado: String(i.costoEstimado ?? ''),
      })),
    })
    setShowNew(true)
  }

  function closeModal() {
    setShowNew(false)
    setEditBudgetId(null)
    setForm(emptyForm)
  }

  function buildItems() {
    return form.items
      .filter(i => i.description.trim() && i.unitPrice)
      .map(i => {
        const dbType = (i.type === 'decant' ? 'decant' : i.type === 'partial' ? 'partial' : 'sealed') as import('../db/types').SaleItemType
        const gross = parseFloat(i.unitPrice) || 0
        const qty = parseInt(i.quantity) || 1
        const discPct = parseFloat(i.descuentoPct) || 0
        return {
          productId: i.productId !== '0' ? parseInt(i.productId) : 0,
          description: i.description,
          type: dbType,
          sizeML: (i.type === 'decant' || i.type === 'partial') ? parseInt(i.sizeML) : undefined,
          quantity: qty,
          unitPrice: gross,
          subtotal: Math.round(gross * (1 - discPct / 100) * qty),
          descuentoPct: discPct || undefined,
          sobrePedido: i.sobrePedido || undefined,
          costoEstimado: (i.sobrePedido && i.costoEstimado) ? (parseFloat(i.costoEstimado) || undefined) : undefined,
        }
      })
  }

  async function handleCreate() {
    if (!form.customerName.trim()) return
    const validItems = buildItems()
    if (!validItems.length) return
    const now = nowISO()
    const customerId = await upsertCustomer(form.customerName, form.customerPhone)
    await db.budgets.add({
      customerId,
      customerName: form.customerName, customerPhone: form.customerPhone || undefined,
      items: validItems,
      subtotal: subtotalBruto,
      discount: parseFloat(form.discount) || 0,
      total: Math.round(total),
      notes: form.notes, status: 'draft',
      validUntil: form.validUntil || undefined,
      esMayorista: form.esMayorista || undefined,
      descuentoMayoristaBase: form.esMayorista ? (parseFloat(form.descuentoMayoristaBase) || undefined) : undefined,
      createdAt: now, updatedAt: now,
    })
    closeModal()
  }

  async function handleEditBudget() {
    if (!editBudgetId || !form.customerName.trim()) return
    const validItems = buildItems()
    if (!validItems.length) return
    const customerId = await upsertCustomer(form.customerName, form.customerPhone)
    await db.budgets.update(editBudgetId, {
      customerId,
      customerName: form.customerName, customerPhone: form.customerPhone || undefined,
      items: validItems,
      subtotal: subtotalBruto,
      discount: parseFloat(form.discount) || 0,
      total: Math.round(total),
      notes: form.notes, validUntil: form.validUntil || undefined,
      esMayorista: form.esMayorista || undefined,
      descuentoMayoristaBase: form.esMayorista ? (parseFloat(form.descuentoMayoristaBase) || undefined) : undefined,
      updatedAt: nowISO(),
    })
    closeModal()
  }

  async function handleDeleteBudget(id: number) {
    if (!confirm('¿Eliminar este presupuesto?')) return
    await db.budgets.delete(id)
  }

  async function convertToOrder(budget: typeof budgets[0]) {
    // sobrePedido items se incluyen aunque no tengan stock; custom sin producto se omiten
    const validItems = budget.items.filter(i => i.productId > 0 || i.sobrePedido)
    if (!validItems.length) {
      alert('Este presupuesto solo tiene ítems personalizados sin producto. No se puede convertir a pedido.')
      return
    }
    const globalDiscFactor = 1 - (budget.discount / 100)
    const orderItems = validItems.map(i => ({
      productId: i.productId || 0,
      type: i.type,
      sizeML: (i.type === 'decant' || i.type === 'partial') ? i.sizeML : undefined,
      quantity: i.quantity,
      unitPrice: Math.round(i.unitPrice * (1 - (i.descuentoPct ?? 0) / 100) * globalDiscFactor),
      sobrePedido: i.sobrePedido || undefined,
    }))
    const sobrePedidoItems = budget.items.filter(i => i.sobrePedido)
    const skipped = budget.items.length - validItems.length
    const now = nowISO()
    const customerId = await upsertCustomer(budget.customerName, budget.customerPhone ?? '')

    await db.transaction('rw', [db.localOrders, db.budgets, db.sourcingRequests, db.sourcingLines], async () => {
      const orderId = await db.localOrders.add({
        customerId,
        customerName: budget.customerName,
        customerPhone: budget.customerPhone ?? '',
        customerAddress: '',
        items: orderItems,
        supplies: [],
        shippingCost: 0,
        shippingPaidBy: 'customer',
        totalAmount: budget.total,
        totalCost: 0,
        status: 'pending',
        budgetId: budget.id!,
        notes: budget.notes ?? '',
        orderDate: today(),
        createdAt: now,
        updatedAt: now,
      })
      await db.budgets.update(budget.id!, { localOrderId: orderId as number, updatedAt: now })

      // MAY-08: generar SourcingRequest para ítems marcados "sobre pedido"
      if (sobrePedidoItems.length > 0) {
        const requestId = await db.sourcingRequests.add({
          status: 'quoting',
          notes: `Sobre pedido — ${budget.customerName}`,
          createdAt: now,
          updatedAt: now,
        })
        for (const item of sobrePedidoItems) {
          const prod = item.productId > 0 ? products.find(p => p.id === item.productId) : null
          await db.sourcingLines.add({
            requestId: requestId as number,
            productId: item.productId > 0 ? item.productId : undefined,
            productName: prod?.name ?? item.description,
            brand: prod?.brand ?? '',
            isFreeText: !item.productId || item.productId === 0,
            quantity: item.quantity,
            destination: 'client',
            customerId,
            customerName: budget.customerName,
            expectedSalePricePYG: Math.round(item.unitPrice * (1 - (item.descuentoPct ?? 0) / 100) * globalDiscFactor),
          })
        }
      }
    })

    const msgs: string[] = []
    if (skipped > 0) msgs.push(`${skipped} ítem${skipped > 1 ? 's' : ''} personalizado${skipped > 1 ? 's' : ''} sin producto omitido${skipped > 1 ? 's' : ''}.`)
    if (sobrePedidoItems.length > 0) msgs.push(`Se creó una solicitud de cotización en el Comparador con ${sobrePedidoItems.length} ítem${sobrePedidoItems.length > 1 ? 's' : ''} sobre pedido.`)
    if (msgs.length > 0) alert('Pedido creado.\n\n' + msgs.join('\n'))
    navigate('/logistica')
  }

  async function updateStatus(id: number, status: BudgetStatus) {
    await db.budgets.update(id, { status, updatedAt: nowISO() })
  }

  function openQuickLoad() {
    setQuickSearch('')
    setQuickSelections({})
    setQuickDiscount(form.descuentoMayoristaBase || '0')
    setShowQuickLoad(true)
  }

  function applyQuickLoad() {
    const newLines: BudgetLineItem[] = []
    Object.entries(quickSelections).forEach(([pid, qty]) => {
      if (!qty || parseInt(qty) <= 0) return
      const p = products.find(x => String(x.id) === pid)
      if (!p) return
      newLines.push({
        productId: pid,
        description: `${p.brand} — ${p.name} ${p.sizeML}ml`,
        type: 'sealed',
        sizeML: String(p.sizeML),
        quantity: qty,
        unitPrice: String(p.sellingPricePYG),
        descuentoPct: quickDiscount,
        sobrePedido: false,
        costoEstimado: '',
      })
    })
    if (!newLines.length) { setShowQuickLoad(false); return }
    setForm(f => ({
      ...f,
      items: [...f.items.filter(i => i.description.trim() || i.unitPrice.trim()), ...newLines],
    }))
    setShowQuickLoad(false)
  }

  async function exportPDF(budget: typeof budgets[0]) {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const logoImg = await db.images.get('business-logo')
    const logoB64 = logoImg ? await blobToBase64(logoImg.blob) : null
    const logoFmt = logoImg?.mime === 'image/png' ? 'PNG' : 'JPEG'
    const configName = await db.config.where('key').equals('business_name').first()
    const businessName = configName?.value || 'JODA Parfums'

    // Header dark/gold
    doc.setFillColor(20, 18, 18)
    doc.rect(0, 0, 210, 38, 'F')
    if (logoB64) {
      doc.addImage(logoB64, logoFmt, 10, 4, 30, 30)
      doc.setTextColor(200, 169, 110); doc.setFontSize(12); doc.setFont('helvetica', 'bold')
      doc.text(businessName, 44, 16)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 130, 80)
      doc.text(budget.esMayorista ? 'Presupuesto Mayorista' : 'Presupuesto de Fragancias', 44, 26)
    } else {
      doc.setTextColor(200, 169, 110); doc.setFontSize(24); doc.setFont('helvetica', 'bold')
      doc.text('JODA', 14, 16)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 150, 95); doc.text('PARFUMS & DECANTS', 14, 23)
      doc.setTextColor(160, 130, 80)
      doc.text(budget.esMayorista ? 'Presupuesto Mayorista' : 'Presupuesto de Fragancias', 14, 30)
    }
    doc.setTextColor(200, 169, 110); doc.setFontSize(10)
    doc.text(`N° ${String(budget.id).padStart(4, '0')}`, 160, 15)
    doc.setFontSize(8); doc.setTextColor(160, 130, 80)
    doc.text(fmtDate(budget.createdAt), 160, 22)

    // Cliente
    doc.setTextColor(30, 27, 46); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text('Para:', 14, 50); doc.setFont('helvetica', 'normal')
    doc.text(budget.customerName, 32, 50)
    if (budget.customerPhone) doc.text(budget.customerPhone, 32, 57)
    if (budget.validUntil) doc.text(`Válido hasta: ${fmtDate(budget.validUntil)}`, 140, 50)

    // Encabezado tabla
    let y = 73
    doc.setFillColor(20, 18, 18); doc.rect(14, y, 182, 8, 'F')
    doc.setTextColor(200, 169, 110); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('Descripcion', 16, y + 5.5)
    doc.text('Cant.', 130, y + 5.5)
    doc.text('P. Unitario', 144, y + 5.5)
    doc.text('Subtotal', 172, y + 5.5)
    y += 12

    doc.setTextColor(30, 27, 46); doc.setFont('helvetica', 'normal')

    budget.items.forEach((item, idx) => {
      if (y > 250) { doc.addPage(); y = 20 }
      if (idx % 2 === 1) { doc.setFillColor(248, 247, 255); doc.rect(14, y - 2, 182, 9, 'F') }

      const discPct = item.descuentoPct ?? 0
      const netUnitPrice = item.unitPrice * (1 - discPct / 100)
      const netSubtotal = netUnitPrice * item.quantity
      doc.setFontSize(9); doc.setTextColor(30, 27, 46)
      doc.text(item.description.slice(0, 62), 16, y + 4)
      doc.text(String(item.quantity), 135, y + 4)
      doc.text(`Gs. ${Math.round(netUnitPrice).toLocaleString('es-PY')}`, 140, y + 4)
      doc.text(`Gs. ${Math.round(netSubtotal).toLocaleString('es-PY')}`, 165, y + 4)
      y += 10
    })

    // Totales
    y += 5
    doc.setDrawColor(200, 200, 220); doc.line(14, y, 196, y); y += 8
    doc.setFontSize(10)

    const grossTotal = budget.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const netAfterLines = budget.items.reduce((s, i) => s + i.unitPrice * (1 - (i.descuentoPct ?? 0) / 100) * i.quantity, 0)
    const descLineas = grossTotal - netAfterLines
    const discGlobal = netAfterLines * (budget.discount / 100)
    const hasLineDisc = descLineas > 0

    if (hasLineDisc) {
      doc.setTextColor(30, 27, 46)
      doc.text('Subtotal lista:', 120, y)
      doc.text(`Gs. ${Math.round(grossTotal).toLocaleString('es-PY')}`, 195, y, { align: 'right' }); y += 7
      doc.setTextColor(180, 50, 50)
      doc.text('Desc. por lineas:', 120, y)
      doc.text(`-Gs. ${Math.round(descLineas).toLocaleString('es-PY')}`, 195, y, { align: 'right' }); y += 7
      doc.setTextColor(30, 27, 46)
      doc.text('Subtotal neto:', 120, y)
      doc.text(`Gs. ${Math.round(netAfterLines).toLocaleString('es-PY')}`, 195, y, { align: 'right' }); y += 7
    } else if (budget.discount > 0) {
      doc.setTextColor(30, 27, 46)
      doc.text('Subtotal:', 130, y)
      doc.text(`Gs. ${Math.round(grossTotal).toLocaleString('es-PY')}`, 195, y, { align: 'right' }); y += 7
    }

    if (budget.discount > 0) {
      doc.setTextColor(180, 50, 50)
      doc.text(`Descuento global (${budget.discount}%):`, 120, y)
      doc.text(`-Gs. ${Math.round(discGlobal).toLocaleString('es-PY')}`, 195, y, { align: 'right' }); y += 7
      doc.setTextColor(30, 27, 46)
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 27, 46)
    doc.text('TOTAL:', 140, y); doc.setTextColor(160, 128, 64)
    doc.text(`Gs. ${budget.total.toLocaleString('es-PY')}`, 195, y, { align: 'right' })

    if (budget.notes) {
      y += 20; doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'italic'); doc.setFontSize(9)
      doc.text(budget.notes, 14, y, { maxWidth: 182 })
    }

    doc.setDrawColor(154, 123, 63); doc.setLineWidth(0.5); doc.line(14, 279, 196, 279)
    doc.setTextColor(154, 123, 63); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(`¡Gracias por tu confianza en ${businessName}!`, 105, 284, { align: 'center' })

    const url = doc.output('bloburi')
    window.open(url, '_blank')
  }

  const selectedBudget = budgets.find(b => b.id === showDetail)
  const quickProducts = products.filter(p =>
    (p.type === 'sealed' || p.type === 'tester') &&
    (!quickSearch || p.name.toLowerCase().includes(quickSearch.toLowerCase()) || p.brand.toLowerCase().includes(quickSearch.toLowerCase()))
  )
  const quickCount = Object.values(quickSelections).filter(v => parseInt(v) > 0).length

  return (
    <div>
      <PageHeader
        title="Presupuestos"
        subtitle="Generación de documentos PDF para clientes"
        action={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Nuevo presupuesto</Button>}
      />

      {budgets.length === 0 ? (
        <Card><CardBody className="text-center py-12">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No hay presupuestos emitidos</p>
        </CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">#</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Total</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(b => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setShowDetail(b.id!)}>
                    <td className="px-5 py-3 text-gray-400 font-mono">{String(b.id).padStart(4, '0')}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{b.customerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {b.customerPhone && <p className="text-xs text-gray-400">{b.customerPhone}</p>}
                        {b.esMayorista && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">MAYORISTA</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(b.createdAt)}</td>
                    <td className="px-5 py-3"><Badge color={statusColors[b.status]}>{statusLabels[b.status]}</Badge></td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtPYG(b.total)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <Select
                          value={b.status}
                          onChange={e => updateStatus(b.id!, e.target.value as BudgetStatus)}
                          options={Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l }))}
                          className="text-xs w-28"
                        />
                        {b.status === 'accepted' && !(b.localOrderId && localOrderIds.has(b.localOrderId)) && (
                          <button onClick={() => convertToOrder(b)} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer" title="Crear pedido en Logística">
                            <Package size={13} />
                          </button>
                        )}
                        {b.localOrderId && localOrderIds.has(b.localOrderId) && (
                          <button onClick={() => navigate('/logistica')} className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors cursor-pointer">
                            Ped. #{String(b.localOrderId).padStart(4, '0')}
                          </button>
                        )}
                        <button onClick={() => openEditBudget(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"><Edit2 size={13} /></button>
                        <button onClick={() => exportPDF(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-violet-50 hover:text-violet-600 transition-colors cursor-pointer"><Download size={13} /></button>
                        <button onClick={() => handleDeleteBudget(b.id!)} className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal nuevo / editar presupuesto */}
      <Modal isOpen={showNew} onClose={closeModal} title={editBudgetId ? 'Editar presupuesto' : 'Nuevo presupuesto'} size="xl">
        <div className="space-y-4">

          {/* Fila de opciones: mayorista + carga ágil */}
          <div className="flex items-center gap-4 flex-wrap bg-gray-50 rounded-xl px-3 py-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`relative w-9 h-5 rounded-full transition-colors ${form.esMayorista ? 'bg-amber-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.esMayorista ? 'translate-x-4' : 'translate-x-0.5'}`} />
                <input type="checkbox" className="sr-only" checked={form.esMayorista} onChange={e => setForm(f => ({ ...f, esMayorista: e.target.checked }))} />
              </div>
              <span className="text-sm font-medium text-gray-700">Mayorista</span>
            </label>
            {form.esMayorista && (
              <div className="flex items-center gap-1.5">
                <Tag size={13} className="text-amber-600" />
                <span className="text-xs text-gray-600">Desc. base:</span>
                <input
                  type="number" min="0" max="100"
                  value={form.descuentoMayoristaBase}
                  onChange={e => setForm(f => ({ ...f, descuentoMayoristaBase: e.target.value }))}
                  className="w-14 text-sm border border-amber-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 text-center"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            )}
            <button
              type="button"
              onClick={openQuickLoad}
              className="ml-auto flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium cursor-pointer"
            >
              <Zap size={14} />
              Carga ágil
            </button>
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <CustomerAutocomplete
              label="Nombre del cliente"
              value={form.customerName}
              onChange={v => setForm(f => ({ ...f, customerName: v }))}
              onSelect={c => setForm(f => ({ ...f, customerName: c.name, customerPhone: c.phone ?? f.customerPhone }))}
              customers={customers}
            />
            <Input label="Teléfono (opcional)" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
          </div>

          {/* Líneas */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Líneas del presupuesto</p>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className={`border rounded-xl p-3 space-y-2 ${item.sobrePedido ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-gray-50/50'}`}>
                  {/* Fila 1: tipo + producto + tamaño */}
                  <div className="flex gap-2 items-center">
                    <select
                      value={item.type}
                      onChange={e => handleLineTypeChange(i, e.target.value as BudgetLineItem['type'])}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
                    >
                      <option value="sealed">Sellado</option>
                      <option value="tester">Tester</option>
                      <option value="decant">Decant</option>
                      <option value="partial">Parcial</option>
                      <option value="custom">Personalizado</option>
                    </select>

                    {item.type !== 'custom' ? (
                      <select
                        value={item.productId}
                        onChange={e => autoFill(i, e.target.value, item.type, item.sizeML)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white min-w-0"
                      >
                        <option value="0">Seleccionar producto...</option>
                        {getProductsForType(item.type).map(p => (
                          <option key={p.id} value={String(p.id)}>{p.brand} — {p.name}</option>
                        ))}
                      </select>
                    ) : <div className="flex-1" />}

                    {(item.type === 'decant' || item.type === 'partial') && (
                      <select
                        value={item.sizeML}
                        onChange={e => autoFill(i, item.productId, item.type, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
                      >
                        {[3, 5, 10, 30].map(s => <option key={s} value={String(s)}>{s}ml</option>)}
                      </select>
                    )}

                    <button
                      onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 cursor-pointer shrink-0"
                    ><X size={14} /></button>
                  </div>

                  {/* Fila 2: descripción + cant + precio + desc% + neto */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      className="flex-1 min-w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Cant."
                      value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white text-center shrink-0"
                    />
                    <input
                      type="number"
                      placeholder="Precio Gs."
                      value={item.unitPrice}
                      onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                      className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white text-right shrink-0"
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <input
                        type="number" min="0" max="100"
                        placeholder="0"
                        value={item.descuentoPct}
                        onChange={e => updateItem(i, 'descuentoPct', e.target.value)}
                        className="w-12 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white text-center"
                        title="Descuento por línea (%)"
                      />
                      <span className="text-xs text-gray-400 pl-0.5">%</span>
                    </div>
                    {item.unitPrice && item.quantity && (
                      <span className="text-xs text-gray-500 shrink-0 text-right min-w-20">
                        = {fmtPYG(Math.round((parseFloat(item.unitPrice) || 0) * (1 - (parseFloat(item.descuentoPct) || 0) / 100) * (parseInt(item.quantity) || 0)))}
                      </span>
                    )}
                  </div>

                  {/* Fila 3: sobre pedido + costo estimado */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={item.sobrePedido}
                        onChange={e => updateItem(i, 'sobrePedido', e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      Sobre pedido
                    </label>
                    {item.sobrePedido && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Costo estimado Gs.</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={item.costoEstimado}
                          onChange={e => updateItem(i, 'costoEstimado', e.target.value)}
                          className="w-28 text-xs border border-amber-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-right"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyLine(f.esMayorista ? f.descuentoMayoristaBase : '0')] }))}
              className="mt-2 text-sm text-violet-600 hover:text-violet-800 font-medium cursor-pointer"
            >
              + Agregar línea
            </button>
          </div>

          {/* Totales en tiempo real */}
          {subtotalBruto > 0 && (
            <div className="bg-violet-50 rounded-xl p-4 space-y-1.5 text-sm">
              {descLineaTotal > 0 ? (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal lista</span><span className="font-medium">{fmtPYG(subtotalBruto)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Desc. por línea</span><span className="text-red-500">− {fmtPYG(Math.round(descLineaTotal))}</span></div>
                  <div className="flex justify-between border-t border-violet-200 pt-1"><span className="text-gray-600">Subtotal neto</span><span className="font-medium">{fmtPYG(Math.round(subtotalNeto))}</span></div>
                </>
              ) : (
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{fmtPYG(subtotalBruto)}</span></div>
              )}
              {descGlobalAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Desc. global ({form.discount}%)</span><span className="text-red-500">− {fmtPYG(Math.round(descGlobalAmt))}</span></div>}
              <div className="flex justify-between border-t border-violet-200 pt-2 mt-1"><span className="font-bold text-gray-900">TOTAL</span><span className="font-bold text-violet-700 text-base">{fmtPYG(Math.round(total))}</span></div>
            </div>
          )}

          {/* Análisis de rentabilidad */}
          {profitLines.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Solo uso interno — no aparece en el PDF</span>
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-amber-700 border-b border-amber-200">
                    <th className="text-left py-1 font-medium">Ítem</th>
                    <th className="text-right py-1 font-medium w-12">Desc%</th>
                    <th className="text-right py-1 font-medium w-20">Costo</th>
                    <th className="text-right py-1 font-medium w-20">P. Neto</th>
                    <th className="text-right py-1 font-medium w-14">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {profitLines.map((l, i) => (
                    <tr key={i} className="border-b border-amber-100 last:border-0">
                      <td className="py-1.5 text-gray-700 max-w-0">
                        <span className="block truncate" title={l.description}>{l.description}</span>
                        {l.costDetail && <span className="text-amber-600 text-[10px]">{l.costDetail}</span>}
                        {l.sobrePedido && <span className="text-[10px] text-amber-700 font-semibold"> ★ S/pedido</span>}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">{l.discPct > 0 ? `${l.discPct}%` : '—'}</td>
                      <td className="py-1.5 text-right text-gray-600">{fmtPYG(l.unitCost)}</td>
                      <td className="py-1.5 text-right text-gray-600">{fmtPYG(Math.round(l.effectivePrice))}</td>
                      <td className={`py-1.5 text-right font-semibold ${l.margin >= 30 ? 'text-green-700' : l.margin >= 10 ? 'text-amber-700' : 'text-red-600'}`}>
                        {l.margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-amber-200">
                <div className="text-center">
                  <p className="text-amber-600 text-[10px] uppercase font-medium">Costo total</p>
                  <p className="font-semibold text-gray-800">{fmtPYG(totalCostAll)}</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-600 text-[10px] uppercase font-medium">Ingreso neto</p>
                  <p className="font-semibold text-gray-800">{fmtPYG(Math.round(totalRevAfterGlobal))}</p>
                </div>
                <div className="text-center">
                  <p className="text-amber-600 text-[10px] uppercase font-medium">Ganancia estimada</p>
                  <p className={`font-bold text-base ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {totalProfit >= 0 ? '+' : ''}{fmtPYG(Math.round(totalProfit))}
                    <span className="text-xs font-normal ml-1">({overallMargin}%)</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Descuento global (%)" type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
            <Input label="Válido hasta" type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          </div>
          <Textarea label="Condiciones / Notas" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Ej: Precio válido por 48 hs. Pago anticipado." />

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            <Button className="flex-1" onClick={editBudgetId ? handleEditBudget : handleCreate}>
              {editBudgetId ? 'Guardar cambios' : 'Crear presupuesto'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle */}
      {selectedBudget && (
        <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={`Presupuesto #${String(selectedBudget.id).padStart(4, '0')}`} size="lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">Cliente</p>
                <p className="font-semibold">{selectedBudget.customerName}</p>
                {selectedBudget.esMayorista && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full mt-1 inline-block">MAYORISTA</span>}
              </div>
              <div><p className="text-gray-500">Fecha</p><p className="font-medium">{fmtDate(selectedBudget.createdAt)}</p></div>
            </div>
            {selectedBudget.localOrderId && localOrderIds.has(selectedBudget.localOrderId) ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <Package size={16} className="text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800">Pedido generado — Ped. #{String(selectedBudget.localOrderId).padStart(4, '0')}</p>
                  <p className="text-xs text-emerald-600">Este presupuesto ya fue convertido a un pedido en Logística.</p>
                </div>
                <button onClick={() => { setShowDetail(null); navigate('/logistica') }} className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline cursor-pointer">Ver →</button>
              </div>
            ) : selectedBudget.status === 'accepted' && (
              <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <Package size={16} className="text-violet-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-violet-800">Presupuesto aceptado</p>
                  <p className="text-xs text-violet-600">Podés convertirlo en un pedido de Logística.</p>
                </div>
                <button onClick={() => { setShowDetail(null); convertToOrder(selectedBudget) }} className="text-xs font-semibold bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition-colors cursor-pointer">Crear pedido</button>
              </div>
            )}
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-medium">Descripción</th>
                <th className="text-right py-2 text-gray-500 font-medium">Cant.</th>
                <th className="text-right py-2 text-gray-500 font-medium">P. Neto</th>
                <th className="text-right py-2 text-gray-500 font-medium">Subtotal</th>
              </tr></thead>
              <tbody>
                {selectedBudget.items.map((item, i) => {
                  const discPct = item.descuentoPct ?? 0
                  const netPrice = item.unitPrice * (1 - discPct / 100)
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2">
                        <span>{item.description}</span>
                        {discPct > 0 && <span className="ml-1 text-xs text-amber-600 font-medium">(−{discPct}%)</span>}
                        {item.sobrePedido && <span className="ml-1 text-xs text-amber-700">★ S/pedido</span>}
                      </td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{fmtPYG(Math.round(netPrice))}</td>
                      <td className="py-2 text-right font-medium">{fmtPYG(item.subtotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              {(() => {
                const gross = selectedBudget.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
                const netL = selectedBudget.items.reduce((s, i) => s + i.unitPrice * (1 - (i.descuentoPct ?? 0) / 100) * i.quantity, 0)
                const descL = gross - netL
                const discG = netL * (selectedBudget.discount / 100)
                return <>
                  {descL > 0 ? (
                    <>
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal lista</span><span>{fmtPYG(Math.round(gross))}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Desc. por línea</span><span className="text-red-500">− {fmtPYG(Math.round(descL))}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal neto</span><span>{fmtPYG(Math.round(netL))}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmtPYG(selectedBudget.subtotal)}</span></div>
                  )}
                  {selectedBudget.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">Desc. global {selectedBudget.discount}%</span><span className="text-red-500">− {fmtPYG(Math.round(discG))}</span></div>}
                  <div className="flex justify-between font-bold border-t border-gray-200 pt-1.5"><span>TOTAL</span><span className="text-violet-700">{fmtPYG(selectedBudget.total)}</span></div>
                </>
              })()}
            </div>
            {selectedBudget.notes && <p className="text-gray-500 italic">{selectedBudget.notes}</p>}
            <Button className="w-full" icon={<Download size={15} />} onClick={() => exportPDF(selectedBudget)}>Descargar PDF</Button>
          </div>
        </Modal>
      )}

      {/* Modal carga ágil */}
      <Modal isOpen={showQuickLoad} onClose={() => setShowQuickLoad(false)} title="Carga ágil de productos" size="lg">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-violet-600" />
              <span className="text-sm text-gray-600">Descuento:</span>
              <input
                type="number" min="0" max="100"
                value={quickDiscount}
                onChange={e => setQuickDiscount(e.target.value)}
                className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre o marca..."
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              className="flex-1 min-w-40 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-0.5 border border-gray-100 rounded-xl p-2">
            {quickProducts.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Sin productos sellados disponibles</p>}
            {quickProducts.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.brand} — {p.name}</p>
                  <p className="text-xs text-gray-400">{fmtPYG(p.sellingPricePYG)} · Stock: {p.stockSealed} u.</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number" min="0"
                    placeholder="0"
                    value={quickSelections[p.id!] ?? ''}
                    onChange={e => setQuickSelections(s => ({ ...s, [p.id!]: e.target.value }))}
                    className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500 text-center"
                  />
                  <span className="text-xs text-gray-400">u.</span>
                </div>
              </div>
            ))}
          </div>
          {quickDiscount !== '0' && quickCount > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Se aplicará {quickDiscount}% de descuento por línea a los {quickCount} producto{quickCount !== 1 ? 's' : ''} seleccionados.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowQuickLoad(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={applyQuickLoad} disabled={quickCount === 0}>
              Agregar {quickCount > 0 ? `${quickCount} producto${quickCount !== 1 ? 's' : ''}` : 'productos'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
