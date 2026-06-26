#!/usr/bin/env node
/**
 * @capacitor-community/apple-sign-in (latest 7.1.0) pins its native
 * capacitor-swift-pm dependency to `from: "7.0.0"` (i.e. 7.x only), which
 * conflicts with the Capacitor 8 core plugins. There is no Capacitor 8
 * release of the plugin yet, so we bump its SPM dependency to 8.0.0. The
 * Sign in with Apple plugin uses only stable CAPPlugin APIs that are
 * unchanged between Capacitor 7 and 8, so it compiles and runs fine.
 *
 * Runs on postinstall — node_modules edits are otherwise wiped by npm install.
 * Idempotent: a no-op once already patched.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(
    __dirname,
    '..',
    'node_modules/@capacitor-community/apple-sign-in/Package.swift'
);

if (!fs.existsSync(FILE)) process.exit(0); // plugin not installed — nothing to do

const before = fs.readFileSync(FILE, 'utf-8');
const after = before.replace(
    'capacitor-swift-pm.git", from: "7.0.0"',
    'capacitor-swift-pm.git", from: "8.0.0"'
);

if (after !== before) {
    fs.writeFileSync(FILE, after, 'utf-8');
    console.log('[patch-apple-signin] bumped capacitor-swift-pm to 8.0.0');
}
