import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata = {
    title: 'Términos y Condiciones — NVA',
    description: 'Términos y Condiciones de uso de NVA Finance.',
};

export default function TermsPage() {
    return (
        <div className={styles.root}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <Link href="/" className={styles.back}>← NVA</Link>
                    <h1 className={styles.title}>Términos y Condiciones</h1>
                    <p className={styles.updated}>Última actualización: mayo 2026</p>
                </div>

                <div className={styles.body}>
                    <section className={styles.section}>
                        <h2 className={styles.h2}>1. Aceptación</h2>
                        <p className={styles.p}>Al crear una cuenta o usar NVA Finance ("la Plataforma"), aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo, no uses la Plataforma.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>2. Descripción del servicio</h2>
                        <p className={styles.p}>NVA Finance es una herramienta de finanzas personales que te permite:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Importar y analizar estados de cuenta bancarios en formato PDF o CSV.</li>
                            <li className={styles.li}>Categorizar transacciones automáticamente mediante inteligencia artificial.</li>
                            <li className={styles.li}>Visualizar métricas de ingresos, egresos y hábitos de gasto.</li>
                            <li className={styles.li}>Conectar cuentas bancarias a través de proveedores autorizados (Belvo).</li>
                        </ul>
                        <p className={styles.p}>La Plataforma no es una institución financiera, no presta dinero, no administra fondos ni realiza operaciones bancarias.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>3. Elegibilidad</h2>
                        <p className={styles.p}>Debes ser mayor de 18 años y residir en México para usar la Plataforma. Al registrarte, declaras que cumples estos requisitos.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>4. Cuenta de usuario</h2>
                        <p className={styles.p}>Eres responsable de mantener la confidencialidad de tus credenciales de acceso (email, contraseña, PIN). Cualquier actividad realizada desde tu cuenta es tu responsabilidad. Notifícanos de inmediato si sospechas acceso no autorizado a <a className={styles.a} href="mailto:soporte@nva.app">soporte@nva.app</a>.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>5. Uso de inteligencia artificial</h2>
                        <p className={styles.p}>El análisis de estados de cuenta utiliza modelos de inteligencia artificial de Anthropic (Claude). Al subir un documento:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}>El contenido del archivo se envía a los servidores de Anthropic para su procesamiento.</li>
                            <li className={styles.li}>Anthropic procesa los datos conforme a su política de privacidad y no los usa para entrenar modelos con datos de usuarios de API.</li>
                            <li className={styles.li}>Los resultados son una interpretación automática y pueden contener errores. NVA no garantiza la exactitud total del análisis.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>6. Uso aceptable</h2>
                        <p className={styles.p}>Está prohibido:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Subir documentos que no te pertenezcan o para los que no tengas autorización.</li>
                            <li className={styles.li}>Usar la Plataforma para actividades ilegales, fraude o lavado de dinero.</li>
                            <li className={styles.li}>Intentar acceder a cuentas de otros usuarios o vulnerar la seguridad del sistema.</li>
                            <li className={styles.li}>Automatizar solicitudes de análisis de forma masiva (scraping, bots).</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>7. Propiedad intelectual</h2>
                        <p className={styles.p}>Todo el código, diseño, algoritmos y contenido de la Plataforma son propiedad de NVA o sus licenciantes. No puedes copiar, modificar, distribuir ni crear obras derivadas sin autorización escrita.</p>
                        <p className={styles.p}>Tus datos financieros son tuyos. NVA no adquiere derechos de propiedad sobre la información que subes.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>8. Limitación de responsabilidad</h2>
                        <p className={styles.p}>NVA Finance se proporciona "tal cual". No somos responsables por:</p>
                        <ul className={styles.ul}>
                            <li className={styles.li}>Decisiones financieras tomadas con base en el análisis de la Plataforma.</li>
                            <li className={styles.li}>Errores en la categorización automática de transacciones.</li>
                            <li className={styles.li}>Interrupciones del servicio por causas fuera de nuestro control.</li>
                            <li className={styles.li}>Daños indirectos, consecuentes o lucro cesante.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>9. Modificaciones</h2>
                        <p className={styles.p}>Podemos actualizar estos Términos en cualquier momento. Te notificaremos por email o mediante aviso en la Plataforma. El uso continuado después de la notificación implica aceptación de los cambios.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>10. Terminación</h2>
                        <p className={styles.p}>Puedes eliminar tu cuenta en cualquier momento desde la sección de Perfil. NVA puede suspender o cancelar cuentas que violen estos Términos sin previo aviso.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>11. Ley aplicable</h2>
                        <p className={styles.p}>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier disputa se someterá a la jurisdicción de los tribunales competentes de la Ciudad de México.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>12. Contacto</h2>
                        <p className={styles.p}>Preguntas sobre estos Términos: <a className={styles.a} href="mailto:soporte@nva.app">soporte@nva.app</a></p>
                    </section>
                </div>

                <div className={styles.footer}>
                    <Link href="/privacy" className={styles.footerLink}>Política de Privacidad</Link>
                    <Link href="/" className={styles.footerLink}>Volver al inicio</Link>
                </div>
            </div>
        </div>
    );
}
