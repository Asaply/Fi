import Link from 'next/link'
import Image from 'next/image'
import { getAllPosts } from '@/lib/posts'
import styles from './blog.module.css'

export const metadata = {
  title: 'Blog — NVA',
  description: 'Inteligencia financiera para México. Aprende a entender tu dinero, leer tus estados de cuenta y tomar mejores decisiones.',
}

export default function BlogPage() {
  const posts = getAllPosts()
  const featured = posts.find(p => p.featured)
  const rest = posts.filter(p => !p.featured)

  return (
    <div className={styles.root}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link href="/">
          <Image src="/nva-logo.svg" alt="NVA" width={80} height={26} priority />
        </Link>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
          <Link href="/analyze" className={styles.navCta}>Empezar gratis</Link>
        </div>
      </nav>

      {/* Header */}
      <header className={styles.header}>
        <p className={styles.eyebrow}>NVA Blog</p>
        <h1 className={styles.heading}>Inteligencia financiera<br />para México.</h1>
        <p className={styles.subheading}>Aprende a entender tu dinero, leer tus estados de cuenta y tomar mejores decisiones.</p>
      </header>

      <div className={styles.content}>
        {/* Featured */}
        {featured && (
          <>
            <p className={styles.sectionLabel}>Destacado</p>
            <Link href={`/blog/${featured.slug}`} className={styles.featuredCard}>
              <div className={styles.featuredMeta}>
                <span className={styles.categoryTag}>{featured.category}</span>
                <span className={styles.featuredDate}>{formatDate(featured.date)}</span>
              </div>
              <h2 className={styles.featuredTitle}>{featured.title}</h2>
              <p className={styles.featuredDesc}>{featured.description}</p>
              <span className={styles.readMore}>Leer artículo →</span>
            </Link>
          </>
        )}

        {/* Grid */}
        {rest.length > 0 && (
          <>
            <p className={styles.sectionLabel} style={{ marginTop: '3rem' }}>Artículos</p>
            <div className={styles.grid}>
              {rest.map(post => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.card}>
                  <div className={styles.cardMeta}>
                    <span className={styles.categoryTag}>{post.category}</span>
                    <span className={styles.cardDate}>{formatDate(post.date)}</span>
                  </div>
                  <h3 className={styles.cardTitle}>{post.title}</h3>
                  <p className={styles.cardDesc}>{post.description}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <Link href="/">
          <Image src="/nva-logo.svg" alt="NVA" width={64} height={20} />
        </Link>
        <p className={styles.footerCopy}>Inteligencia financiera para México &copy; 2025</p>
      </footer>
    </div>
  )
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
