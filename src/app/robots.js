export default function robots() {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/finanzas', '/dashboard', '/trading', '/portfolio', '/perfil', '/onboarding', '/paywall', '/configuracion', '/budgets', '/dev'],
        },
        sitemap: 'https://nva.lat/sitemap.xml',
    };
}
