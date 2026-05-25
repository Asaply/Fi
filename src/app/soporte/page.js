import Link from 'next/link';
import styles from '../legal.module.css';

export const metadata = {
    title: 'Soporte — NVA',
    description: 'Centro de soporte de NVA Finanzas Personales.',
};

export default function SoportePage() {
    return (
        <div className={styles.root}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <Link href="/" className={styles.back}>← NVA</Link>
                    <h1 className={styles.title}>Soporte</h1>
                    <p className={styles.updated}>NVA Finanzas Personales</p>
                </div>

                <div className={styles.body}>
                    <section className={styles.section}>
                        <h2 className={styles.h2}>Contacto</h2>
                        <p className={styles.p}>Para cualquier duda, problema técnico o sugerencia, escríbenos directamente:</p>
                        <p className={styles.p}><a className={styles.a} href="mailto:soporte@nva.lat">soporte@nva.lat</a></p>
                        <p className={styles.p}>Respondemos en un plazo máximo de 48 horas hábiles.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>Preguntas frecuentes</h2>

                        <h3 className={styles.h3}>¿Cómo registro un gasto?</h3>
                        <p className={styles.p}>Desde la pantalla principal, toca el botón "+" y selecciona la categoría, monto y fecha.</p>

                        <h3 className={styles.h3}>¿Cómo elimino una transacción?</h3>
                        <p className={styles.p}>Desliza la transacción hacia la izquierda en la lista de movimientos para ver la opción de eliminar.</p>

                        <h3 className={styles.h3}>¿Mis datos están seguros?</h3>
                        <p className={styles.p}>Sí. Todos los datos se almacenan de forma segura y cifrada. Consulta nuestra <Link href="/privacy" className={styles.a}>Política de Privacidad</Link> para más detalles.</p>

                        <h3 className={styles.h3}>¿Cómo cancelo mi suscripción?</h3>
                        <p className={styles.p}>Puedes cancelar tu suscripción en cualquier momento desde Configuración → Suscripción en la app, o directamente desde tu cuenta de App Store.</p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.h2}>Más información</h2>
                        <p className={styles.p}>
                            <Link href="/privacy" className={styles.a}>Política de Privacidad</Link>
                            {' · '}
                            <Link href="/terms" className={styles.a}>Términos de Uso</Link>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
