/**
 * Demo dataset — the content every demo tester gets in their own account.
 *
 * Transactions come from `seed-transactions.js`, produced by
 * `scripts/seed/build-demo-seed.mjs` out of real Mexican bank statements
 * (BBVA débito + crédito, Nu, Citibanamex, Inbursa, Scotiabank), fully
 * anonymized. Portfolio, budgets and reminders below are hand-written.
 *
 * Every date is stored as `dayOffset` (days *before* the seeding moment) so the
 * whole history rebases onto "today" at seed time and the demo never looks
 * stale — dashboard period filters (Este mes / 3 meses) always have data.
 * Negative offsets are future dates, used for upcoming reminders.
 */
import TRANSACTIONS from './seed-transactions.js';

/** Demo users live on this subdomain — it is how cleanup identifies them. */
export const DEMO_EMAIL_DOMAIN = 'demo.nva.lat';

/** Portfolio positions. avg_buy_price is USD; live prices come from Yahoo/CoinGecko. */
export const DEMO_PORTFOLIO = [
    { ticker: 'BTC',   category: 'Crypto', quantity: 0.045, avg_buy_price: 61200, dayOffset: 540 },
    { ticker: 'ETH',   category: 'Crypto', quantity: 0.8,   avg_buy_price: 2450,  dayOffset: 420 },
    { ticker: 'SOL',   category: 'Crypto', quantity: 12,    avg_buy_price: 98.4,  dayOffset: 310 },
    { ticker: 'AAPL',  category: 'Stock',  quantity: 15,    avg_buy_price: 178.4, dayOffset: 620 },
    { ticker: 'NVDA',  category: 'Stock',  quantity: 8,     avg_buy_price: 112.3, dayOffset: 380 },
    { ticker: 'MSFT',  category: 'Stock',  quantity: 5,     avg_buy_price: 402.1, dayOffset: 275 },
    { ticker: 'GOOGL', category: 'Stock',  quantity: 10,    avg_buy_price: 158.9, dayOffset: 190 },
    { ticker: 'VOO',   category: 'ETF',    quantity: 10,    avg_buy_price: 455.2, dayOffset: 500 },
    { ticker: 'QQQ',   category: 'ETF',    quantity: 6,     avg_buy_price: 431.7, dayOffset: 330 },
    { ticker: 'BND',   category: 'Bono',   quantity: 25,    avg_buy_price: 72.8,  dayOffset: 240 },
    { ticker: 'O',     category: 'REIT',   quantity: 30,    avg_buy_price: 54.2,  dayOffset: 155 },
];

/** Savings goals, with the payments already made toward each one. */
export const DEMO_BUDGETS = [
    {
        name: 'Fondo de emergencia', target_amount: 60000, color: '#22c55e', icon: '🌱',
        description: '6 meses de gastos fijos.',
        payments: [
            { amount: 8000, dayOffset: 320, note: 'Aportación inicial' },
            { amount: 5000, dayOffset: 260, note: null },
            { amount: 5000, dayOffset: 200, note: null },
            { amount: 6500, dayOffset: 140, note: 'Aguinaldo' },
            { amount: 5000, dayOffset: 80,  note: null },
            { amount: 5000, dayOffset: 20,  note: null },
        ],
    },
    {
        name: 'Viaje a Japón', target_amount: 45000, color: '#ec4899', icon: '✈️',
        description: 'Vuelo + hospedaje 12 días.',
        payments: [
            { amount: 6000, dayOffset: 210, note: 'Vuelo apartado' },
            { amount: 4500, dayOffset: 150, note: null },
            { amount: 4500, dayOffset: 90,  note: null },
            { amount: 3000, dayOffset: 30,  note: null },
        ],
    },
    {
        name: 'MacBook Pro', target_amount: 38000, color: '#3b82f6', icon: '💻',
        description: 'Reemplazo de la laptop de trabajo.',
        payments: [
            { amount: 7000, dayOffset: 120, note: null },
            { amount: 7000, dayOffset: 60,  note: null },
            { amount: 9000, dayOffset: 15,  note: 'Venta de la laptop vieja' },
        ],
    },
    {
        name: 'Enganche auto', target_amount: 120000, color: '#FF7A1A', icon: '🚗',
        description: '20% de enganche.',
        payments: [
            { amount: 15000, dayOffset: 240, note: null },
            { amount: 12000, dayOffset: 165, note: null },
            { amount: 12000, dayOffset: 95,  note: null },
        ],
    },
];

/**
 * Reminders. Negative dayOffset = upcoming. `budgetName` links a reminder to a
 * savings goal so completing it registers a payment (the app's own behaviour).
 */
export const DEMO_REMINDERS = [
    { title: 'Pago tarjeta BBVA', description: 'Fecha límite de pago', dayOffset: -4,  time: '09:00', color: '#ef4444', repeat_monthly: true,  amount: 8450,  completed: false },
    { title: 'Renta',            description: null,                    dayOffset: -9,  time: '10:00', color: '#FF7A1A', repeat_monthly: true,  amount: 12000, completed: false },
    { title: 'Internet Totalplay', description: null,                  dayOffset: -14, time: null,    color: '#06b6d4', repeat_monthly: true,  amount: 649,   completed: false },
    { title: 'Aportación fondo de emergencia', description: 'Transferencia mensual', dayOffset: -18, time: null, color: '#22c55e', repeat_monthly: true, amount: 5000, completed: false, budgetName: 'Fondo de emergencia' },
    { title: 'Seguro del auto',  description: 'Pago semestral',        dayOffset: -26, time: null,    color: '#a855f7', repeat_monthly: false, amount: 6800,  completed: false },
    { title: 'Revisión de suscripciones', description: 'Cancelar lo que no uso', dayOffset: -31, time: '18:00', color: '#f59e0b', repeat_monthly: false, amount: null, completed: false },
    { title: 'Pago tarjeta BBVA', description: 'Fecha límite de pago', dayOffset: 26,  time: '09:00', color: '#ef4444', repeat_monthly: true,  amount: 7980,  completed: true },
    { title: 'Renta',            description: null,                    dayOffset: 21,  time: '10:00', color: '#FF7A1A', repeat_monthly: true,  amount: 12000, completed: true },
];

const DAY_MS = 86400000;

/** dayOffset → 'YYYY-MM-DD', counted back from `now`. */
function dateFor(dayOffset, now) {
    return new Date(now - dayOffset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Materialize the full dataset for one demo user.
 *
 * `budgets` come back as { budget, payments } pairs because budget_payments
 * need the budget's generated id — the caller inserts the budgets first, then
 * the payments with the returned ids. Same for reminders linked to a budget.
 *
 * @param {string} userId
 * @param {number} [now] epoch ms to rebase every date onto
 */
export function buildDemoSeed(userId, now = Date.now()) {
    return {
        transactions: TRANSACTIONS.map(t => ({
            date: dateFor(t.dayOffset, now),
            concept: t.concept,
            amount: t.amount,
            type: t.type,
            client: 'N/A',
            categoria: t.categoria,
            account_type: t.account_type,
            bank: t.bank,
            user_id: userId,
        })),

        portfolio: DEMO_PORTFOLIO.map(a => ({
            ticker: a.ticker,
            category: a.category,
            quantity: a.quantity,
            avg_buy_price: a.avg_buy_price,
            buy_date: dateFor(a.dayOffset, now),
            user_id: userId,
        })),

        budgets: DEMO_BUDGETS.map(b => ({
            budget: {
                user_id: userId,
                name: b.name,
                target_amount: b.target_amount,
                color: b.color,
                icon: b.icon,
                description: b.description,
            },
            payments: b.payments.map(p => ({
                user_id: userId,
                amount: p.amount,
                date: dateFor(p.dayOffset, now),
                note: p.note,
            })),
        })),

        reminders: DEMO_REMINDERS.map(r => ({
            row: {
                user_id: userId,
                title: r.title,
                description: r.description,
                date: dateFor(r.dayOffset, now),
                time: r.time,
                color: r.color,
                repeat_monthly: r.repeat_monthly,
                amount: r.amount,
                completed: r.completed,
            },
            budgetName: r.budgetName ?? null,
        })),
    };
}

/** Row counts, for the API response and logs. */
export const DEMO_COUNTS = {
    transactions: TRANSACTIONS.length,
    portfolio: DEMO_PORTFOLIO.length,
    budgets: DEMO_BUDGETS.length,
    payments: DEMO_BUDGETS.reduce((s, b) => s + b.payments.length, 0),
    reminders: DEMO_REMINDERS.length,
};
