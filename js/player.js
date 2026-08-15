const DOM_CACHE = {
    covers: null,
    lines: null,
    wrapper: null
};

function initPlayer() {
    DOM_CACHE.wrapper = document.getElementById('player-wrapper');
    DOM_CACHE.wrapper.classList.add(IS_VERTICAL ? 'vertical' : 'horizontal');
    
    DOM_CACHE.covers = [document.getElementById('coverImg1'), document.getElementById('coverImg2')];
    DOM_CACHE.lines = [
        { main: document.getElementById("svgText1"), shadow: document.getElementById("svgText1-shadow"), svg: document.getElementById("line1-svg") },
        { main: document.getElementById("svgText2"), shadow: document.getElementById("svgText2-shadow"), svg: document.getElementById("line2-svg") },
        { main: document.getElementById("svgText3"), shadow: document.getElementById("svgText3-shadow"), svg: document.getElementById("line3-svg") }
    ];

    configureSVGLayout();
    scaleOverlay();
    
    // Força a âncora inicial da imagem e dos textos para o estado oculto
    DOM_CACHE.covers[1].classList.add("visible");
    DOM_CACHE.lines.forEach(els => {
        els.svg.classList.add("hiding-text");
        els.svg.classList.remove("visible-text");
    });

    // Se o usuário apenas ocultar/desocultar a fonte sem reiniciar (Shutdown source when not visible = OFF)
    document.addEventListener("visibilitychange", () => {
        if (STATE.player.isBooting) return; 

        if (document.visibilityState === "visible") {
            setTimeout(() => {
                DOM_CACHE.lines.forEach((els, i) => {
                    if (STATE.player.textCache[i]) {
                        els.svg.classList.remove("hiding-text");
                        els.svg.classList.add("visible-text");
                    }
                });
            }, 400);
        } else {
            DOM_CACHE.lines.forEach(els => {
                els.svg.classList.remove("visible-text");
                els.svg.classList.add("hiding-text");
            });
        }
    });

    pollDataEngine();
}

function scaleOverlay() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const baseW = IS_VERTICAL ? 2160 : 3840;
    const baseH = IS_VERTICAL ? 3840 : 2160;
    const scale = Math.min(w / baseW, h / baseH);
    DOM_CACHE.wrapper.style.transform = scale < 1 ? `scale(${scale})` : `scale(1)`;
}

function configureSVGLayout() {
    const setAttrOpt = (el, x, y, size, anchor) => {
        el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('font-size', size);
        if (anchor) el.setAttribute('text-anchor', anchor); 
    };

    if (IS_VERTICAL) {
        DOM_CACHE.lines[0].svg.setAttribute('viewBox', '0 0 2160 240');
        setAttrOpt(DOM_CACHE.lines[0].shadow, '50%', '150', '140', 'middle'); 
        setAttrOpt(DOM_CACHE.lines[0].main, '50%', '148', '140', 'middle');
        DOM_CACHE.lines[1].svg.setAttribute('viewBox', '0 0 2160 240');
        setAttrOpt(DOM_CACHE.lines[1].shadow, '50%', '120', '110', 'middle'); 
        setAttrOpt(DOM_CACHE.lines[1].main, '50%', '118', '110', 'middle');
        DOM_CACHE.lines[2].svg.setAttribute('viewBox', '0 0 2160 240');
        setAttrOpt(DOM_CACHE.lines[2].shadow, '50%', '120', '100', 'middle'); 
        setAttrOpt(DOM_CACHE.lines[2].main, '50%', '118', '100', 'middle');
    } else {
        DOM_CACHE.lines[0].svg.setAttribute('viewBox', '0 0 2400 240');
        setAttrOpt(DOM_CACHE.lines[0].shadow, '22', '118', '124', null); 
        setAttrOpt(DOM_CACHE.lines[0].main, '20', '116', '124', null);
        DOM_CACHE.lines[1].svg.setAttribute('viewBox', '0 0 2400 240');
        setAttrOpt(DOM_CACHE.lines[1].shadow, '22', '92', '100', null); 
        setAttrOpt(DOM_CACHE.lines[1].main, '20', '90', '100', null);
        DOM_CACHE.lines[2].svg.setAttribute('viewBox', '0 0 2400 240');
        setAttrOpt(DOM_CACHE.lines[2].shadow, '22', '92', '100', null); 
        setAttrOpt(DOM_CACHE.lines[2].main, '20', '90', '100', null);
    }
}

const STATE = { 
    player: { activeIdx: 1, lastTextHash: null, textCache: {}, isBooting: true } 
};

async function pollDataEngine() {
    // 1. O CORAÇÃO DO SISTEMA: A Cover Art agora aceita um Callback (onComplete)
    const applyCoverArt = (url, onComplete) => {
        const targetId = STATE.player.activeIdx === 1 ? 2 : 1;
        const currentId = STATE.player.activeIdx;
        const targetImg = DOM_CACHE.covers[targetId - 1]; 
        const currentImg = DOM_CACHE.covers[currentId - 1];

        targetImg.onload = null; targetImg.onerror = null;
        targetImg.dataset.pendingUrl = url;

        const finalize = () => {
            if (targetImg.dataset.pendingUrl === url) {
                targetImg.classList.add("visible"); 
                targetImg.classList.remove("hidden");
                currentImg.classList.remove("visible"); 
                currentImg.classList.add("hidden");
                STATE.player.activeIdx = targetId;
                
                // Dispara o texto exatamente no milissegundo em que a imagem é pintada
                if (onComplete) onComplete(); 
            }
        };

        targetImg.onload = finalize;

        targetImg.onerror = () => {
            targetImg.onerror = null; 
            if (url !== "placeholder.png" && targetImg.dataset.pendingUrl === url) {
                targetImg.src = "placeholder.png"; 
            } else {
                finalize();
            }
        };

        targetImg.src = url;
    };

    try {
        const textRes = await fetch(`now_playing.txt`, { cache: "no-store" });
        if (textRes.ok) {
            const rawText = await textRes.text();
            
            if (rawText !== STATE.player.lastTextHash) {
                const isFirstLoad = STATE.player.lastTextHash === null;
                STATE.player.lastTextHash = rawText;
                
                const parts = rawText.split('|');
                const title = parts[0] ? parts[0].trim() : "";
                const artist = parts[1] ? parts[1].trim() : "";
                const album = parts[2] ? parts[2].trim() : "";
                const albumArtist = parts[3] ? parts[3].trim() : "";
                const filename = parts[4] ? parts[4].trim() : ""; 
                
                const line1 = title ? `『${title}』` : "";
                let line2 = album || "";
                if (album && albumArtist && album !== albumArtist) line2 += ` - ${albumArtist}`;
                else if (albumArtist) line2 = albumArtist;
                const line3 = artist || ""; 
                
                const newTexts = [line1, line2, line3];
                const targetUrl = (title && title !== "?" && filename) ? `Playlist/cover/${filename}.jpg` : "placeholder.png";

                // Gatilho mestre: É chamado SOMENTE quando a imagem estiver 100% carregada no navegador
                const revealText = () => {
                    setTimeout(() => {
                        DOM_CACHE.lines.forEach((els, i) => {
                            if (STATE.player.textCache[i]) {
                                els.svg.classList.remove("hiding-text");
                                els.svg.classList.add("visible-text");
                            }
                        });
                        if (isFirstLoad) STATE.player.isBooting = false;
                    }, 50); // Tick de 50ms apenas para garantir que a GPU terminou o reflow
                };

                if (isFirstLoad) {
                    // BOOT: O texto é injetado, mas fica escondido nas sombras aguardando a imagem.
                    for (let i = 0; i < 3; i++) {
                        const text = newTexts[i];
                        const els = DOM_CACHE.lines[i];
                        STATE.player.textCache[i] = text;
                        els.svg.classList.add("hiding-text");
                        els.svg.classList.remove("visible-text");
                        els.main.textContent = text;
                        els.shadow.textContent = text;
                    }
                    
                    // Dispara a imagem e passa o callback do texto
                    applyCoverArt(targetUrl, revealText);

                } else {
                    // TROCA DE MÚSICA NORMAL: Recolhe o texto antigo primeiro
                    for (let i = 0; i < 3; i++) {
                        const els = DOM_CACHE.lines[i];
                        els.svg.classList.add("hiding-text");
                        els.svg.classList.remove("visible-text");
                    }

                    // Espera os 400ms do CSS terminar de fechar a cortina antes de injetar o novo
                    setTimeout(() => {
                        for (let i = 0; i < 3; i++) {
                            const text = newTexts[i];
                            const els = DOM_CACHE.lines[i];
                            STATE.player.textCache[i] = text;
                            els.main.textContent = text;
                            els.shadow.textContent = text;
                        }
                        
                        // Troca a imagem e novamente escraviza o texto a ela
                        applyCoverArt(targetUrl, revealText);
                    }, 400); 
                }
            }
        }
    } catch (e) {
        console.error("Falha crítica no pollDataEngine:", e);
    }

    setTimeout(pollDataEngine, CONFIG.player.interval);
}