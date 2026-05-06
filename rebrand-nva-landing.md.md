# Implementar rebrand NVA + Landing pública

## CONTEXTO
La app se rebrandea de FNCE → NVA (Net Value Analysis).
Nuevos logos en `/mnt/user-data/uploads/`:
- `nva-logo.svg` (horizontal)
- `Nva-icon.svg` (cuadrado para favicon)

Messaging clave:
- Marca: NVA
- Problema: "Sube tu estado de cuenta. Ve en qué gastas en segundos"
- NO usar "Net Value Analysis" prominentemente (solo footer/about)

---

## PARTE A: Integrar logos en app

### 1. Copiar assets
```bash
cp /mnt/user-data/uploads/nva-logo.svg public/nva-logo.svg
cp /mnt/user-data/uploads/Nva-icon.svg public/nva-icon.svg
```

### 2. Generar favicon
Usar `Nva-icon.svg` como base, crear:
- `public/favicon.ico`
- `public/favicon-16x16.png`
- `public/favicon-32x32.png`
- `public/apple-touch-icon.png` (180x180)

### 3. Actualizar layout principal
**Archivo:** `app/layout.tsx`

Cambiar metadata:
```typescript
export const metadata: Metadata = {
  title: 'NVA - Tu dinero en claro',
  description: 'Sube tu estado de cuenta y descubre en qué gastas en segundos',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}
```

### 4. Actualizar sidebar
**Archivo:** Componente de sidebar (identificar ubicación actual)

Reemplazar logo actual por:
```tsx
<Image 
  src="/nva-logo.svg" 
  alt="NVA" 
  width={120} 
  height={40}
  className="mb-8"
/>
```

### 5. Actualizar navbar (si existe)
Mismo cambio de logo.

---

## PARTE B: Landing pública

### 1. Crear página landing
**Archivo:** `app/page.tsx` (reemplazar existente)

**Estructura:**
```tsx
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navbar simple */}
      <nav className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Image src="/nva-logo.svg" alt="NVA" width={100} height={32} />
          <a href="/login" className="text-sm text-zinc-400 hover:text-white">
            Iniciar sesión
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Sube tu estado de cuenta.
          <br />
          <span className="text-emerald-500">Ve en qué gastas en segundos.</span>
        </h1>
        
        <p className="text-xl text-zinc-400 mb-12">
          Sin Excel. Sin categorizar manual. Solo sube tu PDF o CSV y listo.
        </p>

        <button 
          onClick={() => router.push('/analyze')}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-lg font-semibold"
        >
          Subir estado de cuenta gratis
        </button>

        <p className="text-sm text-zinc-500 mt-4">
          Sin registro. Resultados en 30 segundos.
        </p>
      </section>

      {/* Ejemplo visual */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Antes */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h3 className="text-sm text-zinc-500 mb-4">Antes (Excel tradicional)</h3>
            <div className="space-y-2 opacity-50">
              <div className="h-3 bg-zinc-700 rounded w-3/4"></div>
              <div className="h-3 bg-zinc-700 rounded w-full"></div>
              <div className="h-3 bg-zinc-700 rounded w-5/6"></div>
            </div>
          </div>

          {/* Después */}
          <div className="bg-gradient-to-br from-emerald-900/20 to-violet-900/20 border border-emerald-500/30 rounded-lg p-6">
            <h3 className="text-sm text-emerald-400 mb-4">Con NVA (automático)</h3>
            <div className="text-2xl font-bold mb-2">$4,200</div>
            <p className="text-zinc-400 text-sm">en comida este mes (35% de tus ingresos)</p>
            <div className="mt-4 text-amber-400 text-sm">
              ⚠️ Mayor fuga: Uber Eats ($1,200/mes)
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Cómo funciona</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Sube tu archivo</h3>
            <p className="text-sm text-zinc-400">
              PDF o CSV de Nu, BBVA, Spin o cualquier banco
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">Espera 30 segundos</h3>
            <p className="text-sm text-zinc-400">
              NVA analiza y categoriza automático
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Ve tus insights</h3>
            <p className="text-sm text-zinc-400">
              Fugas de dinero, recomendaciones, gráficas
            </p>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">
          Deja de preguntarte en qué se va tu dinero
        </h2>
        <p className="text-zinc-400 mb-8">
          Súbelo y sabrás en 30 segundos.
        </p>
        <button 
          onClick={() => router.push('/analyze')}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-lg font-semibold"
        >
          Probar gratis ahora
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-24">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex justify-between items-center">
            <div>
              <Image src="/nva-logo.svg" alt="NVA" width={80} height={26} />
              <p className="text-sm text-zinc-500 mt-2">
                Net Value Analysis © 2025
              </p>
            </div>
            <div className="text-sm text-zinc-400 space-x-6">
              <a href="/privacy">Privacidad</a>
              <a href="/terms">Términos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
```

### 2. Crear página /analyze (upload público)
**Archivo:** `app/analyze/page.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  const handleUpload = async () => {
    if (!file) return
    
    setLoading(true)
    const messages = [
      "Leyendo transacciones...",
      "Detectando patrones...",
      "Categorizando gastos...",
      "Generando insights..."
    ]
    
    // Simular progreso
    for (let i = 0; i < messages.length; i++) {
      setProgress((i + 1) * 25)
      await new Promise(r => setTimeout(r, 1500))
    }
    
    // TODO: enviar a /api/analyze
    // Por ahora redirigir a dashboard
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <Image src="/nva-logo.svg" alt="NVA" width={120} height={40} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Analiza tu estado de cuenta</h1>
          <p className="text-zinc-400">Sube PDF o CSV de tu banco</p>
        </div>

        {!loading ? (
          <div className="border-2 border-dashed border-zinc-700 rounded-lg p-12 text-center hover:border-emerald-500 transition">
            <input
              type="file"
              accept=".pdf,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg mb-2">
                {file ? file.name : 'Arrastra tu archivo o haz clic'}
              </p>
              <p className="text-sm text-zinc-500">PDF o CSV (máx 10MB)</p>
            </label>

            {file && (
              <button
                onClick={handleUpload}
                className="mt-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold"
              >
                Analizar gratis
              </button>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
            <div className="mb-4">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-center text-zinc-400">
              {progress < 25 && "Leyendo transacciones..."}
              {progress >= 25 && progress < 50 && "Detectando patrones..."}
              {progress >= 50 && progress < 75 && "Categorizando gastos..."}
              {progress >= 75 && "Generando insights..."}
            </p>
          </div>
        )}

        <p className="text-center text-sm text-zinc-500 mt-6">
          🔒 Tus datos son privados. No los compartimos.
        </p>
      </div>
    </div>
  )
}
```

### 3. Redireccionamiento inteligente
**Archivo:** `middleware.ts` (crear si no existe)

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get('auth-token') // ajustar según tu auth
  
  // Si va a /dashboard sin auth → landing
  if (request.nextUrl.pathname.startsWith('/dashboard') && !isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/finanzas/:path*', '/trading/:path*', '/portfolio/:path*']
}
```

---

## RESTRICCIONES CRÍTICAS

**SOLO CAMBIOS VISUALES Y ROUTING:**
- ✅ Logos, imágenes, SVGs
- ✅ Tailwind CSS, estilos
- ✅ JSX/TSX estructura de componentes
- ✅ Crear nuevas páginas
- ❌ NO tocar Supabase queries
- ❌ NO modificar lógica de negocio
- ❌ NO cambiar API routes (solo crear `/api/analyze` placeholder)

**COLORES (mantener paleta actual):**
- bg-zinc-950, bg-zinc-900
- text-zinc-400, text-zinc-500
- emerald-500, emerald-600
- violet-500 (acentos)

**BOTONES (usar sistema existente):**
Mantener clases actuales de botones primarios/secundarios

---

## VALIDACIÓN

Después de implementar, verificar:
1. `/` → landing pública sin login
2. Logos visibles en sidebar/navbar
3. Favicon actualizado en browser tab
4. `/analyze` → funciona upload (aunque no procese aún)
5. Meta tags correctos en `<head>`

---

## NOTAS
- Los archivos de logo están en `/mnt/user-data/uploads/`
- La app corre en `localhost:3005`
- Proyecto Next.js 15 con App Router
- Ya existe un sistema de auth (email + pendiente Google OAuth)
