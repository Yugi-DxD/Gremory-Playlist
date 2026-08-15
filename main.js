// 1. Inicia o WebGL instantaneamente
let slideshowInstance = initBackground();

// 2. MUDANÇA CRÍTICA: Carrega a fonte via JS e bloqueia a inicialização do Player
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
    
    if (slideshowInstance) slideshowInstance.resize();
    scaleOverlay();
});