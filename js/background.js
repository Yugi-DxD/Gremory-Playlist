class LumaSlideshow {
    constructor(canvasId, imagesArray, config) {
        this.canvas = document.getElementById(canvasId);
        this.config = config;
        this.imagesUrls = imagesArray;
        this.activeTexId = 0;
        this.resA = new Float32Array([1, 1]);
        this.resB = new Float32Array([1, 1]);
        this.isReady = false;
        this.generation = 0;
        this.timer = null;
        this.raf = null;
        this.fallback = false;
        this.renderLoop = this.renderLoop.bind(this);
        this.canvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            this.stop();
            OverlayRuntime.report('Fundo', 'Contexto WebGL perdido; aguardando restauração.', true);
        });
        this.canvas.addEventListener('webglcontextrestored', () => { this.init(); });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isReady && !this.isTransitioning && !this.fallback) this.draw(0);
        });
    }

    stop() {
        this.generation++;
        clearTimeout(this.timer);
        cancelAnimationFrame(this.raf);
        this.isTransitioning = false;
        this.isReady = false;
    }

    async init() {
        this.stop();
        if (!this.imagesUrls.length || !Number.isFinite(this.config.duration) || this.config.duration <= 0) {
            throw new Error('Quantidade de imagens e duração devem ser positivas.');
        }
        try {
            const options = { alpha: false, antialias: false, depth: false, stencil: false };
            if (this.config.renderer === 'css') throw new Error('Modo CSS selecionado no config.js');
            this.gl = this.config.renderer === 'webgl1' ? null : this.canvas.getContext('webgl2', options);
            this.isWebGL2 = !!this.gl;
            if (!this.gl) this.gl = this.canvas.getContext('webgl', options);
            if (!this.gl) throw new Error('WebGL indisponível');
            this.initWebGL(LUMA_SHADERS.vert, LUMA_SHADERS.frag);
            OverlayRuntime.report('Renderização', this.isWebGL2 ? 'WebGL 2 / LumaFade' : 'WebGL 1 / LumaFade');
        } catch (error) {
            OverlayRuntime.report('Renderização', `${error.message}. Usando crossfade CSS (sem LumaFade).`, true);
            this.initFallback();
        }
        this.isReady = true;
        await this.startSlideshow();
    }

    initWebGL(vsSource, fsSource) {
        const gl = this.gl;
        const compile = (type, source) => {
            const shader = gl.createShader(type);
            if (!shader) throw new Error('Não foi possível criar shader');
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(`Compilação do shader: ${log}`);
            }
            return shader;
        };
        let vs, fs, program;
        try {
            vs = compile(gl.VERTEX_SHADER, vsSource);
            fs = compile(gl.FRAGMENT_SHADER, fsSource);
            program = gl.createProgram();
            gl.attachShader(program, vs); gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Link do shader: ${gl.getProgramInfoLog(program)}`);
        } catch (error) {
            if (program) gl.deleteProgram(program);
            throw error;
        } finally {
            if (vs) gl.deleteShader(vs);
            if (fs) gl.deleteShader(fs);
        }
        this.program = program;
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        if (position < 0) throw new Error('Atributo position ausente');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        this.uProgress = gl.getUniformLocation(program, 'progress');
        this.uResCurrent = gl.getUniformLocation(program, 'resCurrent');
        this.uResNext = gl.getUniformLocation(program, 'resNext');
        this.uCanvasRes = gl.getUniformLocation(program, 'canvasRes');
        gl.uniform1i(gl.getUniformLocation(program, 'texCurrent'), 0);
        gl.uniform1i(gl.getUniformLocation(program, 'texNext'), 1);
        gl.uniform1f(gl.getUniformLocation(program, 'softness'), Math.max(0.001, this.config.softness));
        gl.uniform1f(gl.getUniformLocation(program, 'u_invertLuma'), this.config.invertLuma ? 1 : 0);
        // Vinheta continua na camada CSS; valores válidos mesmo com opacidade zero.
        gl.uniform1f(gl.getUniformLocation(program, 'u_vSize'), 0.6);
        gl.uniform1f(gl.getUniformLocation(program, 'u_vOpacity'), 0);
        this.texA = this.createEmptyTexture(); this.texB = this.createEmptyTexture();
        this.resA.set([1,1]); this.resB.set([1,1]); this.activeTexId = 0;
        this.resize();
    }

    createEmptyTexture() {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
        return texture;
    }

    initFallback() {
        if (this.fallback) return;
        this.fallback = true;
        this.canvas.style.display = 'none';
        this.layers = [0,1].map(() => {
            const img = document.createElement('img');
            img.alt = '';
            img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0';
            this.canvas.parentNode.appendChild(img);
            return img;
        });
        this.activeLayer = 0;
    }

    resize() {
        if (this.fallback || !this.gl || !this.program) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.uniform2f(this.uCanvasRes, this.canvas.width, this.canvas.height);
        this.draw(this.isTransitioning ? this.lastProgress || 0 : 0);
    }

    async fetchImageBitmap(basePath) {
        const image = await OverlayRuntime.loadImage(basePath + '.avif');
        if (this.fallback || typeof createImageBitmap !== 'function') return image;
        try { return await createImageBitmap(image); }
        catch (_) { return image; }
    }

    async loadAvailable(sync, generation) {
        const bag = this.generateSeededBag(sync.cycleSeed, this.imagesUrls.length);
        for (let offset = 0; offset < bag.length; offset++) {
            if (generation !== this.generation) return null;
            const url = this.imagesUrls[bag[(sync.indexInCycle + offset) % bag.length]];
            try {
                const image = await this.fetchImageBitmap(url);
                if (generation !== this.generation) { image.close?.(); return null; }
                return { image, url: url + '.avif' };
            } catch (error) { OverlayRuntime.report('Arquivo do fundo', error.message, true); }
        }
        throw new Error('Nenhum fundo carregou. Confira img, resolução, quantidade e arquivos AVIF.');
    }

    async startSlideshow() {
        const generation = this.generation;
        try {
            const asset = await this.loadAvailable(this.getGlobalSyncData(0), generation);
            if (!asset) return;
            if (this.fallback) {
                this.layers[0].src = asset.url;
                this.layers[0].style.opacity = '1';
            } else {
                try {
                    this.updateTextureObj(this.texA, this.resA, asset.image);
                    this.updateTextureObj(this.texB, this.resB, asset.image);
                } finally { asset.image.close?.(); }
                this.draw(0);
            }
            OverlayRuntime.report('Fundo', `Carregado: ${asset.url}`);
            this.preloadAndScheduleNext();
        } catch (error) {
            if (generation !== this.generation) return;
            if (error.textureUpload && !this.fallback) {
                OverlayRuntime.report('Renderização', `${error.message}. Usando crossfade CSS (sem LumaFade).`, true);
                this.initFallback();
                this.startSlideshow();
                return;
            }
            OverlayRuntime.report('Fundo', error.message, true);
            this.timer = setTimeout(() => this.startSlideshow(), 5000);
        }
    }

    async preloadAndScheduleNext() {
        const generation = this.generation;
        try {
            const asset = await this.loadAvailable(this.getGlobalSyncData(this.config.duration), generation);
            if (!asset) return;
            if (this.fallback) {
                const next = this.layers[1 - this.activeLayer];
                next.style.transition = 'none'; next.style.opacity = '0'; next.src = asset.url;
            } else {
                try { this.updateTextureObj(this.activeTexId === 0 ? this.texB : this.texA,
                    this.activeTexId === 0 ? this.resB : this.resA, asset.image); }
                finally { asset.image.close?.(); }
            }
            this.timer = setTimeout(() => {
                if (generation !== this.generation) return;
                if (this.fallback) {
                    const next = 1 - this.activeLayer;
                    this.layers[next].style.transition = `opacity ${this.config.transition}ms linear`;
                    this.layers[this.activeLayer].style.transition = `opacity ${this.config.transition}ms linear`;
                    this.layers[next].style.opacity = '1';
                    this.layers[this.activeLayer].style.opacity = '0';
                    this.activeLayer = next;
                    this.timer = setTimeout(() => this.preloadAndScheduleNext(), this.config.transition);
                } else {
                    this.isTransitioning = true;
                    this.transitionStartTime = performance.now();
                    this.raf = requestAnimationFrame(this.renderLoop);
                }
            }, this.getGlobalSyncData(0).timeToNext);
        } catch (error) {
            if (generation !== this.generation) return;
            if (error.textureUpload && !this.fallback) {
                OverlayRuntime.report('Renderização', `${error.message}. Usando crossfade CSS (sem LumaFade).`, true);
                this.initFallback();
                this.startSlideshow();
                return;
            }
            OverlayRuntime.report('Fundo', error.message, true);
            this.timer = setTimeout(() => this.preloadAndScheduleNext(), 5000);
        }
    }

    renderLoop(time) {
        if (!this.isTransitioning || !this.isReady) return;
        const progress = Math.min((time - this.transitionStartTime) / Math.max(1, this.config.transition), 1);
        this.lastProgress = progress;
        this.draw(progress);
        if (progress < 1) this.raf = requestAnimationFrame(this.renderLoop);
        else {
            this.isTransitioning = false;
            this.activeTexId = 1 - this.activeTexId;
            this.draw(0);
            this.preloadAndScheduleNext();
        }
    }

    updateTextureObj(texture, resolution, image) {
        const gl = this.gl;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (width > gl.getParameter(gl.MAX_TEXTURE_SIZE) || height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('Imagem excede MAX_TEXTURE_SIZE da GPU');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            if (gl.getError() !== gl.NO_ERROR) throw new Error('Falha ao enviar imagem para WebGL');
        } catch (error) {
            error.textureUpload = true;
            throw error;
        }
        resolution.set([width, height]);
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

    draw(progress = 0) {
        const gl = this.gl;
        const currentA = this.activeTexId === 0;
        const resC = currentA ? this.resA : this.resB;
        const resN = currentA ? this.resB : this.resA;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, currentA ? this.texA : this.texB);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, currentA ? this.texB : this.texA);
        gl.uniform2f(this.uResCurrent, resC[0], resC[1]);
        gl.uniform2f(this.uResNext, resN[0], resN[1]);
        gl.uniform1f(this.uProgress, progress);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

async function initBackground() {
    const prefix = IS_VERTICAL ? 'v_DxD' : 'h_DxD';
    const count = IS_VERTICAL ? CONFIG.slideshow.imageCount.vertical : CONFIG.slideshow.imageCount.horizontal;
    if (!Number.isInteger(count) || count < 1) throw new Error('imageCount precisa ser um inteiro positivo');
    const images = Array.from({length: count}, (_, i) => `img/${ASSET_FOLDER}/${prefix}${i}`);
    const engine = new LumaSlideshow('glCanvas', images, CONFIG.slideshow);
    await engine.init();
    return engine;
}
