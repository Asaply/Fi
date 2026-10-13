// Domain constants for bank sync. Shared by Edge Functions, the app and tests.
export const MAX_LINKS_PER_USER = 5;
export const SYNC_COOLDOWN_SECONDS = 600;
export const OVERLAP_DAYS = 3;
export const INITIAL_HISTORY_DAYS = 365;
export const TRANSFER_WINDOW_DAYS = 3;
export const TRANSFER_CATEGORY = 'Transferencia entre tus cuentas';

export const LINK_STATUS = Object.freeze({
    SYNCING: 'syncing',
    VALID: 'valid',
    TOKEN_REQUIRED: 'token_required',
    INVALID: 'invalid',
    DISCONNECTED: 'disconnected',
});
