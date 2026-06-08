export const dynamic = 'force-static';

export default function sitemap() {
    const base = 'https://nva.lat';
    const now = new Date().toISOString();

    return [
        { url: base,               lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
        { url: `${base}/analyze`,  lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
        { url: `${base}/login`,    lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
        { url: `${base}/blog`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
        { url: `${base}/privacy`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
        { url: `${base}/terms`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
        { url: `${base}/soporte`,  lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    ];
}
