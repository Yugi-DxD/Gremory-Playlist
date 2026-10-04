/* Shared diagnostics and bounded I/O. No security flags or remote services. */
const OverlayRuntime = (() => {
    const states = new Map();
    const debug = window.OVERLAY_DEBUG === true || new URLSearchParams(location.search).has('debug');
    let panel;
    function report(key, message, error = false) {
        if (states.get(key)?.message === message) return;
        states.set(key, { message, error });
        console[error ? 'warn' : 'info'](`[Overlay/${key}] ${message}`);
        if (!debug) return;
        if (!panel) {
            panel = document.createElement('pre');
            panel.id = 'overlay-diagnostics';
            panel.style.cssText = 'position:fixed;inset:12px 12px auto;z-index:99999;background:#111e;color:#fff;padding:16px;font:16px/1.5 monospace;white-space:pre-wrap;max-height:85vh;overflow:auto;pointer-events:auto';
            document.body.appendChild(panel);
        }
        panel.textContent = `GREMORY — DIAGNÓSTICO\n${location.protocol}//${location.host}\n${navigator.userAgent}\n\n` +
            [...states].map(([k,v]) => `${v.error ? 'ATENÇÃO' : 'OK'} | ${k}: ${v.message}`).join('\n');
    }
    async function readText(path) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(path, { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            // XHR may read file: in some hosts; it does not bypass origin restrictions.
            if (location.protocol !== 'file:') throw error;
            return await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', path, true);
                xhr.timeout = 5000;
                xhr.onload = () => {
                    if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) resolve(xhr.responseText);
                    else reject(new Error(`${path}: XHR ${xhr.status}`));
                };
                xhr.onerror = xhr.ontimeout = () => reject(new Error(`Leitura bloqueada ou indisponível: ${path}`));
                xhr.send();
            });
        } finally { clearTimeout(timer); }
    }
    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timer = setTimeout(() => finish(new Error(`Tempo esgotado: ${url}`)), 10000);
            function finish(error) {
                clearTimeout(timer); img.onload = img.onerror = null;
                if (error) { img.src = ''; reject(error); } else resolve(img);
            }
            img.onload = () => finish();
            img.onerror = () => finish(new Error(`Imagem ausente, bloqueada ou inválida: ${url}`));
            img.decoding = 'async';
            img.src = url;
        });
    }
    window.addEventListener('error', event => {
        const resource = event.target?.src || event.target?.href;
        report(resource ? 'Recurso' : 'JavaScript', event.message || `Falha ao carregar ${resource || 'recurso'}`, true);
    }, true);
    window.addEventListener('unhandledrejection', event => report('Promise', String(event.reason), true));
    document.getElementById('diagnostic-boot')?.remove();
    report('Inicialização', 'JavaScript carregado');
    return { report, readText, loadImage, states };
})();
