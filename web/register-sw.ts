export function registerServiceWorker() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Only register in production builds or localhost
    const isLocalhost = /^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(location.hostname);
    const isProd = process.env.NODE_ENV === 'production';

    if (!isProd && !isLocalhost) return;

    navigator.serviceWorker
        .register('/service-worker.js')
        .catch((err) => console.warn('SW registration failed:', err));
}
