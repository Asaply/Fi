````markdown
# FIX COMPLETO: Logos reales + Login + /analyze + Flujo MVP

## CONTEXTO DEL PROBLEMA

El prompt anterior se ejecutó pero generó **placeholders falsos** en lugar de usar los logos reales. Diagnóstico completo:

### Bugs verificados con MCP:

1. **`/public/nva-logo.svg` es un placeholder falso** con texto verde `fill="#10b981"`. El logo REAL del usuario es un rectángulo negro con "NV" blanco + "A" naranja `#FF8700`.

2. **`/public/nva-icon.svg` es un placeholder falso** (cuadrado verde con "N"). El REAL es un cuadrado negro con bordes redondeados (rx=80) que dice "NVA" con la A naranja.

3. **`/login` tiene background "sunburst rays" naranjas** (del antiguo FINN). Debe usar el mismo background que el dashboard: `linear-gradient(180deg, #FF6600 0%, #000000 50%, #000000 100%)`.

4. **`/login` tiene logo verde fake** (cuadrado verde con "N").

5. **`/analyze` tiene dropzone con borde dashed roto/cortado** y layout flotante sin centrar.

6. **Flujo MVP roto**: subir archivo en `/analyze` redirige a `/login` en vez de ir a una pantalla de RESULTADOS (que es el wow moment del MVP).

7. **Dock "N" flotante** (círculo en esquina inferior izquierda) aparece en TODAS las rutas públicas (/, /analyze, /login). Solo debe aparecer en rutas autenticadas (/dashboard, /finanzas, etc).

8. **Typos y acentos faltantes**: "Iniciar sesion" → "Iniciar sesión", "automatico" → "automático", "gastos" → "gastos", "graficas" → "gráficas", "Subelo y sabras" → "Súbelo y sabrás".

---

## PASO 1: REEMPLAZAR LOGOS CON LOS REALES

Los SVGs reales del usuario están en `/mnt/user-data/uploads/`. Hay que copiarlos correctamente.

### 1A. Crear `/public/nva-logo.svg` con este contenido EXACTO:

```svg



	.st0{fill:#FFFFFF;}
	.st1{font-family:'Arial-BoldMT', Arial, sans-serif;}
	.st2{font-size:180px;}
	.st3{letter-spacing:-2;}
	.st4{fill:#FF8700;}
	.st5{letter-spacing:7;}


	


	NV
	A


```

### 1B. Crear `/public/nva-icon.svg` con este contenido EXACTO:

```svg



	.st0{fill:#FFFFFF;}
	.st1{font-family:'Arial-BoldMT', Arial, sans-serif;}
	.st2{font-size:180px;}
	.st3{letter-spacing:-2;}
	.st4{fill:#FF8700;}
	.st5{letter-spacing:7;}


	


	NV
	A


```

### 1C. Regenerar favicons desde el icon real

Crear `/public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180x180) usando el icon real anterior. Si no hay herramientas de conversión disponibles, usar el SVG directamente como favicon en `app/layout.tsx`.

### 1D. Validación

Después de crear los archivos, ejecutar:
```bash
head -5 public/nva-logo.svg
head -5 public/nva-icon.svg
```

Verificar que NO contengan `fill="#10b981"` (verde esmeralda fake).

---

## PASO 2: ARREGLAR /login (estilo World App)

### 2A. Background correcto

El login NO debe usar el sunburst rays (era de FINN). Debe usar el mismo background que el dashboard:

```css
background: linear-gradient(180deg, #FF6600 0%, #000000 50%, #000000 100%);
min-height: 100vh;
```

Eliminar TODO el SVG de rayos del login. Buscar en `src/app/login/` archivos con palabras clave: `rays`, `sunburst`, `radial`, `light-rays`.

### 2B. Layout estilo World App

Estructura:

```tsx
// src/app/login/page.tsx (o equivalente)
export default function LoginPage() {
  return (
    
      
        
        {/* Logo + título */}
        
          
          NVA
          
            Sube tu estado de cuenta. Entiende tu dinero.
          
        

        {/* Términos checkbox */}
        
          
          
            Acepto los Términos y Condiciones y 
            la Política de Privacidad de NVA
          
        

        {/* Botones tipo card */}
        
          
            
              Nueva cuenta
              Crea tu cuenta nueva
            
            ↗
          
          
          
            
              Cuenta existente
              Inicia sesión en tu cuenta
            
            ↗
          
        
      
    
  );
}
```

### 2C. Conectar funcionalidad existente

Mantener la lógica de auth existente. Los botones deben llamar las funciones que ya existían (Google OAuth, email auth). Solo cambiar la presentación visual.

---

## PASO 3: ARREGLAR /analyze

### 3A. Layout limpio centrado

```tsx
// src/app/analyze/page.tsx
'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function AnalyzePage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Leyendo transacciones...');
  const inputRef = useRef(null);
  const router = useRouter();

  const messages = [
    'Leyendo transacciones...',
    'Detectando patrones...',
    'Categorizando gastos...',
    'Identificando fugas de dinero...',
    'Generando insights...'
  ];

  const handleFile = (f: File) => {
    setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    
    // Simular progreso con mensajes
    for (let i = 0; i < messages.length; i++) {
      setLoadingMsg(messages[i]);
      setProgress(((i + 1) / messages.length) * 100);
      await new Promise(r => setTimeout(r, 1200));
    }
    
    // CRÍTICO: redirigir a /analyze/results, NO a /login
    router.push('/analyze/results');
  };

  return (
    
      
        
        {/* Logo */}
        
        
        {/* Título */}
        
          Analiza tu estado de cuenta
        
        
          Sube PDF o CSV de tu banco · Sin registro
        

        {!loading ? (
          <>
            {/* Dropzone */}
            <div 
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
              }}
              className="w-full border-2 border-dashed border-white/20 rounded-2xl p-12 cursor-pointer hover:border-[#FF8700] hover:bg-white/5 transition-all"
            >
              <input 
                ref={inputRef}
                type="file" 
                accept=".pdf,.csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              
              
                
                  
                    
                  
                
                
                  {file ? file.name : 'Arrastra tu archivo o haz clic'}
                
                PDF o CSV · max 10MB
              
            

            {file && (
              
                Analizar gratis →
              
            )}

            
              🔒 Tus datos son privados. No los compartimos.
            
          </>
        ) : (
          /* Loading state */
          
            
              
            
            
              {loadingMsg}
            
          
        )}
      
    
  );
}
```

### 3B. Crear pantalla de RESULTADOS (WOW MOMENT)

Esta es nueva — antes no existía. Es el corazón del MVP:

```tsx
// src/app/analyze/results/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ResultsPage() {
  const router = useRouter();
  
  // TODO: estos datos vendrán de la API real - por ahora MOCK para que se vea el WOW
  const insights = {
    mainInsight: { amount: 4200, category: 'comida', percentage: 35 },
    topLeaks: [
      { name: 'Uber Eats', amount: 1200 },
      { name: 'Rappi', amount: 900 },
      { name: 'OXXO', amount: 600 }
    ],
    recommendation: { action: 'Reducir Uber 30%', savings: 360 },
    categories: [
      { name: 'Comida', amount: 4200, color: '#FF8700' },
      { name: 'Transporte', amount: 2100, color: '#FFB366' },
      { name: 'Entretenimiento', amount: 1500, color: '#FFD9B3' },
      { name: 'Servicios', amount: 1100, color: '#666' },
      { name: 'Otros', amount: 800, color: '#333' }
    ]
  };

  const total = insights.categories.reduce((s, c) => s + c.amount, 0);

  return (
    
      
        
        {/* Header */}
        
          
          <button 
            onClick={() => router.push('/login')}
            className="text-sm text-white/60 hover:text-white"
          >
            Guardar análisis →
          
        

        {/* Main insight */}
        
          INSIGHT PRINCIPAL
          
            Gastaste ${insights.mainInsight.amount.toLocaleString()} en {insights.mainInsight.category} este mes
          
          
            Eso es el {insights.mainInsight.percentage}% de tus ingresos
          
        

        {/* Top fugas */}
        
          
            🔥 Top 3 fugas de dinero
          
          
            {insights.topLeaks.map((leak, i) => (
              
                
                  #{i+1}
                  {leak.name}
                
                ${leak.amount.toLocaleString()}
              
            ))}
          
        

        {/* Recomendación */}
        
          💡 Recomendación
          
            Si reduces Uber 30%, ahorras ${insights.recommendation.savings}/mes
          
        

        {/* Gráfica simple por categorías (barras horizontales) */}
        
          
            Gastos por categoría
          
          
            {insights.categories.map((cat) => {
              const pct = (cat.amount / total) * 100;
              return (
                
                  
                    {cat.name}
                    ${cat.amount.toLocaleString()}
                  
                  
                    
                  
                
              );
            })}
          
        

        {/* CTA - guardar análisis */}
        
          
            ¿Quieres ver más insights?
          
          
            Crea tu cuenta gratis para guardar este análisis y ver predicciones de flujo
          
          <button 
            onClick={() => router.push('/login')}
            className="bg-[#FF8700] hover:bg-[#FF9933] text-white font-semibold px-8 py-3 rounded-full"
          >
            Crear cuenta gratis
          
          
            O <button onClick={() => router.push('/analyze')} className="underline">analizar otro estado de cuenta
          
        
      
    
  );
}
```

---

## PASO 4: EXCLUIR DOCK "N" DE RUTAS PÚBLICAS

El dock flotante "N" (círculo en esquina inferior izquierda) debe aparecer SOLO en rutas autenticadas.

### 4A. Encontrar el componente del dock

```bash
grep -r "fixed.*bottom" src/ --include="*.tsx" | grep -v node_modules | head -10
grep -r "bottom-nav\|BottomNav\|FloatingDock" src/ --include="*.tsx" | head -10
```

Buscar el componente que renderiza el círculo con "N".

### 4B. Condicionarlo por ruta

En el layout que renderiza el dock, agregar:

```tsx
'use client';
import { usePathname } from 'next/navigation';

const pathname = usePathname();
const publicRoutes = ['/', '/analyze', '/analyze/results', '/login', '/privacy', '/terms'];
const isPublicRoute = publicRoutes.some(r => pathname === r || pathname.startsWith('/analyze'));

// En el JSX:
{!isPublicRoute && }
```

**Alternativa más limpia (recomendada)**: usar route groups de Next.js.
````

src/app/ ├── (public)/ ← layout SIN dock │ ├── layout.tsx │ ├── page.tsx (landing) │ ├── analyze/ │ └── login/ ├── (app)/ ← layout CON dock (actual) │ ├── layout.tsx │ ├── dashboard/ │ ├── finanzas/ │ └── ... └── layout.tsx (root, sin dock)

````

---

## PASO 5: FIX DE TYPOS Y ACENTOS

Buscar y corregir en TODA la landing y rutas nuevas:

| Mal | Bien |
|-----|------|
| `Iniciar sesion` | `Iniciar sesión` |
| `que se va tu dinero` | `qué se va tu dinero` |
| `Como funciona` | `Cómo funciona` |
| `automatico` | `automático` |
| `graficas` | `gráficas` |
| `Subelo y sabras` | `Súbelo y sabrás` |
| `en que gastas` | `en qué gastas` |

---

## PASO 6: AJUSTAR COLORES DE LANDING

En `src/app/page.tsx`:

1. **Span del título** (`Ve en qué gastas en segundos`):
   - Actualmente: `text-orange-500` o color naranja muy bright
   - Cambiar a: `text-white` o `style={{color: '#FF8700'}}` para coincidir con el logo

2. **Logo de la landing** (top y footer):
   - El SVG real ya tiene fondo negro embebido. Si choca con el background de la landing, considerar usar el `nva-icon.svg` (cuadrado) en lugar del logo rectangular en algunos casos.

3. **Background de la landing**:
   - Mantener `bg-black` puro
   - Opcionalmente agregar el mismo gradiente del dashboard arriba para coherencia visual:
```tsx
     <div style={{background: 'linear-gradient(180deg, #FF6600 0%, #000000 30%, #000000 100%)'}}>
```

---

## PASO 7: VALIDACIÓN VISUAL

Después de aplicar TODOS los cambios, verificar manualmente:

### `/` (landing):
- [ ] Logo NVA arriba: rectángulo negro con "NV" blanco + "A" naranja (NO verde)
- [ ] Botón "Subir estado de cuenta gratis" naranja con buen padding
- [ ] Cards "Antes" / "Con NVA" se ven bien
- [ ] Pasos 1-2-3 con círculos naranjas
- [ ] **NO hay dock "N"** flotante en esquina inferior izquierda
- [ ] Footer con logo correcto
- [ ] Sin typos: "qué", "Cómo", "automático"

### `/analyze`:
- [ ] Layout centrado vertical y horizontalmente
- [ ] Logo NVA real arriba (no verde)
- [ ] Dropzone con borde dashed COMPLETO (no roto)
- [ ] Icon de upload visible (flecha arriba en círculo)
- [ ] Botón "Analizar gratis" aparece tras seleccionar archivo
- [ ] Loading muestra mensajes dinámicos cambiando
- [ ] Al terminar redirige a `/analyze/results` (NO a `/login`)
- [ ] **NO hay dock "N"**

### `/analyze/results`:
- [ ] Insight principal con número grande y color naranja
- [ ] Top 3 fugas en cards
- [ ] Recomendación verde con el ahorro
- [ ] Gráfica de barras por categoría
- [ ] CTA al final para crear cuenta
- [ ] **NO hay dock "N"**

### `/login`:
- [ ] Background gradiente naranja → negro (NO sunburst rays)
- [ ] Icon NVA real arriba (cuadrado negro con "NVA" + A naranja, NO cuadrado verde con N)
- [ ] Layout estilo World App: padding top generoso, contenido alineado a izquierda
- [ ] Checkbox de términos visible
- [ ] Dos botones grandes ("Nueva cuenta" / "Cuenta existente") con border y card style
- [ ] **NO hay dock "N"**

### `/dashboard`:
- [ ] Sigue funcionando igual que antes (con dock "N" abajo)
- [ ] No se rompió nada

---

## RESTRICCIONES

- ✅ SVGs reales: usar EXACTAMENTE el contenido provisto en PASO 1
- ✅ Background del login: `linear-gradient(180deg, #FF6600 0%, #000000 50%, #000000 100%)`
- ✅ Naranja oficial NVA: `#FF8700`
- ✅ Mantener Tailwind utilities (ya funcionan)
- ❌ NO cambiar la lógica de auth existente (solo presentación)
- ❌ NO modificar parsers ni Supabase queries
- ❌ NO tocar /dashboard ni rutas autenticadas existentes
- ❌ NO usar cuadrados verdes ni "N" sola como logo

---

## REPORTE FINAL

Al terminar, reportar:

1. ✅/❌ Cada checkpoint del PASO 7
2. Lista de archivos modificados
3. Lista de archivos creados
4. Si hay algún `grep "FINN"` que aún devuelva resultados, listarlos
5. Confirmar con `head -3 public/nva-logo.svg` que el SVG correcto está instalado (debe contener `viewBox="0 0 800 300"` y `fill:#FF8700`)
````