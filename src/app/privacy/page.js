import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata = {
    title: 'Política de Privacidad — NVA',
    description: 'Política de Privacidad de NVA Finance.',
};

export default function PrivacyPage() {
    return (
        <div className={styles.root}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <Link href="/" className={styles.back}>← NVA</Link>
                    <h1 className={styles.title}>Política de Privacidad</h1>
                    <p className={styles.updated}>Última actualización: mayo 2026</p>
                </div>

                <div className={styles.body}>
                    <section className={styles.section}>
                        <h2 className={styles.h2}>1. Responsable del tratamiento</h2>
                        <p className={styles.p}>NVA Finance ("NVA", "nosotros") es responsable del tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México.</p>
                        <p className={styles.p}>Contacto: <a className={styles.a} href="mailto:soporte@nva.lat">soporte@nva.lat</a></p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>2. Datos que recopilamos</h2>
                        <h3 className={styles.h3}>2.1 Datos de cuenta</h3>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Email y contraseña (almacenada con hash seguro por Supabase Auth).</li>
                            <li className={styles.li}>Nombre o alias proporcionado voluntariamente.</li>
                            <li className={styles.li}>Foto de perfil (opcional, almacenada localmente en tu dispositivo).</li>
                        </ul>
                        <h3 className={styles.h3}>2.2 Datos financieros</h3>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Transacciones extraídas de los estados de cuenta que subes (fecha, concepto, monto, categoría).</li>
                            <li className={styles.li}>Información de cuentas bancarias conectadas mediante Belvo (saldo, movimientos).</li>
                            <li className={styles.li}>Configuración de tarjetas de crédito (límite, fecha de corte) que ingreses manualmente.</li>
                        </ul>
                        <h3 className={styles.h3}>2.3 Datos técnicos</h3>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Dirección IP (para límites de uso en análisis gratuitos).</li>
                            <li className={styles.li}>Tipo de navegador y sistema operativo.</li>
                            <li className={styles.li}>Preferencias de la aplicación almacenadas en tu dispositivo (localStorage).</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>3. Finalidades del tratamiento</h2>
                        <p className={styles.p}>Usamos tus datos para:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}><strong className={styles.strong}>Prestación del servicio:</strong> Analizar estados de cuenta, categorizar transacciones y mostrar métricas financieras.</li>
                            <li className={styles.li}><strong className={styles.strong}>Seguridad:</strong> Verificar tu identidad, prevenir fraude y proteger tu cuenta.</li>
                            <li className={styles.li}><strong className={styles.strong}>Mejora del servicio:</strong> Optimizar algoritmos de categorización (con datos anonimizados).</li>
                            <li className={styles.li}><strong className={styles.strong}>Comunicaciones:</strong> Enviarte notificaciones relacionadas con tu cuenta (no publicidad sin consentimiento).</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>4. Procesamiento por terceros</h2>
                        <h3 className={styles.h3}>4.1 Supabase</h3>
                        <p className={styles.p}>Almacenamos tus datos en Supabase (infraestructura en AWS). Los datos están cifrados en tránsito (TLS) y en reposo. Supabase actúa como encargado del tratamiento bajo contrato.</p>
                        <h3 className={styles.h3}>4.2 Anthropic (Claude AI)</h3>
                        <p className={styles.p}>El contenido de los estados de cuenta que subes se envía a Anthropic para su análisis mediante IA. Anthropic no utiliza datos de usuarios de API para entrenar sus modelos. Consulta la <a className={styles.a} href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">política de privacidad de Anthropic</a>.</p>
                        <h3 className={styles.h3}>4.3 Belvo</h3>
                        <p className={styles.p}>Si conectas cuentas bancarias, Belvo actúa como agregador financiero regulado con acceso de solo lectura a tus cuentas. Consulta la <a className={styles.a} href="https://belvo.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">política de privacidad de Belvo</a>.</p>
                        <h3 className={styles.h3}>4.4 Vercel</h3>
                        <p className={styles.p}>La Plataforma se aloja en Vercel. Los logs de servidor pueden incluir IPs y rutas accedidas con fines de seguridad y rendimiento.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>5. Almacenamiento local (dispositivo)</h2>
                        <p className={styles.p}>Algunos datos se almacenan en tu navegador (localStorage / sessionStorage) para mejorar la experiencia:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Preferencias de visualización (tema, filtros).</li>
                            <li className={styles.li}>Configuración de PIN (guardada como hash PBKDF2, nunca el PIN en texto claro).</li>
                            <li className={styles.li}>Resultados de análisis temporales (se eliminan al cerrar el navegador).</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>6. No compartimos tus datos</h2>
                        <p className={styles.p}>No vendemos, rentamos ni compartimos tus datos personales con terceros con fines comerciales. Los datos solo se comparten con los encargados del tratamiento descritos en la sección 4, necesarios para operar el servicio.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>7. Retención de datos</h2>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Tus datos se conservan mientras tu cuenta esté activa.</li>
                            <li className={styles.li}>Al eliminar tu cuenta, los datos se borran de nuestros servidores en un plazo máximo de 30 días.</li>
                            <li className={styles.li}>Podemos conservar datos anonimizados para estadísticas.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>8. Tus derechos (ARCO)</h2>
                        <p className={styles.p}>Conforme a la LFPDPPP, tienes derecho a:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}><strong className={styles.strong}>Acceso:</strong> Solicitar qué datos tenemos sobre ti.</li>
                            <li className={styles.li}><strong className={styles.strong}>Rectificación:</strong> Corregir datos inexactos.</li>
                            <li className={styles.li}><strong className={styles.strong}>Cancelación:</strong> Eliminar tus datos (puedes hacerlo directamente desde Perfil → Eliminar cuenta).</li>
                            <li className={styles.li}><strong className={styles.strong}>Oposición:</strong> Oponerte a tratamientos específicos.</li>
                        </ul>
                        <p className={styles.p}>Para ejercer tus derechos ARCO: <a className={styles.a} href="mailto:soporte@nva.lat">soporte@nva.lat</a>. Respondemos en un plazo máximo de 20 días hábiles.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>9. Seguridad</h2>
                        <p className={styles.p}>Implementamos medidas técnicas para proteger tus datos:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Cifrado TLS en todas las comunicaciones.</li>
                            <li className={styles.li}>Autenticación segura con Supabase Auth.</li>
                            <li className={styles.li}>Contraseñas y PIN nunca almacenados en texto claro.</li>
                            <li className={styles.li}>Políticas de seguridad a nivel de base de datos (Row Level Security).</li>
                            <li className={styles.li}>Bloqueo de sesión por inactividad.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>10. Cookies</h2>
                        <p className={styles.p}>Usamos cookies estrictamente necesarias para mantener tu sesión activa (cookies de autenticación de Supabase). No usamos cookies de rastreo ni publicidad.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>11. Menores de edad</h2>
                        <p className={styles.p}>La Plataforma no está dirigida a menores de 18 años. Si detectamos una cuenta de un menor, la cancelaremos y eliminaremos sus datos.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>12. Cambios a esta política</h2>
                        <p className={styles.p}>Podemos actualizar esta Política en cualquier momento. Te notificaremos por email o mediante aviso en la Plataforma con al menos 15 días de anticipación antes de cambios materiales.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>13. Contacto</h2>
                        <p className={styles.p}>Dudas o solicitudes sobre privacidad: <a className={styles.a} href="mailto:soporte@nva.lat">soporte@nva.lat</a></p>
                    </section>
                </div>

                <div className={styles.footer}>
                    <Link href="/terms" className={styles.footerLink}>Términos y Condiciones</Link>
                    <Link href="/" className={styles.footerLink}>Volver al inicio</Link>
                </div>
            </div>
        </div>
    );
}
