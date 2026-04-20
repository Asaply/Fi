cat > fix-css-break.md << 'EOF'
# FNCE — Fix CSS Roto

## Problema
Tailwind dejó de aplicar estilos. La app se ve sin CSS.

## Diagnóstico
El prompt v1-design-polish.md probablemente modificó globals.css de forma incorrecta,
rompiendo el @tailwind directives o el import en layout.tsx.

## Fix

### 1. Verificar globals.css — debe empezar con:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
Si no están estas 3 líneas al inicio, agregarlas.

### 2. Verificar layout.tsx — debe importar globals.css:
```tsx
import './globals.css'
```
Si el import no está, agregarlo.

### 3. Verificar tailwind.config.ts — el campo content debe incluir:
```ts
content: [
  './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  './src/app/**/*.{js,ts,jsx,tsx,mdx}',
],
```

### 4. Las variables CSS del design-polish deben ir DESPUÉS de @tailwind utilities:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-base: #0c0c0e;
  /* ... resto de variables */
}
```

### 5. Después de corregir, reiniciar el servidor:
```bash
rm -rf .next
npm run dev
```
EOF