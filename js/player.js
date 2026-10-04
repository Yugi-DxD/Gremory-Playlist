const DOM_CACHE = {
    covers: null,
    lines: null,
    wrapper: null
};

function initPlayer() {
    DOM_CACHE.wrapper = document.getElementById('player-wrapper');
    DOM_CACHE.wrapper.classList.add(IS_VERTICAL ? 'vertical' : 'horizontal');
    
    // TRAVA DA COVER ART: Mata a renderização da imagem se estiver desativado
    if (CONFIG.player.showCoverArt === false) {
        document.querySelector('.cover-container').style.display = 'none';
    }
    
    DOM_CACHE.covers = [document.getElementById('coverImg1'), document.getElementById('coverImg2')];
    DOM_CACHE.lines = [
        { main: document.getElementById("svgText1"), shadow: document.getElementById("svgText1-shadow"), svg: document.getElementById("line1-svg") },
        { main: document.getElementById("svgText2"), shadow: document.getElementById("svgText2-shadow"), svg: document.getElementById("line2-svg") },
        { main: document.getElementById("svgText3"), shadow: document.getElementById("svgText3-shadow"), svg: document.getElementById("line3-svg") }
    ];

    configureSVGLayout();
    scaleOverlay();
    
    // Força a âncora inicial da imagem e dos textos para o estado oculto
    DOM_CACHE.covers[0].classList.add("visible");
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
    if (!DOM_CACHE.wrapper) return;
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
    player: { activeIdx: 1, lastTextHash: null, textCache: {}, isBooting: true, revision: 0 }
};

async function updateTrack(rawText) {
    const revision = ++STATE.player.revision;
    const first = STATE.player.isBooting;
    const parts = rawText.replace(/^\uFEFF/, '').trim().split('|').map(part => part.trim());
    const [title = '', artist = '', album = '', albumArtist = '', filename = ''] = parts;
    const line2 = album && albumArtist && album !== albumArtist ? `${album} - ${albumArtist}` : albumArtist || album;
    const texts = [title ? `『${title}』` : '', line2, artist];
    DOM_CACHE.lines.forEach(({svg}) => {
        svg.classList.add('hiding-text'); svg.classList.remove('visible-text');
    });
    if (!first) await new Promise(resolve => setTimeout(resolve, 400));
    if (revision !== STATE.player.revision) return;
    DOM_CACHE.lines.forEach((els, i) => {
        STATE.player.textCache[i] = texts[i];
        els.main.textContent = els.shadow.textContent = texts[i];
    });
    // Texto nunca fica bloqueado por capa ausente, timeout ou erro de decodificação.
    setTimeout(() => {
        if (revision !== STATE.player.revision) return;
        DOM_CACHE.lines.forEach(({svg}, i) => {
            svg.classList.toggle('visible-text', !!texts[i]);
            svg.classList.toggle('hiding-text', !texts[i]);
        });
        STATE.player.isBooting = false;
    }, 50);
    if (CONFIG.player.showCoverArt === false) return;
    const url = title && title !== '?' && filename ? `Playlist/cover/${encodeURIComponent(filename)}.jpg` : 'placeholder.png';
    let image;
    try {
        image = await OverlayRuntime.loadImage(url);
        if (revision === STATE.player.revision) OverlayRuntime.report('Capa', `Carregada: ${url}`);
    } catch (error) {
        if (revision !== STATE.player.revision) return;
        OverlayRuntime.report('Capa', `${error.message}; tentando placeholder.png`, true);
        if (url !== 'placeholder.png') {
            try { image = await OverlayRuntime.loadImage('placeholder.png'); }
            catch (_) { /* Textos permanecem visíveis. */ }
        }
    }
    if (revision !== STATE.player.revision) return;
    if (!image) {
        DOM_CACHE.covers.forEach(img => { img.classList.remove('visible'); img.classList.add('hidden'); });
        OverlayRuntime.report('Capa', 'Capa e placeholder indisponíveis; textos continuam ativos.', true);
        return;
    }
    const target = STATE.player.activeIdx === 1 ? 2 : 1;
    const next = DOM_CACHE.covers[target - 1];
    const previous = DOM_CACHE.covers[STATE.player.activeIdx - 1];
    next.src = image.src;
    next.classList.remove('hidden'); next.classList.add('visible');
    previous.classList.remove('visible'); previous.classList.add('hidden');
    STATE.player.activeIdx = target;
}

async function pollDataEngine() {
    try {
        const rawText = await OverlayRuntime.readText('now_playing.txt');
        const cleaned = rawText.replace(/^\uFEFF/, '').trim();
        // Evita capturar uma escrita parcial do NowPlaying2. Vazio limpa a faixa.
        if (cleaned && cleaned.split('|').length < 5) throw new Error('now_playing.txt incompleto: esperado título|artista|álbum|artista do álbum|arquivo');
        OverlayRuntime.report('NowPlaying2', cleaned ? 'Arquivo lido; atualização automática ativa.' : 'Arquivo vazio; aguardando reprodução.');
        if (rawText !== STATE.player.lastTextHash) {
            STATE.player.lastTextHash = rawText;
            updateTrack(rawText).catch(error => OverlayRuntime.report('Player', error.message, true));
        }
    } catch (error) {
        OverlayRuntime.report('NowPlaying2', `${error.message}. Verifique o arquivo na pasta do index.html; se o acesso interno falhar, use o modo localhost do LEIA-ME.`, true);
    } finally {
        setTimeout(pollDataEngine, Math.max(250, Number(CONFIG.player.interval) || 2000));
    }
}
