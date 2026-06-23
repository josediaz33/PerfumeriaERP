import { useState, useEffect, useRef } from 'react'
import { Settings, Save, Download, Upload, RefreshCw, ImageIcon, X, Lock, LockOpen, Globe, Palette } from 'lucide-react'
import { db, getConfig, setConfig } from '../db/db'
import { compressImage, blobToBase64, base64ToBlob, createObjectURL } from '../lib/images'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

const LOGO_IMAGE_ID = 'business-logo'

export function Configuracion() {
  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [usdRate, setUsdRate] = useState('7500')
  const [saved, setSaved] = useState(false)

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [pinError, setPinError] = useState('')

  const [ghToken, setGhToken] = useState('')
  const [ghUser, setGhUser] = useState('')
  const [ghRepo, setGhRepo] = useState('')
  const [ghSaved, setGhSaved] = useState(false)

  const [brandColor, setBrandColor] = useState('violet')

  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoRef = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      setBusinessName(await getConfig('business_name'))
      setBusinessPhone(await getConfig('business_phone'))
      setBusinessAddress(await getConfig('business_address'))
      setUsdRate(await getConfig('usd_pyg_rate'))
      setGhToken(await getConfig('github_token'))
      setGhUser(await getConfig('github_username'))
      setGhRepo(await getConfig('github_repo'))
      setBrandColor((await getConfig('brand_color')) || 'violet')
      const img = await db.images.get(LOGO_IMAGE_ID)
      if (img) {
        const url = createObjectURL(img.blob)
        logoRef.current = url
        setLogoUrl(url)
      }
    }
    load()
    return () => { if (logoRef.current) URL.revokeObjectURL(logoRef.current) }
  }, [])

  async function handleSave() {
    await setConfig('business_name', businessName)
    await setConfig('business_phone', businessPhone)
    await setConfig('business_address', businessAddress)
    await setConfig('usd_pyg_rate', usdRate)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const { blob, mime } = await compressImage(file, 400)
      await db.images.put({ id: LOGO_IMAGE_ID, blob, mime, createdAt: new Date().toISOString() })
      if (logoRef.current) URL.revokeObjectURL(logoRef.current)
      const url = createObjectURL(blob)
      logoRef.current = url
      setLogoUrl(url)
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handleLogoRemove() {
    await db.images.delete(LOGO_IMAGE_ID)
    if (logoRef.current) URL.revokeObjectURL(logoRef.current)
    logoRef.current = null
    setLogoUrl(null)
  }

  async function fetchExchangeRate() {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const data = await res.json()
      const pygRate = data.rates?.PYG
      if (pygRate) {
        setUsdRate(Math.round(pygRate).toString())
        alert(`Cotización actualizada: 1 USD = Gs. ${Math.round(pygRate).toLocaleString('es-PY')}`)
      }
    } catch {
      alert('No se pudo obtener la cotización. Ingresala manualmente.')
    }
  }

  useEffect(() => {
    getConfig('pin_code').then(p => setCurrentPin(p || ''))
  }, [])

  async function handleSavePin() {
    setPinError('')
    if (newPin && (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin))) {
      setPinError('El PIN debe tener entre 4 y 6 dígitos numéricos.')
      return
    }
    await setConfig('pin_code', newPin)
    setCurrentPin(newPin)
    setNewPin('')
    setPinSaved(true)
    if (newPin) sessionStorage.setItem('joda_unlocked', '1')
    else sessionStorage.removeItem('joda_unlocked')
    setTimeout(() => setPinSaved(false), 2000)
  }

  async function handleColorChange(key: string) {
    setBrandColor(key)
    await setConfig('brand_color', key)
  }

  async function handleSaveGitHub() {
    await setConfig('github_token', ghToken.trim())
    await setConfig('github_username', ghUser.trim())
    await setConfig('github_repo', ghRepo.trim())
    setGhSaved(true)
    setTimeout(() => setGhSaved(false), 2000)
  }

  async function exportData() {
    const allImages = await db.images.toArray()
    const imagesB64 = await Promise.all(
      allImages.map(async img => ({
        id: img.id,
        mime: img.mime,
        createdAt: img.createdAt,
        data: await blobToBase64(img.blob),
      }))
    )
    const data = {
      exportedAt: new Date().toISOString(),
      version: 2,
      accounts: await db.accounts.toArray(),
      movements: await db.movements.toArray(),
      products: await db.products.toArray(),
      stockEntries: await db.stockEntries.toArray(),
      shipmentBatches: await db.shipmentBatches.toArray(),
      supplies: await db.supplies.toArray(),
      decantBatches: await db.decantBatches.toArray(),
      sales: await db.sales.toArray(),
      saleItems: await db.saleItems.toArray(),
      customers: await db.customers.toArray(),
      suppliers: await db.suppliers.toArray(),
      supplierPrices: await db.supplierPrices.toArray(),
      orders: await db.orders.toArray(),
      localOrders: await db.localOrders.toArray(),
      budgets: await db.budgets.toArray(),
      utilityDistributions: await db.utilityDistributions.toArray(),
      config: await db.config.toArray(),
      images: imagesB64,
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `joda-parfums-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('¿Sobrescribir todos los datos con el backup? Esta acción no se puede deshacer.')) return
    const text = await file.text()
    const data = JSON.parse(text)

    if (data.accounts) { await db.accounts.clear(); await db.accounts.bulkAdd(data.accounts) }
    if (data.movements) { await db.movements.clear(); await db.movements.bulkAdd(data.movements) }
    if (data.products) { await db.products.clear(); await db.products.bulkAdd(data.products) }
    if (data.stockEntries) { await db.stockEntries.clear(); await db.stockEntries.bulkAdd(data.stockEntries) }
    if (data.shipmentBatches) { await db.shipmentBatches.clear(); await db.shipmentBatches.bulkAdd(data.shipmentBatches) }
    if (data.supplies) { await db.supplies.clear(); await db.supplies.bulkAdd(data.supplies) }
    if (data.decantBatches) { await db.decantBatches.clear(); await db.decantBatches.bulkAdd(data.decantBatches) }
    if (data.sales) { await db.sales.clear(); await db.sales.bulkAdd(data.sales) }
    if (data.saleItems) { await db.saleItems.clear(); await db.saleItems.bulkAdd(data.saleItems) }
    if (data.customers) { await db.customers.clear(); await db.customers.bulkAdd(data.customers) }
    if (data.suppliers) { await db.suppliers.clear(); await db.suppliers.bulkAdd(data.suppliers) }
    if (data.supplierPrices) { await db.supplierPrices.clear(); await db.supplierPrices.bulkAdd(data.supplierPrices) }
    if (data.orders) { await db.orders.clear(); await db.orders.bulkAdd(data.orders) }
    if (data.localOrders) { await db.localOrders.clear(); await db.localOrders.bulkAdd(data.localOrders) }
    if (data.budgets) { await db.budgets.clear(); await db.budgets.bulkAdd(data.budgets) }
    if (data.utilityDistributions) { await db.utilityDistributions.clear(); await db.utilityDistributions.bulkAdd(data.utilityDistributions) }
    if (data.config) { await db.config.clear(); await db.config.bulkAdd(data.config) }
    if (data.images?.length) {
      await db.images.clear()
      await db.images.bulkAdd(
        data.images.map((img: { id: string; mime: 'image/jpeg' | 'image/png'; createdAt: string; data: string }) => ({
          id: img.id,
          blob: base64ToBlob(img.data),
          mime: img.mime,
          createdAt: img.createdAt,
        }))
      )
    }
    alert('Backup importado correctamente. Recarga la página.')
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajustes del sistema y gestión de datos" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos del negocio */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Settings size={16} className="text-violet-600" />
              Datos del negocio
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input label="Nombre del negocio" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            <Input label="Teléfono / WhatsApp" value={businessPhone} onChange={e => setBusinessPhone(e.target.value)} />
            <Input label="Dirección / Ciudad" value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} />
            <Button className="w-full" icon={<Save size={15} />} onClick={handleSave}>
              {saved ? '¡Guardado!' : 'Guardar cambios'}
            </Button>
          </CardBody>
        </Card>

        {/* Logo del negocio */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ImageIcon size={16} className="text-violet-600" />
              Logo del negocio
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-500">
              Aparece en los presupuestos PDF y el catálogo exportado. Se guarda localmente.
            </p>
            {logoUrl ? (
              <div className="relative flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 p-4">
                <img src={logoUrl} alt="Logo" className="max-h-32 max-w-full object-contain" />
                <button
                  onClick={handleLogoRemove}
                  className="absolute top-2 right-2 p-1 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors"
                >
                  <X size={13} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 h-32">
                <p className="text-sm text-gray-400">Sin logo cargado</p>
              </div>
            )}
            <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm text-gray-500 hover:text-violet-600">
              <Upload size={15} />
              {logoUploading ? 'Procesando...' : logoUrl ? 'Cambiar logo' : 'Subir logo (PNG / JPG)'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
            </label>
          </CardBody>
        </Card>

        {/* Color de acento */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Palette size={16} className="text-violet-600" />
              Color de acento
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-500">Se aplica en toda la interfaz al instante.</p>
            <div className="flex gap-3 flex-wrap">
              {([
                { key: 'violet',  label: 'Violeta',    hex: '#7c3aed' },
                { key: 'indigo',  label: 'Índigo',     hex: '#4f46e5' },
                { key: 'blue',    label: 'Azul',       hex: '#2563eb' },
                { key: 'sky',     label: 'Cielo',      hex: '#0284c7' },
                { key: 'teal',    label: 'Verde azul', hex: '#0d9488' },
                { key: 'emerald', label: 'Esmeralda',  hex: '#059669' },
                { key: 'rose',    label: 'Rosa',       hex: '#e11d48' },
                { key: 'orange',  label: 'Naranja',    hex: '#ea580c' },
              ] as const).map(c => (
                <button
                  key={c.key}
                  title={c.label}
                  onClick={() => handleColorChange(c.key)}
                  className="relative w-9 h-9 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: c.hex }}
                >
                  {brandColor === c.key && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-base font-bold drop-shadow">✓</span>
                  )}
                  {brandColor === c.key && (
                    <span className="absolute -inset-1 rounded-full border-2 pointer-events-none" style={{ borderColor: c.hex }} />
                  )}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Cotización USD/PYG */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Cotización USD/PYG</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Cotización actual (Gs. por 1 USD)"
              type="number"
              value={usdRate}
              onChange={e => setUsdRate(e.target.value)}
            />
            <div className="bg-violet-50 rounded-lg p-3 text-sm">
              <p className="text-violet-700 font-medium">1 USD = Gs. {parseInt(usdRate).toLocaleString('es-PY')}</p>
              <p className="text-violet-500 text-xs mt-0.5">Usada como cotización por defecto en nuevas compras</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" icon={<RefreshCw size={15} />} onClick={fetchExchangeRate}>
                Actualizar automáticamente
              </Button>
              <Button className="flex-1" icon={<Save size={15} />} onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* PIN de acceso */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {currentPin ? <Lock size={16} className="text-violet-600" /> : <LockOpen size={16} className="text-gray-400" />}
              Protección con PIN
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-500">
              Si configurás un PIN, se pedirá al abrir la app. Dejalo vacío para desactivar la protección.
            </p>
            {currentPin ? (
              <div className="flex items-center gap-2 bg-violet-50 rounded-lg px-3 py-2">
                <Lock size={14} className="text-violet-600" />
                <span className="text-sm text-violet-700 font-medium">PIN configurado ({currentPin.length} dígitos)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <LockOpen size={14} className="text-gray-400" />
                <span className="text-sm text-gray-500">Sin protección activa</span>
              </div>
            )}
            <Input
              label={currentPin ? 'Nuevo PIN (dejá vacío para quitar protección)' : 'Nuevo PIN (4–6 dígitos)'}
              type="password"
              inputMode="numeric"
              placeholder="ej. 1234"
              value={newPin}
              onChange={e => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError('') }}
            />
            {pinError && <p className="text-sm text-red-500">{pinError}</p>}
            <Button
              className="w-full"
              icon={<Save size={15} />}
              onClick={handleSavePin}
              disabled={newPin === currentPin}
            >
              {pinSaved ? '¡Guardado!' : currentPin ? (newPin ? 'Actualizar PIN' : 'Quitar protección') : 'Activar PIN'}
            </Button>
          </CardBody>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Backup de datos</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-500">
              Exporta todos tus datos (incluyendo imágenes) a un archivo JSON. Importalo en cualquier momento para restaurar el sistema.
            </p>
            <Button className="w-full" variant="secondary" icon={<Download size={15} />} onClick={exportData}>
              Exportar backup completo
            </Button>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Importar backup</p>
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm text-gray-500 hover:text-violet-600">
                <Upload size={15} />
                Seleccionar archivo .json
                <input type="file" accept=".json" className="hidden" onChange={importData} />
              </label>
            </div>
          </CardBody>
        </Card>

        {/* Publicación del catálogo — GitHub Pages */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Globe size={16} className="text-violet-600" />
                Publicación del catálogo en línea (GitHub Pages)
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm space-y-2">
                <p className="font-semibold text-blue-800">Configuración inicial (una sola vez):</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Creá un repositorio <strong>público</strong> en github.com (ej. <code className="bg-blue-100 px-1 rounded">joda-catalogo</code>)</li>
                  <li>Activá GitHub Pages: <strong>Settings → Pages → Deploy from branch → main → / (root)</strong></li>
                  <li>Generá un token en: <strong>Settings → Developer settings → Personal access tokens → Tokens (classic)</strong> con permiso <code className="bg-blue-100 px-1 rounded">repo</code></li>
                  <li>Guardá los datos abajo — después usá el botón <strong>"Publicar en línea"</strong> en el Catálogo</li>
                </ol>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Input
                  label="Usuario GitHub"
                  placeholder="tu-usuario"
                  value={ghUser}
                  onChange={e => setGhUser(e.target.value)}
                />
                <Input
                  label="Repositorio"
                  placeholder="joda-catalogo"
                  value={ghRepo}
                  onChange={e => setGhRepo(e.target.value)}
                />
                <Input
                  label="Personal Access Token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={ghToken}
                  onChange={e => setGhToken(e.target.value)}
                />
              </div>
              {ghUser && ghRepo && (
                <p className="text-xs text-gray-500">
                  URL del catálogo:{' '}
                  <span className="font-mono text-violet-700">
                    {ghRepo === `${ghUser}.github.io`
                      ? `https://${ghUser}.github.io/catalogo.html`
                      : `https://${ghUser}.github.io/${ghRepo}/catalogo.html`}
                  </span>
                </p>
              )}
              <Button className="w-full" icon={<Save size={15} />} onClick={handleSaveGitHub}>
                {ghSaved ? '¡Guardado!' : 'Guardar configuración de GitHub'}
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Info del sistema */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Información del sistema</h3>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Versión</span>
              <span className="font-medium text-gray-900">2.0 — Fase 2</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Schema DB</span>
              <span className="font-medium text-gray-900">v5</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Almacenamiento</span>
              <span className="font-medium text-gray-900">IndexedDB (local)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-gray-500">Moneda principal</span>
              <span className="font-medium text-gray-900">Guaraní Paraguayo (PYG)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Módulos activos</span>
              <span className="font-medium text-gray-900">13 módulos</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
