# Overlay Gremory-Playlist (OBS Studio)

<img width="2560" height="1392" alt="image" src="https://github.com/user-attachments/assets/3e53efa1-c595-480e-aba6-b95a2552e8f5" />

Este projeto é um Overlay Modular projetado especificamente para transmissões ao vivo via OBS Studio. Ele possui um fundo dinâmico e animado (WebGLLumaSlideshow que pode ser desativado, deixando o fundo transparente), além de um player de música elegante que exibe informações de faixa em tempo real (Now Playing) e *cover arts*(que também pode ser desativado), sem depender de plataformas de streaming externas ou de widgets embutidos pesados no OBS.

Para as *cover arts* funcionarem, elas necessitam ter o mesmo nome do arquivo de música.

## 🚀 Por que usar este sistema em vez de plugins externos (ex: Tuna)?

Plugins como o **Tuna** e ferramentas que se integram via WebSockets direto no OBS são muito populares, no entanto, este sistema web puro oferece benefícios arquiteturais imensos:

* **Desempenho Extremo e Isolamento:** Ao usar HTML/CSS/JS e processar via placa de vídeo (GPU) nativa do navegador do OBS, o sistema de música e o slideshow animado correm numa thread completamente isolada. Plugins que operam dentro das amarras da interface nativa do OBS costumam disputar ciclos de renderização principal.
* **Transições Independentes de Fonte:** O motor de renderização resolve o problema crônico de cortes secos do CEF. Se você ocultar ou exibir a fonte, a animação não quebra. Ela aguarda inteligentemente o *paint timing* do Chromium e exibe o texto com transição fluida, o que plugins como Tuna muitas vezes não conseguem lidar se forem vinculados a textos GDI+ estáticos no OBS.
* **Custo Zero de CPU com `requestAnimationFrame`:** O I/O de disco da *cover art* e os ciclos de fundo dinâmicos não engasgam graças à otimização brutal em `fetchImageBitmap()`.
* **Flexibilidade Visual Absoluta:** Toda a customização visual (degradês, tamanhos, `cubic-bezier`, CSS filters, WebGL vignette) está a alguns caracteres de distância no seu arquivo `layout.css`, garantindo que não existam bordas gráficas rígidas que você encontraria no configurador visual de plugins de terceiros.
* **100% Offline (Zero Delay de API):** Como as informações são processadas via `.txt` local emitido pelo Foobar2000, você não depende das APIs do Spotify, YouTube Music ou Last.fm (que além de possuírem delay natural, podem falhar com *Rate Limits*).

---

## 🖼️ Setup dos Backgrounds Animados (Slideshow)

Para atingir o desempenho máximo e evitar que a GPU engasgue no event loop do OBS, o sistema de *fallback* automático de imagens (que procurava png, jpg, etc.) foi propositalmente **removido**. O sistema é burro e rápido: ele vai buscar o arquivo exato no lugar exato. Se você não seguir as regras abaixo, o fundo não carregará.

### 1. Formato Exclusivo: `.avif`
O script do WebGL lê **única e exclusivamente** arquivos no formato `.avif`. Não insira `.jpg`, `.png` ou `.webp`. Converta todos os seus *assets* de background previamente para `.avif`.

### 2. Estrutura de Resolução (Pastas)
O sistema lê automaticamente as dimensões da Fonte de Navegador que você definiu no OBS e puxa a imagem da pasta correspondente para economizar memória de vídeo (VRAM). Você deve organizar suas imagens nas seguintes pastas dentro do diretório `img/`:
* `img/1080p/` → Para fontes dimensionadas até 1920x1080.
* `img/1440p/` → Para fontes dimensionadas até 2560x1440 (Quad HD).
* `img/2160p/` → Para fontes dimensionadas até 3840x2160 (4K).

### 3. Orientação e Nomenclatura
O layout ajusta sua física dependendo se a fonte é Vertical (ex: 2160x3840) ou Horizontal (ex: 3840x2160). As imagens também precisam respeitar essa orientação física. Nomeie as sequências a partir de `0`:
* **No Overlay de Música:** Use os prefixos `h_DxD` (Horizontal) e `v_DxD` (Vertical). Ex: `h_DxD0.avif`, `h_DxD1.avif`.
* **No Overlay Principal (HUD):** Use os prefixos `h_bg` (Horizontal) e `v_bg` (Vertical). Ex: `h_bg0.avif`, `h_bg1.avif`.

---

## ⚙️ Setup do Foobar2000 + Now Playing 2

Para que o overlay do player de música funcione perfeitamente, precisamos conectar o player local ao overlay web. Nós usamos o **Foobar2000** em conjunto com o componente **Now Playing 2**.

### Passo 1: Instalação do Componente

1. Baixe e instale o [Foobar2000](https://www.foobar2000.org/).
2. Faça o download do componente **[Now Playing 2](https://github.com/foxx1337/foo_nowplaying2)** (geralmente distribuído com extensão `.fb2k-component`).
3. Abra o Foobar2000 e navegue até `File > Preferences > Components`.
4. Clique em `Install...`, selecione o arquivo do Now Playing 2 baixado e aplique. O Foobar pedirá para reiniciar.

### Passo 2: Configurando o Now Playing 2

A arquitetura do nosso arquivo `player.js` depende de um formato muito estrito gerado em um arquivo de texto local (`now_playing.txt`).

<img width="740" height="546" alt="image" src="https://github.com/user-attachments/assets/0da42d4b-b0a5-4744-bc6e-ff7fc962a31a" />

1. No Foobar2000, vá para `File > Preferences > Tools > Now Playing 2`.
2. Na guia **Format String**, precisamos criar o output exato que o JavaScript do Overlay vai ler (Title, Artist, Album, Album Artist e Filename).
3. **Cole a seguinte formatação exata na caixa de texto do Output:**

   ```text
   %title%|%artist%|%album%|%album artist%|%filename%

---

## ⚙️ Setup do OBS

### Passo 1: Importando o Overlay

Para importar o sistema para o OBS, basta inserir uma Fonte de Navegador e marcar a opção **Arquivo Local** e configurar a resolução desejada. 

<img width="1252" height="1140" alt="image" src="https://github.com/user-attachments/assets/fe53a266-7a2d-453b-8e35-e6ff2a6d0c93" />

1. No OBS, adiciona uma nova **Fonte de Navegador**.
2. Marque **"Arquivo Local"** e selecione o arquivo **index.html**.
3. Digite a largura e a altura conforme a sua área de edição (O sistema automaticamente se reorganiza caso for colocado uma resolução vertical).
4. Marque as opções **"Desativar fonte quando invisível"** e **"Atualizar o navegador quando a fonte se tornar ativa"**.

### Passo 2: Adicionando o Áudio

Já para adicionar o áudio do Foobar2000:

<img width="847" height="496" alt="image" src="https://github.com/user-attachments/assets/2b30af83-e1c4-44b9-a0ab-7489c0e41425" />


1. No OBS, adicione uma nova fonte de **"Captura de áudio de aplicativo (BETA)"**
2. Selecione a janela do **Foobar2000**
