# Overlay Gremory-Playlist (OBS Studio)

Este projeto é um Overlay Modular projetado especificamente para transmissões ao vivo via OBS Studio. Ele possui um fundo dinâmico e animado (WebGLLumaSlideshow), além de um player de música elegante que exibe informações de faixa em tempo real (Now Playing) e *cover arts*, sem depender de plataformas de streaming externas ou de widgets embutidos pesados no OBS.

Este sistema foi construído visando o máximo desempenho, delegando todo o trabalho pesado para a aceleração de hardware via CEF (Chromium Embedded Framework) e processamento WebGL.

## 🚀 Por que usar este sistema em vez de plugins externos (ex: Tuna)?

Plugins como o **Tuna** e ferramentas que se integram via WebSockets direto no OBS são muito populares, no entanto, este sistema web puro oferece benefícios arquiteturais imensos:

* **Desempenho Extremo e Isolamento:** Ao usar HTML/CSS/JS e processar via placa de vídeo (GPU) nativa do navegador do OBS, o sistema de música e o slideshow animado correm numa thread completamente isolada. Plugins que operam dentro das amarras da interface nativa do OBS costumam disputar ciclos de renderização principal.
* **Transições Independentes de Fonte:** O motor de renderização resolve o problema crônico de cortes secos do CEF. Se você ocultar ou exibir a fonte, a animação não quebra. Ela aguarda inteligentemente o *paint timing* do Chromium e exibe o texto com transição fluida, o que plugins como Tuna muitas vezes não conseguem lidar se forem vinculados a textos GDI+ estáticos no OBS.
* **Custo Zero de CPU com `requestAnimationFrame`:** O I/O de disco da *cover art* e os ciclos de fundo dinâmicos não engasgam graças à otimização brutal em `fetchImageBitmap()`.
* **Flexibilidade Visual Absoluta:** Toda a customização visual (degradês, tamanhos, `cubic-bezier`, CSS filters, WebGL vignette) está a alguns caracteres de distância no seu arquivo `layout.css`, garantindo que não existam bordas gráficas rígidas que você encontraria no configurador visual de plugins de terceiros.
* **100% Offline (Zero Delay de API):** Como as informações são processadas via `.txt` local emitido pelo Foobar2000, você não depende das APIs do Spotify, YouTube Music ou Last.fm (que além de possuírem delay natural, podem falhar com *Rate Limits*).

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
