import Image from 'next/image'
import Link from 'next/link'
import styles from './landing.module.css'

export const metadata = {
  title: 'NVA - Tu dinero en claro',
  description: 'Sube tu estado de cuenta y descubre en qué gastas en segundos.',
}

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Image src="/nva-logo.svg" alt="NVA" width={90} height={30} priority />
        <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Sube tu estado de cuenta.
          <br />
          <span className={styles.titleAccent}>Ve en qué gastas en segundos.</span>
        </h1>
        <p className={styles.subtitle}>
          Sin Excel. Sin categorizar manual. Solo sube tu PDF o CSV y listo.
        </p>
        <Link href="/analyze" className={styles.cta}>
          Subir estado de cuenta gratis
        </Link>
        <p className={styles.ctaNote}>Sin registro. Resultados en 30 segundos.</p>
      </section>

      {/* Demo antes / después */}
      <div className={styles.demoGrid}>
        <div className={styles.demoCard}>
          <p className={styles.demoLabel}>Antes (Excel manual)</p>
          <div className={styles.demoSkeleton}>
            <div className={styles.skeletonLine} style={{ width: '75%' }} />
            <div className={styles.skeletonLine} style={{ width: '100%' }} />
            <div className={styles.skeletonLine} style={{ width: '85%' }} />
            <div className={styles.skeletonLine} style={{ width: '60%' }} />
          </div>
        </div>
        <div className={`${styles.demoCard} ${styles.demoCardActive}`}>
          <p className={`${styles.demoLabel} ${styles.demoLabelActive}`}>Con NVA (automático)</p>
          <p className={styles.demoAmount}>$4,200</p>
          <p className={styles.demoDesc}>en comida este mes (35% de tus ingresos)</p>
          <p className={styles.demoWarn}>Mayor fuga: Uber Eats ($1,200/mes)</p>
        </div>
      </div>

      {/* Cómo funciona */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>Cómo funciona</h2>
        <div className={styles.stepsGrid}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <p className={styles.stepTitle}>Sube tu archivo</p>
            <p className={styles.stepDesc}>PDF o CSV de Nu, BBVA, Spin o cualquier banco</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <p className={styles.stepTitle}>Espera 30 segundos</p>
            <p className={styles.stepDesc}>NVA analiza y categoriza automáticamente</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <p className={styles.stepTitle}>Ve tus insights</p>
            <p className={styles.stepDesc}>Fugas de dinero, recomendaciones, gráficas</p>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaSectionTitle}>Deja de preguntarte en qué se va tu dinero</h2>
        <p className={styles.ctaSectionSubtitle}>Súbelo y sabrás en 30 segundos.</p>
        <Link href="/analyze" className={styles.cta}>
          Probar gratis ahora
        </Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <Image src="/nva-logo.svg" alt="NVA" width={70} height={22} />
            <p className={styles.footerCopy}>Net Value Analysis &copy; 2025</p>
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
