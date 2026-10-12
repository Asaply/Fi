/**
 * Build the demo seed from the real bank statements in "Estados de cuenta statement/".
 *
 * Runs the deterministic parsers (src/lib/statementParser) over each PDF,
 * anonymizes every concept (person names, account/card digits, RFC/CLABE),
 * infers a category with the app's own rules, and writes the result to
 * src/lib/demo/seed-transactions.js.
 *
 * Dates are stored as `dayOffset` — days before the newest movement found —
 * so the seeder can rebase the whole history onto "today" and the demo always
 * looks current (the dashboard period filters stay meaningful).
 *
 * Run:  node scripts/seed/build-demo-seed.mjs
 *
 * Output is a .js module, not .json, so plain `node` scripts
 * (create-demo-accounts.mjs) can import it without import attributes while
 * Next still bundles it normally. It is committed; rerun this only when the
 * source statements or the anonymization rules change. The PDFs themselves are
 * never shipped or read at runtime.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryDeterministicParse } from '../../src/lib/statementParser/index.js';
import { inferirCategoria } from '../../src/lib/categorias.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PDF_DIR = path.join(ROOT, 'Estados de cuenta statement');
const OUT_FILE = path.join(ROOT, 'src/lib/demo/seed-transactions.js');

/* ─────────────────────────── Anonymization ─────────────────────────── */

// Spanish/Mexican given names and surnames. Used only to DETECT a person name
// in a statement concept so it can be swapped for a fictional one.
const NOMBRES = new Set(`
abraham adriana alberto alejandra alejandro alfonso alfredo alicia alma alvaro
amalia ana andrea andres angel angelica antonio araceli arturo aurora beatriz
benjamin bernardo blanca brenda bruno camila carlos carmen catalina cecilia
cesar claudia clara concepcion consuelo cristina cristobal daniel daniela david
diana diego dolores domingo edgar eduardo elena elizabeth eloisa elsa emilio
emiliano enrique erika ernesto esperanza estela esteban esther eugenia eva
fabiola federico felipe fernanda fernando fidel flor francisco gabriel gabriela
gerardo gilberto gloria gonzalo graciela gregorio guadalupe guillermo gustavo
hector helena hilda horacio hugo humberto ignacio irene irma isabel isidro
ismael israel ivan jacinto jaime javier jeronimo jesus joaquin jorge jose
josefina juan juana julia julio karla laura leonardo leticia lidia lorena
lorenzo lucia luis luz magdalena manuel marcela marcos margarita maria mariana
mario marta martha martin mateo mauricio mercedes miguel mireya monica natalia
nicolas noe norberto norma octavio olivia omar oscar pablo paola patricia pedro
pilar rafael ramiro ramon raquel raul rebeca renata ricardo roberto rocio
rodolfo rodrigo rosa rosalia ruben salvador samuel sandra santiago sara sergio
silvia socorro sofia soledad susana teresa tomas valeria veronica vicente
victor victoria virginia yolanda
ada aaron abel adrian agustin aldo alexis alondra anabel anibal axel baltazar
benito bernabe brayan braulio camilo candido carmelo cristian cuauhtemoc dario
dulce edith efrain eleazar elias eliseo eloy elva epifanio evelyn ezequiel
fabian fatima faustino fidencio filiberto florencio fortino gabino genaro
german gisela heriberto hilario homero ilse irvin isela itzel jacobo jazmin
jocelyn joel jonas jonathan josue juvenal karina kevin lazaro leobardo leopoldo
lizbeth lucio macario marcelino mariano maximo mayra melchor moises nayeli
nestor noel obed pascual patricio perla porfirio prudencio refugio remigio
reynaldo roque rosalba rosendo rufino sabino santos saturnino saul sebastian
serafin silvestre simon sixto tadeo teodoro timoteo ubaldo ulises urbano
valentin xochitl yesenia zacarias zulema
acosta aguilar alvarez arellano avila barrera beltran bravo cabrera camacho
campos cardenas carrillo castillo castro cervantes chavez contreras cordero
cortes cruz delgado diaz dominguez duran escobar espinoza esquivel estrada
flores franco fuentes galvan garcia gomez gonzalez guerrero gutierrez guzman
herrera hernandez ibarra jimenez juarez lara leon lopez lozano lugo luna
maldonado marquez martinez medina mejia mendez mendoza miranda molina montes
morales moreno munoz navarro nunez ochoa ojeda olvera ortega ortiz pacheco
padilla palacios pena peralta perez ponce quintero ramirez rangel reyes rios
rivera robles rodriguez rojas romero rosales ruiz salazar salinas sanchez
sandoval santana santiago serrano silva solis soto suarez tapia tellez torres
trejo valdez valencia vargas vazquez vega velazquez villa villarreal zamora
zavala zuniga
altamirano arreola bejarano burrola bustamante carbajal chaparro cisneros
cuellar elizondo fierro galindo gallegos gamboa garza gaytan granados grijalva
hinojosa holguin izaguirre lerma licon loya macias madrid magallanes
manzanares marin marrufo mata melendez meza montoya moya murillo nava nevarez
orozco payan portillo prieto provencio quinonez quiroz ramos renteria rincon
rubio saenz salcido samaniego sepulveda sifuentes talamantes tarango terrazas
tinoco urias valle varela velarde venegas verdugo villegas zubia
`.trim().split(/\s+/));

// Merchant signals: when a multi-word run contains one of these, it is a
// business name (e.g. "FERRE CASA SERGIO MORE", "SUPER FYC GUTIERREZ") and must
// not be masked just because a surname appears inside it.
const MERCHANT_TOKENS = new Set(`
abarrotes abts alsuper autoservicio bar boutique cafe cafeteria carnes
carniceria casa cerveceria clinica com comercial deposito distribuidora dulceria
est farmacia ferre ferreteria fruteria gasol gasolinera grupo hospital hotel
lavanderia licores loncheria market materiales mart merc mercado mini oxxo
panaderia papeleria pizza pizzeria plaza pollos refaccionaria rest restaurant
restaurante servicio servicios super supercenter tacos taller tienda tortilleria
veterinaria wal
`.trim().split(/\s+/));

// Fictional replacements. Deterministic mapping (same real name → same fake
// name across the whole seed) keeps transfer history internally coherent.
const FAKE_NAMES = [
    'Mariana Robles Vidal', 'Andres Quiroga Salas', 'Paulina Serrano Mota',
    'Rodrigo Ibanez Cortes', 'Valeria Nieto Cordova', 'Emilio Tapia Grajeda',
    'Renata Villalba Sosa', 'Damian Ocampo Rivas', 'Ximena Padron Guevara',
    'Ivan Cordero Bustos', 'Regina Alcala Prieto', 'Mauro Estevez Lira',
];
const nameMap = new Map();
function fakeNameFor(realName) {
    const key = realName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!nameMap.has(key)) nameMap.set(key, FAKE_NAMES[nameMap.size % FAKE_NAMES.length]);
    return nameMap.get(key);
}

const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const LETTERS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const WORD_RUN = new RegExp(`[${LETTERS}]{2,}(?:\\s+[${LETTERS}]{2,})+`, 'g');

const norm = (t) => stripAccents(t).toLowerCase();
const isNameToken = (t) => { const w = norm(t); return w.length >= 3 && NOMBRES.has(w); };
const isMerchantToken = (t) => {
    const w = norm(t);
    return MERCHANT_TOKENS.has(w) || [...MERCHANT_TOKENS].some(m => m.length >= 4 && w.includes(m));
};

// Names long enough to be safe as substrings inside a run-together token.
const LONG_NAMES = [...NOMBRES].filter(n => n.length >= 5);

/**
 * Replace runs of 2+ alphabetic words that look like a person's name.
 *
 * Two rules, both skipped when the run names a business:
 *   - 2+ known name words  → "BLANCA ESTELA CARDENAS RODRIGUEZ", "Ada Karina Leon Jimenez"
 *   - 3+ words, 1 known    → "Anabel Burrola Chavez pastel" (partial lists still catch it)
 *
 * "FERRE CASA SERGIO MORE" and "SUPER FYC GUTIERREZ" survive via MERCHANT_TOKENS.
 */
function maskPersonNames(concept) {
    return concept.replace(WORD_RUN, (run) => {
        const words = run.split(/\s+/);
        if (words.some(isMerchantToken)) return run;
        const hits = words.filter(isNameToken).length;
        const isPerson = hits >= 2 || (words.length >= 3 && hits >= 1);
        return isPerson ? fakeNameFor(run) : run;
    });
}

/**
 * Statement processors squash a payee's full name into one token
 * ("MERPAGO*CARLOSEDUARDO", "ZTL*IRVINABELMENDOZATA"). A long all-letter token
 * carrying a known name inside it is one of those, never a merchant.
 */
function maskRunTogetherNames(concept) {
    return concept.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{12,}/g, (token) => {
        if (isMerchantToken(token)) return token;
        const w = norm(token);
        return LONG_NAMES.some(n => w.includes(n)) ? fakeNameFor(token) : token;
    });
}

/** Strip identifiers: card/account tails, RFC, CLABE, long reference numbers. */
function stripIdentifiers(concept) {
    return concept
        // CLABE (18 digits) / account / card / reference runs
        .replace(/\b\d{4,}\b/g, '')
        // RFC-like tokens: 3-4 letters + 6 digits + 3 alphanumerics
        .replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}\b/gi, '')
        // alphanumeric ids that mix letters and 3+ digits (e.g. ANE140618P37)
        .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,}\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .trim()
        .replace(/[\s*\-/]+$/, '')
        .trim();
}

function anonymizeConcept(raw) {
    const masked = maskRunTogetherNames(maskPersonNames(String(raw || '')));
    return stripIdentifiers(masked) || 'Movimiento';
}

/* ─────────────────────────── Build ─────────────────────────── */

const BANK_LABEL = {
    'bbva-debito': 'BBVA', 'bbva-credito': 'BBVA', 'nu-debito': 'Nu',
    'inbursa-debito': 'Inbursa', 'scotia-debito': 'Scotiabank',
    'banamex-debito': 'Citibanamex',
};

async function main() {
    const files = (await readdir(PDF_DIR)).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    const rows = [];
    const skipped = [];

    for (const file of files) {
        const buf = await readFile(path.join(PDF_DIR, file));
        let parsed = null;
        try {
            parsed = await tryDeterministicParse(buf);
        } catch (e) {
            skipped.push(`${file} — parser lanzó: ${e.message}`);
            continue;
        }
        if (!parsed) { skipped.push(`${file} — sin parser determinista (PDF escaneado o banco no soportado)`); continue; }

        const accountType = parsed.tipo_cuenta === 'credito' ? 'credito' : 'debito';
        const bank = BANK_LABEL[parsed._bank] || parsed.banco || 'Desconocido';

        for (const m of parsed.movimientos) {
            if (!m.fecha || !(Number(m.monto) > 0)) continue;
            const concept = anonymizeConcept(m.concepto);
            rows.push({
                date: m.fecha,
                concept,
                amount: Math.round(Number(m.monto) * 100) / 100,
                type: m.tipo === 'ingreso' ? 'ingreso' : 'egreso',
                categoria: inferirCategoria(concept, m.tipo),
                account_type: accountType,
                bank,
            });
        }
        console.log(`✅ ${file} → ${parsed._bank} · ${parsed.movimientos.length} movimientos`);
    }

    if (!rows.length) throw new Error('No se extrajo ningún movimiento.');

    // Rebase dates to day-offsets from the newest movement.
    const DAY = 86400000;
    const anchor = rows.reduce((max, r) => (r.date > max ? r.date : max), rows[0].date);
    const anchorMs = Date.parse(`${anchor}T00:00:00Z`);
    for (const r of rows) {
        r.dayOffset = Math.round((anchorMs - Date.parse(`${r.date}T00:00:00Z`)) / DAY);
        delete r.date;
    }
    rows.sort((a, b) => b.dayOffset - a.dayOffset);

    await mkdir(path.dirname(OUT_FILE), { recursive: true });
    await writeFile(OUT_FILE, [
        '// GENERADO por scripts/seed/build-demo-seed.mjs — no editar a mano.',
        `// ${rows.length} movimientos anonimizados de estados de cuenta reales.`,
        `export default ${JSON.stringify(rows)};`,
        '',
    ].join('\n'));

    /* ── Report ── */
    const byBank = {};
    for (const r of rows) {
        const k = `${r.bank} (${r.account_type})`;
        byBank[k] = (byBank[k] || 0) + 1;
    }
    const cats = {};
    for (const r of rows) cats[r.categoria] = (cats[r.categoria] || 0) + 1;

    console.log(`\n${rows.length} movimientos → ${path.relative(ROOT, OUT_FILE)}`);
    console.log(`Rango: ${Math.max(...rows.map(r => r.dayOffset))} días de historia`);
    console.log('\nPor cuenta:'); for (const [k, v] of Object.entries(byBank)) console.log(`  ${k}: ${v}`);
    console.log('\nPor categoría:');
    for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
    if (skipped.length) { console.log('\nOmitidos:'); skipped.forEach(s => console.log(`  ⚠️  ${s}`)); }
    if (nameMap.size) console.log(`\n${nameMap.size} nombres de persona reemplazados por ficticios.`);
}

main().catch(e => { console.error(e); process.exit(1); });
