class LumaSlideshow {
    constructor(canvasId, imagesArray, config) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext('webgl2', { 
            alpha: false, antialias: false, depth: false, stencil: false,
            powerPreference: "high-performance", desynchronized: true 
        });
        this.config = config; 
        this.imagesUrls = imagesArray;
        this.texA = null; this.texB = null;
        this.activeTexId = 0; 
        this.resA = new Float32Array(2); this.resB = new Float32Array(2);
        
        this.isTransitioning = false;
        this.transitionStartTime = 0;
        this.isReady = false; // Flag de segurança de estado
        
        this.renderLoop = this.renderLoop.bind(this);
        this.resize = this.resize.bind(this);
    }

    // Inicialização assíncrona que importa os shaders externos
    async init() {
        try {
            const [vsRes, fsRes] = await Promise.all([
                fetch('shaders/luma.vert', { cache: "no-store" }),
                fetch('shaders/luma.frag', { cache: "no-store" })
            ]);
            
            if (!vsRes.ok || !fsRes.ok) throw new Error("Erro de I/O ao importar shaders.");
            
            const vsSource = await vsRes.text();
            const fsSource = await fsRes.text();
            
            this.initWebGL(vsSource, fsSource);
            this.isReady = true;
            this.startSlideshow();
        } catch (e) {
            console.error("[WebGL Boot] Falha crítica ao iniciar LumaSlideshow:", e);
        }
    }

    initWebGL(vsSource, fsSource) {
        const gl = this.gl;
        
        const compile = (type, src) => {
            const s = gl.createShader(type); gl.shaderSource(s, src);
            gl.compileShader(s); 
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error("Shader Compile Error:", gl.getShaderInfoLog(s));
            }
            return s;
        };

        const vs = compile(gl.VERTEX_SHADER, vsSource);
        const fs = compile(gl.FRAGMENT_SHADER, fsSource);
        
        this.program = gl.createProgram(); 
        gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); 
        gl.linkProgram(this.program); gl.useProgram(this.program);
        
        gl.deleteShader(vs); gl.deleteShader(fs);
        
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); 
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
        
        const posLoc = gl.getAttribLocation(this.program, 'position'); 
        gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        this.uProgress = gl.getUniformLocation(this.program, 'progress'); 
        this.uResCurrent = gl.getUniformLocation(this.program, 'resCurrent'); 
        this.uResNext = gl.getUniformLocation(this.program, 'resNext'); 
        this.uCanvasRes = gl.getUniformLocation(this.program, 'canvasRes');
        
        gl.uniform1i(gl.getUniformLocation(this.program, 'texCurrent'), 0); 
        gl.uniform1i(gl.getUniformLocation(this.program, 'texNext'), 1); 
        gl.uniform1f(gl.getUniformLocation(this.program, 'softness'), this.config.softness);

        const vConf = this.config.vignette;
        gl.uniform3f(gl.getUniformLocation(this.program, 'u_vColor'), vConf.color.r/255, vConf.color.g/255, vConf.color.b/255);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_vSize'), vConf.size);
        // Forçamos a opacidade da vinheta do WebGL para ZERO. 
        // O efeito visual agora é inteiramente gerenciado pela camada CSS global.
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_vOpacity'), 0.0);
        
        const modeStr = (vConf.blendMode || 'multiply').toLowerCase().trim();
        const modeFloat = modeStr === 'screen' ? 2.0 : (modeStr === 'normal' ? 0.0 : 1.0);
        
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_vBlend'), modeFloat);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_invertLuma'), this.config.invertLuma ? 1.0 : 0.0);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_isVerticalVignette'), vConf.isVerticalVignette ? 1.0 : 0.0);

        this.texA = this.createEmptyTexture(); this.texB = this.createEmptyTexture();
        this.resize(); 
    }
    
    createEmptyTexture() {
        const gl = this.gl; const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    }

    resize() { 
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; 
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); 
        this.gl.uniform2f(this.uCanvasRes, this.canvas.width, this.canvas.height); 
        this.draw(0.0);
    }

    async fetchImageBitmap(basePath) {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => createImageBitmap(img).then(resolve).catch(reject);
            img.onerror = () => reject(new Error(`I/O Falhou: Arquivo não encontrado -> ${basePath}.avif`));
            img.src = basePath + '.avif';
        });
    }

    async startSlideshow() {
        try {
            const sync = this.getGlobalSyncData(0); 
            const bag = this.generateSeededBag(sync.cycleSeed, this.imagesUrls.length);
            
            const currentBitmap = await this.fetchImageBitmap(this.imagesUrls[bag[sync.indexInCycle]]);
            this.updateTextureObj(this.texA, this.resA, currentBitmap);
            this.draw(0.0);
            
            this.preloadAndScheduleNext();
        } catch (e) {
            console.error("[I/O Error] Falha ao iniciar ciclo de imagens.", e);
            this.preloadAndScheduleNext();
        }
    }

    preloadAndScheduleNext() {
        const nextSync = this.getGlobalSyncData(this.config.duration); 
        const bag = this.generateSeededBag(nextSync.cycleSeed, this.imagesUrls.length);
        const nextIndex = bag[nextSync.indexInCycle];
        
        const targetTex = this.activeTexId === 0 ? this.texB : this.texA;
        const targetRes = this.activeTexId === 0 ? this.resB : this.resA;

        this.fetchImageBitmap(this.imagesUrls[nextIndex]).then(bitmap => {
            this.updateTextureObj(targetTex, targetRes, bitmap);
            
            const currentSync = this.getGlobalSyncData(0);
            
            setTimeout(() => {
                this.isTransitioning = true;
                this.transitionStartTime = performance.now();
                requestAnimationFrame(this.renderLoop); 
            }, currentSync.timeToNext);
            
        }).catch(e => {
            console.error("[I/O Error] Falha ao carregar frame. Tentando recuperar...", e);
            setTimeout(() => this.preloadAndScheduleNext(), 1000);
        });
    }

    renderLoop(currentTime) {
        if (!this.isTransitioning) return;

        if (document.visibilityState !== 'visible') {
            this.isTransitioning = false;
            this.activeTexId = this.activeTexId === 0 ? 1 : 0;
            this.preloadAndScheduleNext();
            return;
        }

        let progress = Math.min((currentTime - this.transitionStartTime) / this.config.transition, 1.0);
        this.draw(progress);
        
        if (progress < 1.0) { 
            requestAnimationFrame(this.renderLoop); 
        } else { 
            this.isTransitioning = false; 
            this.activeTexId = this.activeTexId === 0 ? 1 : 0; 
            this.draw(0.0); 
            
            this.preloadAndScheduleNext(); 
        }
    }

    updateTextureObj(texObj, resArray, bitmap) {
        const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, texObj);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        gl.generateMipmap(gl.TEXTURE_2D);
        resArray[0] = bitmap.width; resArray[1] = bitmap.height;
        bitmap.close(); 
    }

    seededRandom(seed) {
        let a = seed;
        return function() {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    generateSeededBag(seed, count) {
        const createBag = (s) => {
            let arr = Array.from({ length: count }, (_, i) => i);
            let rng = this.seededRandom(s);
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        let currentBag = createBag(seed);
        if (seed > 0) {
            let prevBag = createBag(seed - 1);
            if (currentBag[0] === prevBag[count - 1] && count > 1) {
                [currentBag[0], currentBag[1]] = [currentBag[1], currentBag[0]];
            }
        }
        return currentBag;
    }

    getGlobalSyncData(offsetMs = 0) {
        const count = this.imagesUrls.length;
        const duration = this.config.duration;
        const cycleDurationMs = count * duration; 
        const targetTime = Date.now() + offsetMs;
        
        const cycleSeed = Math.floor(targetTime / cycleDurationMs);
        const indexInCycle = Math.floor((targetTime % cycleDurationMs) / duration);
        const timeToNext = duration - (targetTime % duration);
        
        return { cycleSeed, indexInCycle, timeToNext };
    }

    draw(progress = 0.0) {
        const gl = this.gl;
        const texC = this.activeTexId === 0 ? this.texA : this.texB;
        const texN = this.activeTexId === 0 ? this.texB : this.texA;
        const resC = this.activeTexId === 0 ? this.resA : this.resB;
        const resN = this.activeTexId === 0 ? this.resB : this.resA;
        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texC); gl.uniform2f(this.uResCurrent, resC[0], resC[1]);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texN); gl.uniform2f(this.uResNext, resN[0], resN[1]);
        gl.uniform1f(this.uProgress, progress);
        
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

// O motor agora é assíncrono para dar suporte ao Fetch dos shaders
async function initBackground() {
    const prefix = IS_VERTICAL ? 'v_DxD' : 'h_DxD';
    const maxCount = IS_VERTICAL ? CONFIG.slideshow.imageCount.vertical : CONFIG.slideshow.imageCount.horizontal;
    
    const slideImages = Array.from({ length: maxCount }, (_, i) => `img/${ASSET_FOLDER}/${prefix}${i}`);
    
    const engine = new LumaSlideshow('glCanvas', slideImages, CONFIG.slideshow);
    await engine.init(); 
    return engine;
}
