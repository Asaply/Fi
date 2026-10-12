## Qué cambia

<!-- 1-3 líneas. Enlaza el issue: "Cierra #123" -->

## Capturas

<!-- Cambios visuales: antes / después, desktop y móvil (375px). -->

## Checklist

- [ ] Rama actualizada con `main` (`git fetch && git rebase origin/main`)
- [ ] `npm run build` pasa sin errores
- [ ] `npm run lint` sin errores nuevos
- [ ] Probado en el preview de Vercel, desktop y móvil
- [ ] No toca zonas del mantenedor (`src/lib/`, `src/app/api/`, `middleware.ts`, `*.sql`, `ios/`, `package.json`) — o está explicado abajo
- [ ] No cambia queries de Supabase ni lógica de datos — o está explicado abajo
- [ ] Sin llaves, `.env` ni datos reales de usuarios en el diff

## Notas para el review

<!-- Algo que el revisor deba saber: archivos compartidos tocados (globals.css, layout.js, Sidebar, BottomNav), dudas, pendientes. -->
