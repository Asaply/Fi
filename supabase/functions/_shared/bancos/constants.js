// Domain constants for bank sync. Shared by Edge Functions, the app and tests.
export const MAX_LINKS_PER_USER = 5;
export const SYNC_COOLDOWN_SECONDS = 600;
export const OVERLAP_DAYS = 3;
export const INITIAL_HISTORY_DAYS = 365;
export const TRANSFER_WINDOW_DAYS = 3;
export const TRANSFER_CATEGORY = 'Transferencia entre tus cuentas';
// Cap on rows sent to the AI per sync, so a 12-month first sync fits the Edge
// Function wall clock. The rest stay in "Otros" and are retried on later syncs.
export const AI_MAX_ROWS_PER_SYNC = 200;

export const LINK_STATUS = Object.freeze({
    SYNCING: 'syncing',
    VALID: 'valid',
    TOKEN_REQUIRED: 'token_required',
    INVALID: 'invalid',
    DISCONNECTED: 'disconnected',
});
