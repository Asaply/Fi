'use client'
import { useState, useEffect } from 'react'
import { TrendingDown, Lightbulb } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import styles from './results.module.css'

export default function ResultsPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('nva_pending_analysis')
    if (!raw) {
      router.push('/analyze')
      return
    }
    try {
      setData(JSON.parse(raw))
    } catch {
      router.push('/analyze')
      return
    }
    setReady(true)
  }, [router])

  if (!ready || !data) return <div style={{ minHeight: '100vh', background: '#000' }} />

  const insights = data.insights ?? {}
  const { mainInsight, topLeaks = [], recommendation, categories = [], totalIncome, totalExpenses } = insights

  if (!mainInsight) {
    return (
      <div className={styles.root}>
        <div className={styles.topbar}>
          <Image src="/nva-logo.svg" alt="NVA" width={80} height={26} />
        </div>
        <div className={styles.content}>
          <div className={styles.card}>
            <p className={styles.label}>Resultado</p>
            <p style={{ color: '#fff', fontWeight: 600 }}>No pudimos analizar este archivo.</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Intenta con otro estado de cuenta o formato diferente.
            </p>
            <button className={styles.ctaBtn} style={{ marginTop: '1.5rem' }} onClick={() => router.push('/analyze')}>
              Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    )
  }

  const total = categories.reduce((s, c) => s + c.amount, 0)

  return (
    <div className={styles.root}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <Image src="/nva-logo.svg" alt="NVA" width={80} height={26} />
        <button className={styles.saveBtn} onClick={() => router.push('/login')}>
          Guardar análisis →
        </button>
      </div>

      <div className={styles.content}>
        {/* Main insight */}
        <div className={`${styles.card} ${styles.cardAccent}`}>
          <p className={styles.label}>Insight principal</p>
          <p className={styles.insightAmount}>
            ${mainInsight.amount.toLocaleString('es-MX')}
          </p>
          <p className={styles.insightText}>
            en {mainInsight.category} este mes
          </p>
          {mainInsight.percentage != null && (
            <p className={styles.insightSub}>
              Eso es el {mainInsight.percentage}% de tus ingresos
            </p>
          )}
        </div>

        {/* Top fugas */}
        {topLeaks.length > 0 && (
          <div className={styles.card}>
            <p className={`${styles.label} ${styles.labelWhite}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingDown size={13} /> Top {topLeaks.length} fugas de dinero</p>
            <ul className={styles.leakList}>
              {topLeaks.map((leak, i) => (
                <li key={leak.name} className={styles.leakItem}>
                  <div className={styles.leakLeft}>
                    <span className={styles.leakRank}>#{i + 1}</span>
                    <span className={styles.leakName}>{leak.name}</span>
                  </div>
                  <span className={styles.leakAmount}>
                    ${leak.amount.toLocaleString('es-MX')}/mes
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recomendación */}
        {recommendation && (
          <div className={`${styles.card} ${styles.cardGreen}`}>
            <p className={`${styles.label} ${styles.labelGreen}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Lightbulb size={13} /> Recomendación</p>
            <p className={styles.recText}>
              Si reduces {topLeaks[0]?.name} 30%, ahorras al mes:
            </p>
            <p className={styles.recSavings}>
              +${recommendation.savings.toLocaleString('es-MX')}
            </p>
          </div>
        )}

        {/* Categorías */}
        {categories.length > 0 && (
          <div className={styles.card}>
            <p className={`${styles.label} ${styles.labelWhite}`}>Gastos por categoría</p>
            <div className={styles.catList}>
              {categories.map((cat) => {
                const pct = total > 0 ? (cat.amount / total) * 100 : 0
                return (
                  <div key={cat.name} className={styles.catRow}>
                    <div className={styles.catMeta}>
                      <span className={styles.catName}>{cat.name}</span>
                      <span className={styles.catAmt}>
                        ${cat.amount.toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div className={styles.catBarTrack}>
                      <div
                        className={styles.catBarFill}
                        style={{ width: `${pct}%`, background: cat.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className={`${styles.card} ${styles.ctaCard}`}>
          <p className={styles.ctaTitle}>Guarda este análisis.<br />Es gratis.</p>
          <p className={styles.ctaSub}>
            Crea tu cuenta para guardar tus resultados, subir más estados de cuenta y ver tu historial completo.
          </p>
          <button className={styles.ctaBtn} onClick={() => router.push('/login')}>
            Crear cuenta — es gratis
          </button>
          <p className={styles.ctaSecondary}>Sin tarjeta · Sin suscripción</p>
        </div>

        <p className={styles.aiDisclaimer}>
          Análisis y categorías generados por inteligencia artificial — pueden contener errores y no constituyen asesoría financiera.
        </p>
      </div>
    </div>
  )
}
