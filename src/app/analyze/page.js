'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import styles from './analyze.module.css'

export default function AnalyzePage() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function gateCheck() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/finanzas')
        return
      }
      if (localStorage.getItem('nva_free_analysis_used')) {
        router.replace('/login?reason=free_analysis_used')
        return
      }
      setChecking(false)
    }
    gateCheck()
  }, [router])

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setStatusMsg('Leyendo transacciones...')

    try {
      const fd = new FormData()
      fd.append('file', file)

      setStatusMsg('Detectando banco y patrones...')
      const res = await fetch('/api/analyze', { method: 'POST', body: fd })

      setStatusMsg('Generando insights...')
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Error del servidor. Intenta de nuevo.')
      }
      const data = await res.json()

      if (res.status === 429 || data.limitReached) {
        localStorage.setItem('nva_free_analysis_used', new Date().toISOString())
        router.replace('/login?reason=free_analysis_used')
        return
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al analizar el archivo')
      }

      sessionStorage.setItem('nva_pending_analysis', JSON.stringify(data))
      localStorage.setItem('nva_free_analysis_used', new Date().toISOString())
      router.push('/analyze/results')
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo')
      setLoading(false)
    }
  }

  if (checking) {
    return <div className={styles.root} />
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Image src="/nva-logo.svg" alt="NVA" width={110} height={36} priority />
          <h1 className={styles.title}>Analiza tu estado de cuenta</h1>
          <p className={styles.subtitle}>Sube PDF o CSV de tu banco</p>
        </div>

        {!loading ? (
          <>
            <input
              type="file"
              accept=".pdf,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`${styles.dropzone} ${file ? styles.dropzoneHasFile : ''}`}
            >
              <div className={styles.dropzoneIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className={styles.dropzoneText}>
                {file ? file.name : 'Arrastra tu archivo o haz clic'}
              </p>
              <p className={styles.dropzoneHint}>PDF o CSV (max 15MB)</p>
            </label>

            {error && <p style={{ color: '#ff4d4d', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>{error}</p>}

            {file && (
              <button onClick={handleAnalyze} className={styles.uploadBtn}>
                Analizar gratis
              </button>
            )}
          </>
        ) : (
          <div className={styles.progressCard}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: '100%', transition: 'none', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <p className={styles.progressMsg}>{statusMsg}</p>
          </div>
        )}

        <p className={styles.privacyNote}>
          Tus datos son privados. No los compartimos.
        </p>
      </div>
    </div>
  )
}
