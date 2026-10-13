// Picks the bank data provider from BANK_PROVIDER. Unknown or unset → null, and
// the handlers answer 503 provider_unavailable. Real adapters (e.g. syncfy.js)
// are added here when integrated.
import { createMockProvider } from './mock.js';

export function getProvider(env) {
    switch (env?.BANK_PROVIDER) {
        case 'mock': return createMockProvider();
        default: return null;
    }
}
