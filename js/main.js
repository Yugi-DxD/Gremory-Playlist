// 1. Inicia o WebGL de forma assíncrona SOMENTE se autorizado pelo config.js
let slideshowInstance = null;
if (CONFIG.slideshow.enabled !== false) {
    initBackground().then(instance => {
        slideshowInstance = instance;
    });
} else {
    // Aborta a renderização e arranca o container do DOM
    document.getElementById('slideshow-wrapper').style.display = 'none';
}

// MÓDULO SAKURA: Inicia a engine 2D SOMENTE se autorizado no config
let sakuraInstance = null;
if (CONFIG.sakura && CONFIG.sakura.enabled !== false) {
    sakuraInstance = new SakuraEngine('sakuraCanvas', CONFIG.sakura);
    sakuraInstance.init();
} else {
    const sc = document.getElementById('sakuraCanvas');
    if (sc) sc.style.display = 'none';
}

// 2. Carrega a fonte via JS e bloqueia a inicialização do Player
const calSansFont = new FontFace('Cal Sans', 'url(CalSans-Regular.ttf)');

calSansFont.load().then((loadedFont) => {
    document.fonts.add(loadedFont);
    initPlayer(); // O Player SÓ liga quando a fonte já estiver na RAM
}).catch((err) => {
    console.error("Falha bruta de I/O na fonte. Iniciando em modo de emergência:", err);
    initPlayer(); 
});

// 3. Listener centralizado
window.addEventListener('resize', () => {
    const newIsVert = window.innerHeight > window.innerWidth;
    const currentPrimaryAxis = newIsVert ? window.innerHeight : window.innerWidth;
    
    let newFolder = "2160p";
    if (currentPrimaryAxis <= 1920) newFolder = "1080p";
    else if (currentPrimaryAxis <= 2560) newFolder = "1440p";
    
    if (newIsVert !== IS_VERTICAL || newFolder !== ASSET_FOLDER) {
        window.location.reload(); 
        return;
    }
    
    // Trava de segurança: impede o resize de disparar num canvas não iniciado
    if (slideshowInstance && slideshowInstance.isReady) {
        slideshowInstance.resize();
    }

    // Repassa o redimensionamento dinâmico para a matriz 2D das pétalas
    if (sakuraInstance && sakuraInstance.isReady) {
        sakuraInstance.resize();
    }
    
    scaleOverlay();
});
