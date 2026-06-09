import Image from 'next/image'
import Link from 'next/link'
import styles from './landing.module.css'
import NativeRedirect from '@/components/NativeRedirect'

export const metadata = {
  title: 'NVA — Finalmente, entiende tu dinero.',
  description: 'NVA analiza tus estados de cuenta, gastos e inversiones y te explica tu situación financiera en segundos. Compatible con Nu, BBVA, Spin y más.',
}

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* Black gate: hides landing until JS decides (native=redirect, web=remove gate) */}
      <div id="native-gate" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 99999 }} />
      <NativeRedirect to="/login" />

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <Image src="/nva-logo.svg" alt="NVA" width={90} height={30} priority />
        <div className={styles.navActions}>
          <Link href="/blog" className={styles.navLink}>Blog</Link>
          <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
          <Link href="/analyze" className={styles.navCta}>Empezar gratis</Link>
        </div>
      </nav>

      {/* ── App Store banner ── */}
      <div className={styles.appBanner}>
        <span className={styles.appBannerDot} />
        <p className={styles.appBannerText}>
          Próximamente en <strong>App Store</strong> y <strong>Google Play</strong>
        </p>
        <span className={styles.appBannerBadge}>Muy pronto</span>
      </div>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>🇲🇽 Hecho para México</div>
        <h1 className={styles.title}>
          ¿A dónde se fue<br />
          <span className={styles.titleAccent}>tu dinero este mes?</span>
        </h1>
        <p className={styles.subtitle}>
          NVA analiza tu estado de cuenta y te explica tus gastos,
          fugas de dinero e inversiones en menos de 30 segundos.
        </p>
        <div className={styles.heroActions}>
          <Link href="/analyze" className={styles.cta}>
            Analizar mi estado de cuenta
          </Link>
          <Link href="/login" className={styles.ctaSecondary}>
            Ya tengo cuenta →
          </Link>
        </div>
        <p className={styles.ctaNote}>Sin registro · Sin tarjeta · Compatible con todos los bancos de México</p>
      </section>

      {/* ── Trust bar — bancos compatibles ── */}
      <div className={styles.trustBar}>
        <p className={styles.trustLabel}>Compatible con</p>
        <div className={styles.trustBanks}>
          {['Nu', 'BBVA', 'Banorte', 'Santander', 'HSBC', 'Citibanamex', 'Spin by OXXO', 'Mercado Pago', 'Hey Banco', 'Inbursa', 'Afirme', 'Y más...'].map(b => (
            <span key={b} className={styles.bankChip}>{b}</span>
          ))}
        </div>
      </div>

      {/* ── Demo antes / después ── */}
      <div className={styles.demoGrid}>
        <div className={styles.demoCard}>
          <p className={styles.demoLabel}>Sin NVA</p>
          <div className={styles.excelRows}>
            {[
              ['12/04', 'OXXO GASOLINERA...', '$580'],
              ['13/04', 'UBER *TRIP', '$145'],
              ['14/04', 'RAPPI RESTAURAN...', '$312'],
              ['15/04', 'NETFLIX.COM', '$219'],
              ['16/04', 'UBER EATS...', '$387'],
            ].map(([d, desc, amt]) => (
              <div key={d} className={styles.excelRow}>
                <span className={styles.excelDate}>{d}</span>
                <span className={styles.excelDesc}>{desc}</span>
                <span className={styles.excelAmt}>{amt}</span>
              </div>
            ))}
          </div>
          <p className={styles.excelNote}>⏱ Horas revisando números sin entender nada</p>
        </div>
        <div className={`${styles.demoCard} ${styles.demoCardActive}`}>
          <p className={`${styles.demoLabel} ${styles.demoLabelActive}`}>Con NVA — en 30 seg</p>
          <div className={styles.insightRow}>
            <span className={styles.insightIcon}>🍔</span>
            <div>
              <p className={styles.insightTitle}>Comida: <strong>$4,200/mes</strong></p>
              <p className={styles.insightSub}>35% de tus ingresos. Mayor fuga: Uber Eats.</p>
            </div>
          </div>
          <div className={styles.insightRow}>
            <span className={styles.insightIcon}>⚠️</span>
            <div>
              <p className={styles.insightTitle}>Gastos hormiga detectados</p>
              <p className={styles.insightSub}>$890/mes en cargos menores de $50.</p>
            </div>
          </div>
          <div className={styles.insightRow}>
            <span className={styles.insightIcon}>📈</span>
            <div>
              <p className={styles.insightTitle}>Podrías ahorrar $2,100/mes</p>
              <p className={styles.insightSub}>Reduciendo delivery y suscripciones duplicadas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Módulos ── */}
      <section className={styles.modulesSection}>
        <p className={styles.modulesEyebrow}>Todo en un solo lugar</p>
        <h2 className={styles.sectionTitle}>Tu centro financiero inteligente</h2>
        <div className={styles.modulesGrid}>
          <div className={styles.moduleCard}>
            <div className={styles.moduleIcon}>💸</div>
            <h3 className={styles.moduleTitle}>Gastos e ingresos</h3>
            <p className={styles.moduleDesc}>Sube tu PDF o CSV. NVA categoriza todo automáticamente y detecta fugas de dinero que no ves.</p>
          </div>
          <div className={styles.moduleCard}>
            <div className={styles.moduleIcon}>📈</div>
            <h3 className={styles.moduleTitle}>Portafolio de inversiones</h3>
            <p className={styles.moduleDesc}>Trackea acciones, crypto y ETFs con precios en tiempo real. Compara tu rendimiento vs S&P 500.</p>
          </div>
          <div className={styles.moduleCard}>
            <div className={styles.moduleIcon}>🧠</div>
            <h3 className={styles.moduleTitle}>Salud financiera</h3>
            <p className={styles.moduleDesc}>Un score claro de qué tan bien está tu dinero. Con recomendaciones concretas para mejorar.</p>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>Tres pasos. Sin complicaciones.</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <p className={styles.stepTitle}>Sube tu archivo</p>
            <p className={styles.stepDesc}>PDF o CSV — compatible con todos los bancos de México</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <p className={styles.stepTitle}>NVA lo interpreta</p>
            <p className={styles.stepDesc}>Categorización automática, detección de patrones y análisis inteligente</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <p className={styles.stepTitle}>Entiende tu dinero</p>
            <p className={styles.stepDesc}>Insights claros, sin jerga. Sabes exactamente dónde mejorar</p>
          </div>
        </div>
      </section>

      {/* ── Origin Story ── */}
      <section className={styles.originSection}>
        <div className={styles.originInner}>
          <p className={styles.originEyebrow}>Construido desde la frustración.</p>

          <p className={styles.originBody}>
            Las herramientas financieras modernas fueron diseñadas para registrar movimientos.<br />
            No para entender patrimonio.
          </p>

          <div className={styles.originStack}>
            <span>Tus inversiones viven en una app.</span>
            <span>Tus gastos en otra.</span>
            <span className={styles.originStackAccent}>Tu situación financiera real, en ninguna.</span>
          </div>

          <div className={styles.originDivider} />

          <h2 className={styles.originHeadline}>Por eso creamos NVA.</h2>

          <p className={styles.originBody}>
            Una plataforma diseñada para unificar patrimonio, inversiones y comportamiento financiero en una sola interfaz.
          </p>

          <div className={styles.originSins}>
            <span>Sin hojas de cálculo.</span>
            <span>Sin fragmentación.</span>
            <span>Sin fricción.</span>
          </div>
          <p className={styles.originClarity}>Solo claridad financiera real.</p>

          <div className={styles.originDivider} />

          <h2 className={styles.originRedefined}>Claridad financiera, rediseñada.</h2>

          <p className={styles.originBody}>
            NVA transforma estados de cuenta, portafolios y actividad financiera en inteligencia accionable.
          </p>

          <div className={styles.originWords}>
            <span>No solo visualización.</span>
            <span>Contexto.</span>
            <span>Riesgo.</span>
            <span>Patrones.</span>
            <span>Decisiones.</span>
          </div>

          <p className={styles.originFootnote}>
            Creado en México.<br />Diseñado para el patrimonio moderno.
          </p>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaSectionTitle}>Finalmente, entiende tu dinero.</h2>
        <p className={styles.ctaSectionSubtitle}>
          Sube tu estado de cuenta y en 30 segundos tienes claridad total sobre tus finanzas.
        </p>
        <Link href="/analyze" className={styles.cta}>
          Empezar gratis ahora
        </Link>
        <p className={styles.ctaNote}>Sin registro · 100% privado · Tus datos no se guardan</p>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <Image src="/nva-logo.svg" alt="NVA" width={70} height={22} />
            <p className={styles.footerCopy}>Inteligencia financiera para México &copy; 2025</p>
          </div>
          <div className={styles.footerLinks}>
            <Link href="/privacy" className={styles.footerLink}>Privacidad</Link>
            <Link href="/terms" className={styles.footerLink}>Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
