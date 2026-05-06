````markdown
# FIX URGENTE: Landing NVA + Rebrand completo

## CONTEXTO DEL PROBLEMA

El prompt anterior `rebrand-nva-landing.md` se ejecutó pero falló porque:

1. **Tailwind utilities no funcionan** en este proyecto. Las clases como `bg-emerald-600`, `p-4`, `rounded-lg`, `text-5xl` son IGNORADAS. El proyecto usa CSS modules / CSS custom con su propia paleta naranja.

2. **El rebrand FINN → NVA está incompleto**:
   - `/login` todavía muestra "FINN" con logo F naranja antiguo
   - El dock/sidebar muestra una "N" en esquina inferior izquierda sobre la landing
   - El gradiente naranja del dashboard se filtra a la landing (via `.app-layout`)

3. **La landing actual `/` está rota visualmente** — texto sin formato, botones sin estilo, todo apilado en columna sin diseño.

## PASO 1: INVESTIGACIÓN OBLIGATORIA (antes de tocar código)

Antes de modificar nada, ejecutar y reportar:

1. Identificar el sistema de estilos real:
```bash
   ls src/app/*.css src/app/*.module.css
   cat tailwind.config.* 2>/dev/null || echo "No tailwind config"
   cat postcss.config.* 2>/dev/null
   grep -r "import.*\.module\.css" src/app/login/ | head -5
```

2. Leer el login que SÍ funciona visualmente:
   - `src/app/login/page.tsx` (o equivalente)
   - Su archivo `.module.css` asociado
   - Identificar las clases CSS reales usadas (gradient, ray pattern, botones)

3. Leer el layout global:
   - `src/app/layout.tsx`
   - Identificar qué aplica `.app-layout` a TODAS las rutas
   - Detectar el componente sidebar/dock con la "N" flotante

4. **Reportar al usuario** antes de continuar:
   - "¿Sistema de estilos detectado: [CSS Modules / Styled Components / etc]?"
   - "¿Layout global aplica a / (landing)? Sí/No"
   - "¿Dónde está el componente del dock 'N'?"

## PASO 2: REBRAND COMPLETO FINN → NVA

Buscar y reemplazar en TODO `src/`:

```bash
# Buscar todas las referencias a FINN
grep -ri "FINN" src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" --include="*.css" --include="*.json"
grep -ri "Finn" src/ --include="*.tsx" --include="*.ts"
```

Reemplazar cada ocurrencia:
- `FINN` → `NVA`
- `Finn` → `NVA`
- `finn` → `nva` (solo en strings de UI, NO en imports/variables)

Archivos críticos a actualizar:
- `src/app/login/page.tsx` → cambiar título "FINN" a "NVA" y descripción
- Logo del login: reemplazar el "F" naranja con `<Image src="/nva-icon.svg" />` o el logo SVG
- Footer/copyright: "© FINN" → "© NVA"
- Meta tags adicionales si hay

## PASO 3: EXCLUIR LAYOUT GLOBAL DE LA LANDING

El archivo `src/app/layout.tsx` aplica `.app-layout` a TODAS las páginas. Esto causa:
- Gradiente naranja en landing
- Dock "N" flotante en landing
- Estilos del dashboard heredados

**Solución: usar route groups de Next.js**

Reorganizar:
````

src/app/ ├── (marketing)/ ← nuevo route group sin layout global │ ├── layout.tsx ← layout MÍNIMO (solo HTML básico) │ ├── page.tsx ← landing pública (mover desde src/app/page.tsx) │ └── analyze/ │ └── page.tsx ├── (app)/ ← route group con layout actual │ ├── layout.tsx ← contiene <AppLayout> con sidebar/dock │ ├── dashboard/ │ ├── finanzas/ │ ├── trading/ │ └── portfolio/ └── layout.tsx ← root layout sin .app-layout (solo <html><body>)

````

El layout `(marketing)/layout.tsx` debe ser SOLO:
```tsx
export default function MarketingLayout({ children }) {
  return <div className="marketing-wrapper">{children}</div>;
}
```

## PASO 4: REHACER LA LANDING CON EL SISTEMA DE ESTILOS REAL

### Crear `src/app/(marketing)/page.module.css`

Usar la PALETA EXISTENTE del proyecto:
- Naranja principal: `#FF6600` o `#FF8700` (color del logo NVA)
- Negro/zinc oscuro de fondo
- Mismas tipografías que el login

Estructura CSS module básica:
```css
.landing {
  min-height: 100vh;
  background: #000;
  color: white;
  font-family: inherit;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.hero {
  max-width: 800px;
  margin: 0 auto;
  padding: 6rem 2rem;
  text-align: center;
}

.title {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 1.5rem;
}

.titleAccent {
  color: #FF8700;  /* naranja del logo NVA */
}

.subtitle {
  font-size: 1.25rem;
  color: rgba(255,255,255,0.6);
  margin-bottom: 3rem;
}

.cta {
  display: inline-block;
  background: #FF8700;
  color: black;
  font-weight: 600;
  padding: 1rem 2.5rem;
  border-radius: 12px;
  font-size: 1.125rem;
  text-decoration: none;
  transition: transform 0.2s, background 0.2s;
}

.cta:hover {
  background: #FFA033;
  transform: translateY(-2px);
}

.ctaNote {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: rgba(255,255,255,0.4);
}

/* Demo cards (antes/después) */
.demoGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  max-width: 1100px;
  margin: 4rem auto;
  padding: 0 2rem;
}

@media (max-width: 768px) {
  .demoGrid { grid-template-columns: 1fr; }
}

.demoCard {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 2rem;
}

.demoCardActive {
  background: linear-gradient(135deg, rgba(255,135,0,0.1), rgba(255,135,0,0.02));
  border-color: rgba(255,135,0,0.3);
}

/* Steps */
.stepsGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  max-width: 900px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

@media (max-width: 768px) {
  .stepsGrid { grid-template-columns: 1fr; }
}

.stepNumber {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #FF8700;
  color: black;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  margin: 0 auto 1rem;
}

.footer {
  border-top: 1px solid rgba(255,255,255,0.08);
  padding: 3rem 2rem;
  text-align: center;
  color: rgba(255,255,255,0.4);
  font-size: 0.875rem;
}
```

### Reescribir `src/app/(marketing)/page.tsx`

Importar el CSS module y usar las clases correctas:
```tsx
import styles from './page.module.css';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      <nav className={styles.nav}>
        <Image src="/nva-logo.svg" alt="NVA" width={80} height={28} priority />
        <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
      </nav>
      
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Sube tu estado de cuenta.<br />
          <span className={styles.titleAccent}>
            Ve en qué gastas en segundos.
          </span>
        </h1>
        <p className={styles.subtitle}>
          Sin Excel. Sin categorizar manual. Solo sube tu PDF o CSV y listo.
        </p>
        <Link href="/analyze" className={styles.cta}>
          Subir estado de cuenta gratis
        </Link>
        <p className={styles.ctaNote}>
          Sin registro. Resultados en 30 segundos.
        </p>
      </section>

      {/* Demo antes/después */}
      <div className={styles.demoGrid}>
        <div className={styles.demoCard}>
          <h3>Antes (Excel manual)</h3>
          <p>Horas categorizando gastos a mano</p>
        </div>
        <div className={`${styles.demoCard} ${styles.demoCardActive}`}>
          <h3>Con NVA</h3>
          <p style={{fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0'}}>$4,200</p>
          <p>en comida este mes (35% de tus ingresos)</p>
          <p style={{color: '#FFB366', marginTop: '1rem'}}>
            ⚠️ Mayor fuga: Uber Eats ($1,200/mes)
          </p>
        </div>
      </div>

      {/* Cómo funciona */}
      <section>
        <h2 style={{textAlign: 'center', fontSize: '2rem', marginTop: '4rem'}}>
          Cómo funciona
        </h2>
        <div className={styles.stepsGrid}>
          <div style={{textAlign: 'center'}}>
            <div className={styles.stepNumber}>1</div>
            <h3>Sube tu archivo</h3>
            <p>PDF o CSV de Nu, BBVA, Spin</p>
          </div>
          <div style={{textAlign: 'center'}}>
            <div className={styles.stepNumber}>2</div>
            <h3>Espera 30 segundos</h3>
            <p>NVA categoriza automático</p>
          </div>
          <div style={{textAlign: 'center'}}>
            <div className={styles.stepNumber}>3</div>
            <h3>Ve tus insights</h3>
            <p>Fugas de dinero y recomendaciones</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <Image src="/nva-logo.svg" alt="NVA" width={60} height={20} />
        <p>Net Value Analysis © 2025</p>
      </footer>
    </div>
  );
}
```

## PASO 5: VALIDACIÓN VISUAL

Después de aplicar los cambios, verificar manualmente:

1. ✅ `/` muestra landing con:
   - Logo NVA arriba izquierda
   - "Iniciar sesión" arriba derecha
   - Hero centrado con título grande
   - Botón naranja "Subir estado de cuenta gratis" CON estilos
   - Sin gradiente del dashboard
   - SIN dock "N" flotante

2. ✅ `/login` muestra "NVA" (no "FINN")
3. ✅ Logo del login es el de NVA (no F naranja)
4. ✅ `/dashboard` sigue funcionando (con dock/sidebar normal)
5. ✅ El CSS module aplica correctamente (botones tienen forma, color, padding)

## RESTRICCIONES

- ❌ NO usar Tailwind utilities (`bg-emerald-600`, `p-4`, etc.) — NO FUNCIONAN
- ✅ SÍ usar CSS Modules (`.module.css`) o CSS custom
- ✅ SÍ usar la paleta naranja existente (`#FF8700`)
- ❌ NO tocar Supabase queries
- ❌ NO modificar parsers (`bbva-parser.js`, `nu-parser.js`, etc.)
- ❌ NO cambiar lógica de Trading/Portfolio
- ✅ SÍ reorganizar route groups si es necesario

## REPORTE FINAL

Al terminar, reportar:
- Lista de archivos modificados
- Lista de archivos creados (route groups, CSS modules)
- Confirmación visual de cada checkpoint del paso 5
- Cualquier referencia "FINN" que no se haya podido reemplazar (con razón)
````