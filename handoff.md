# Session Handoff — 2026-06-13 (Session 3)

## Goal
Fix Apple App Store review rejections (builds 4 & 5) + native app improvements.

## Current State: PENDING FIXES

Build 5 (1.0) was rejected again with 2 new issues. Previous issues (camera crash, browser redirect, Sign in with Apple) are resolved.

### What was fixed this session

1. **CFBundleName "App" → "Nva"** — iOS auth dialog showed "App quiere utilizar supabase.co". Changed `CFBundleName` in Info.plist from `$(PRODUCT_NAME)` to `Nva`. Dialog now says "Nva".

2. **iPad camera crash (Guideline 2.1)** — `<input type="file">` in WKWebView crashes on iPad when selecting "Take Photo" (missing `popoverPresentationController` sourceView). Fix: native photo picker via `__nvaPickPhoto` title KVO command. Swift handles `UIImagePickerController` with proper iPad popover config. Image resized to 512px max, returned as JPEG data URL via `window.__nvaPhotoResult`. Profile page detects native and uses button instead of file input.

3. **Portfolio disconnected from live prices** — Native app fetched `https://www.nva.lat/api/price` and `/api/crypto` without auth token. Cookies don't cross origins. API returned "No autorizado." Fix: added Bearer token from `supabase.auth.getSession()` to fetch headers when `API_BASE` is set (native only). Fixed in 3 files: portfolio page, CardPortfolio dashboard component, dashboard page.

4. **Build number bump** — `CURRENT_PROJECT_VERSION` 1 → 5 in pbxproj (both Debug and Release configs).

### What was NOT fixed (Apple still blocking)

**Guideline 4 — Sign in with Apple name collection (Build 5 rejection)**
- Onboarding Step 3 asks "¿Cómo te llamas?" after Apple Sign In
- Apple says name is already provided via `ASAuthorizationAppleIDCredential.fullName`
- **Fix needed:** Pre-fill name from `user_metadata` (Apple provides `full_name` via Supabase). Skip step if name already exists.
- File: `src/app/onboarding/page.js` → `StepName` component (line ~229)

**Guideline 3.1.1 — In-App Purchase required (Build 5 rejection)**
- App uses Stripe ($99 MXN one-time) for payment — not allowed on iOS App Store
- Must use StoreKit In-App Purchase for iOS, OR skip paywall on native
- Options:
  - **A) StoreKit IAP** — Full implementation, Apple takes 30%. Need: App Store Connect IAP product, StoreKit Swift code, receipt validation server-side.
  - **B) Skip paywall on native** — `isNativeApp()` already exists in paywall. Auto-skip for native users, monetize web only. Simplest.
  - **C) Free with limits on native** — Limited free tier, external link to web for payment (Apple now allows for US storefront).
- Files: `src/app/paywall/page.js`, `src/app/onboarding/page.js` (StepPlans)

## Key Files Modified This Session

| File | What changed |
|------|-------------|
| `ios/App/App/Info.plist` | `CFBundleName` → "Nva" |
| `ios/App/CustomBridgeViewController.swift` | Native photo picker (`handlePickPhoto`, `presentImagePicker`, `UIImagePickerControllerDelegate`) |
| `ios/App/App/CustomBridgeViewController.swift` | Synced copy of above |
| `ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` 1 → 5 |
| `src/app/perfil/page.js` | Native photo picker via `__nvaPickPhoto`, button instead of file input |
| `src/app/portfolio/page.js` | Bearer token on `fetchPrices` for native |
| `src/app/dashboard/components/CardPortfolio.js` | Bearer token on `fetchPrices` for native |
| `src/app/dashboard/page.js` | Bearer token on portfolio price fetches for native |

## Critical Gotchas (carried forward + new)

1. **Xcode compiles `ios/App/CustomBridgeViewController.swift`** (root), NOT `ios/App/App/CustomBridgeViewController.swift`. Always edit both or sync with `cp`.

2. **`www.nva.lat` not `nva.lat`** — `nva.lat` returns 307 redirect, URLSession drops Authorization header on redirect.

3. **Token must go via `window.__nvaUploadToken`** — NOT via `document.title`. Title KVO corrupts JWT tokens.

4. **Capacitor static export uses `.html` extensions** — `out/login.html` not `out/login/index.html`. Always use `router.replace()` not `window.location.replace()`.

5. **`cap sync` only copies web assets** — Swift changes only need Xcode Clean + Run.

6. **Native app JS changes require full rebuild** — `bash scripts/build-capacitor.sh` + `npx cap sync ios` + Xcode Clean Build.

7. **Native fetch to prod API needs Bearer token** — Cookies don't work cross-origin from `capacitor://localhost`. Always include `Authorization: Bearer <token>` header when `API_BASE` is set.

8. **iPad requires `popoverPresentationController`** — Any `UIAlertController` (.actionSheet) or `UIImagePickerController` (.photoLibrary) must set `sourceView`/`sourceRect` on iPad or it crashes.

9. **`supabase.co` in iOS auth dialog** — Cannot be changed on Supabase free plan. Requires Pro plan + custom domain.

10. **Apple Sign In provides name** — `ASAuthorizationAppleIDCredential.fullName` → Supabase stores in `user_metadata`. Don't re-ask in onboarding.

## Architecture Notes

- **Native bridge pattern:** JS sets `document.title` to `__nva<Command>:<payload>`, Swift KVO picks it up, processes natively, returns result via `window.__nva<Callback>()`.
- **Commands:** `__nvaOAuth:`, `__nvaAppleSignIn:`, `__nvaUpload:`, `__nvaPickPhoto`
- **Auth in native:** Use `supabase.auth.getSession()` → `session.access_token` → Bearer header for all API calls to `www.nva.lat`.

## Next Steps (Priority Order)

1. **Fix onboarding name step** — Pre-fill from Apple metadata, skip if name exists. Quick fix.

2. **Decide payment strategy for iOS** — StoreKit IAP vs skip paywall vs free tier. This blocks App Store approval.

3. **Implement chosen payment strategy** — If StoreKit: need IAP product in App Store Connect, Swift StoreKit code, server receipt validation. If skip: simple `isNativeApp()` check.

4. **Bump build to 6, rebuild, resubmit.**

5. **Unresolved from previous sessions:**
   - Account deletion testing (needs `SUPABASE_SERVICE_ROLE_KEY`)
   - Verify `subscription_status` for paid users in native
   - Clear stale `anon_rate_limits` if testing anon flow

## Previous Session Commits (Session 2)

```
c1d5e28 fix: robust JSON extraction + auth token refresh for native uploads
96449d9 debug: add auth diagnostic logging to analyze endpoint
47a8d8a debug: log JWT structure details for auth diagnosis
afc9e26 fix: read auth token from JS global instead of document.title
c992462 chore: cleanup debug logging + update prod URL
3731055 fix: responsive card layout for import review on mobile
6fdb07d fix: center NVA logo in app icon and splash screen
a1c6725 fix: update web favicon with centered NVA logo
659dfa4..a184a58 fix: zero-flash native redirect (multiple attempts, final working)
```

## Session 4 — Suscripción $99/mes + 150 gratis (StoreKit + Stripe)

Modelo de pago: $99 pago único → **$99 MXN/mes suscripción**. Primeros 150 que completan onboarding = **gratis vitalicio**. iOS = StoreKit IAP, web = Stripe subscription mode.

### Código implementado (build verde)
- `src/lib/access.js` — helper `hasAccess(meta)` (status free/active/expired + expiry+grace 24h). Reemplaza `=== 'active'` en middleware, paywall, login, success, onboarding.
- `src/lib/iap.js` — bridge cliente StoreKit (`isNativeApp`, `nativePurchase`, `nativeRestore` → POST /api/iap/verify).
- `src/lib/stripeSync.js` — `applyStripeSubscription` (mapea sub Stripe → metadata + subscriptions).
- `src/lib/appleIap.js` — verifica JWS con `@apple/app-store-server-library`, `applyAppleSubscription`, `findUserByOriginalTxId`.
- `src/app/api/access/claim/route.js` — reclama slot gratis (RPC atómica).
- `src/app/api/iap/verify/route.js` + `src/app/api/iap/notifications/route.js` (notifications en isPublic).
- Stripe `create-checkout` → `mode:'subscription'` + `subscription_data.metadata`. `webhook` maneja customer.subscription.* + invoice.paid. `verify-session` lee subscription.
- `supabase-free-grants.sql` (tabla + `claim_free_slot`) + `supabase-subscriptions.sql` (columnas v2).
- Swift: `__nvaPurchase` / `__nvaRestorePurchases` + `Transaction.updates` listener en AMBOS CustomBridgeViewController.swift. Product `lat.nva.app.sub.monthly`.
- **Reparé** corrupción en `ios/App/CustomBridgeViewController.swift` línea 231 (texto basura que rompía compilación) — copiado del clean App/App.
- Build number 5 → 6.

### PENDIENTE manual (bloquea funcionamiento)
1. **Correr SQL en Supabase**: `supabase-free-grants.sql` + re-correr `supabase-subscriptions.sql` (columnas nuevas).
2. **Stripe**: cambiar `STRIPE_PRICE_ID` a un precio **recurrente mensual** ($99 MXN/mes). Configurar eventos del webhook: `customer.subscription.created/updated/deleted`, `invoice.paid`.
3. **App Store Connect**: crear suscripción auto-renovable `lat.nva.app.sub.monthly` (~$99 MXN/mes); In-App Purchase Key (.p8); App Store Server Notifications V2 → `https://www.nva.lat/api/iap/notifications`; capability In-App Purchase en target Xcode.
4. **Env vars prod**: `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY` (.p8), `APPLE_BUNDLE_ID=lat.nva.app`, `APPLE_APP_APPLE_ID`, `APPLE_SUB_PRODUCT_ID` (opcional). Apple root CAs: `apple-certs/*.cer` o `APPLE_ROOT_CAS` (base64 CSV) — descargar de apple.com/certificateauthority.
5. **Rebuild iOS**: `bash scripts/build-capacitor.sh` + `npx cap sync ios` + Xcode Clean Build, resubmit build 6.

### Plan completo
`/Users/leonardo/.claude/plans/si-pero-aqui-esta-staged-wand.md`

## Session 3 Changes (uncommitted)

- Info.plist CFBundleName
- Native photo picker (Swift + JS)
- Bearer token on price fetches (3 files)
- Build number bump to 5
