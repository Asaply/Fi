#!/bin/bash
# Build static export for Capacitor, temporarily hiding server-only routes
set -e

cd "$(dirname "$0")/.."

# Files incompatible with output: 'export'
SERVER_FILES=(
    src/app/api/analyze/route.js
    src/app/api/belvo/token/route.js
    src/app/api/belvo/transactions/route.js
    src/app/api/crypto/route.js
    src/app/api/price/route.js
    src/app/api/stripe/create-checkout/route.js
    src/app/api/stripe/verify-session/route.js
    src/app/api/stripe/webhook/route.js
    src/app/auth/callback/route.js
    src/app/api/account/route.js
    src/app/opengraph-image.js
)

restore() {
    for f in "${SERVER_FILES[@]}"; do
        [ -f "${f}.capsave" ] && mv "${f}.capsave" "$f"
    done
}
trap restore EXIT

for f in "${SERVER_FILES[@]}"; do
    [ -f "$f" ] && mv "$f" "${f}.capsave"
done

CAPACITOR=1 NEXT_PUBLIC_API_BASE=https://www.nva.lat npx next build

# Replace landing page with instant redirect to /login for native app
cat > out/index.html << 'REDIR'
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=/login.html">
<style>html{background:#000}</style>
<script>window.location.replace('/login.html');</script>
</head><body></body></html>
REDIR

npx cap copy ios

echo "✅ Capacitor build + copy done"
