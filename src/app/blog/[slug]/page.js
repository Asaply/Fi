import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { getAllPosts, getPostBySlug } from '@/lib/posts'
import styles from './post.module.css'

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }) {
  const post = getPostBySlug(params.slug)
  if (!post) return {}
  return {
    title: `${post.meta.title} — NVA Blog`,
    description: post.meta.description,
  }
}

export default async function PostPage({ params }) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  return (
    <div className={styles.root}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link href="/">
          <Image src="/nva-logo.svg" alt="NVA" width={80} height={26} priority />
        </Link>
        <div className={styles.navActions}>
          <Link href="/blog" className={styles.navLink}>← Blog</Link>
          <Link href="/analyze" className={styles.navCta}>Empezar gratis</Link>
        </div>
      </nav>

      <article className={styles.article}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.meta}>
            <span className={styles.categoryTag}>{post.meta.category}</span>
            <span className={styles.date}>{formatDate(post.meta.date)}</span>
          </div>
          <h1 className={styles.title}>{post.meta.title}</h1>
          <p className={styles.description}>{post.meta.description}</p>
        </header>

        {/* Content */}
        <div className={styles.body}>
          <MDXRemote source={post.content} />
        </div>

        {/* CTA */}
        <div className={styles.ctaBox}>
          <p className={styles.ctaTitle}>Analiza tu estado de cuenta gratis</p>
          <p className={styles.ctaDesc}>Sube tu PDF y NVA categoriza todo automáticamente. Compatible con todos los bancos de México.</p>
          <Link href="/analyze" className={styles.ctaBtn}>Empezar gratis</Link>
        </div>
      </article>

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
