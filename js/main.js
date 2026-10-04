// Cada módulo inicializa de forma independente.
let slideshowInstance = null;
let sakuraInstance = null;
function boot(name, callback) {
    Promise.resolve().then(callback).catch(error => OverlayRuntime.report(name, error.message, true));
}
boot('Player', () => initPlayer());
boot('Fundo', async () => {
    if (CONFIG.slideshow.enabled !== false) slideshowInstance = await initBackground();
    else document.getElementById('slideshow-wrapper').style.display = 'none';
});
boot('Sakura', () => {
    if (CONFIG.sakura && CONFIG.sakura.enabled !== false) {
        sakuraInstance = new SakuraEngine('sakuraCanvas', CONFIG.sakura);
        sakuraInstance.init();
    } else document.getElementById('sakuraCanvas').style.display = 'none';
});
// 2. Transfere a Vinheta do WebGL para o CSS
function buildGlobalVignette() {
    const vConf = CONFIG.slideshow.vignette;
    const layer = document.getElementById('vignette-layer');
    if (!layer || !vConf) return;

    const rgb = `${vConf.color.r}, ${vConf.color.g}, ${vConf.color.b}`;
    const alpha = vConf.opacity;
    
    if (vConf.isVerticalVignette === 1) {
        // Matemática linear para vertical
        const stop = vConf.size * 100;
        layer.style.background = `linear-gradient(to bottom, rgba(${rgb}, 0) 0%, rgba(${rgb}, ${alpha}) ${stop}%)`;
    } else {
        // CORREÇÃO: Substituição de 'circle' por 'ellipse' para acompanhar o aspect ratio 16:9
        const stop = vConf.size * 200;
        layer.style.background = `radial-gradient(ellipse at center, rgba(${rgb}, 0) 40%, rgba(${rgb}, ${alpha}) ${stop}%)`;
    }
    
    layer.style.mixBlendMode = vConf.blendMode;
}
boot('Vinheta', buildGlobalVignette);


// Fonte preferida carrega em paralelo, sem bloquear o player.
boot('Fonte', async () => {
    const font = new FontFace('Cal Sans', 'url(CalSans-Regular.ttf)');
    const loaded = await font.load();
    document.fonts.add(loaded);
    OverlayRuntime.report('Fonte', 'Cal Sans carregada.');
});

window.addEventListener('resize', () => {
    const vertical = window.innerHeight > window.innerWidth;
    const axis = vertical ? window.innerHeight : window.innerWidth;
    const folder = axis <= 1920 ? '1080p' : axis <= 2560 ? '1440p' : '2160p';
    if (vertical !== IS_VERTICAL || folder !== ASSET_FOLDER) { location.reload(); return; }
    if (slideshowInstance?.isReady) slideshowInstance.resize();
    if (sakuraInstance?.isReady) sakuraInstance.resize();
    buildGlobalVignette();
    scaleOverlay();
});
