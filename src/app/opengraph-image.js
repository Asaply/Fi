import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NVA — Finalmente, entiende tu dinero.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: '#0F0F0F',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    padding: '80px',
                    fontFamily: 'Arial Black, sans-serif',
                }}
            >
                {/* Logo badge */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0F0F0F',
                    border: '2px solid #333',
                    borderRadius: '16px',
                    width: '72px',
                    height: '72px',
                    marginBottom: '40px',
                    fontSize: '28px',
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: '-1px',
                }}>
                    <span style={{ color: '#fff' }}>NV</span>
                    <span style={{ color: '#FF6600' }}>A</span>
                </div>

                {/* Headline */}
                <div style={{
                    fontSize: '64px',
                    fontWeight: 900,
                    color: '#fff',
                    lineHeight: 1.1,
                    marginBottom: '24px',
                    maxWidth: '900px',
                }}>
                    Finalmente, entiende<br />
                    <span style={{ color: '#FF6600' }}>tu dinero.</span>
                </div>

                {/* Subtitle */}
                <div style={{
                    fontSize: '28px',
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 400,
                    maxWidth: '700px',
                    lineHeight: 1.4,
                }}>
                    Analiza tu estado de cuenta en 30 segundos.
                    Compatible con Nu, BBVA, Banorte y más.
                </div>

                {/* Domain */}
                <div style={{
                    position: 'absolute',
                    bottom: '80px',
                    right: '80px',
                    fontSize: '22px',
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 500,
                }}>
                    nva.lat
                </div>
            </div>
        ),
        { ...size }
    );
}
