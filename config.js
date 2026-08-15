const deepFreeze = obj => {
    Object.keys(obj).forEach(prop => {
      if (typeof obj[prop] === 'object' && !Object.isFrozen(obj[prop])) deepFreeze(obj[prop]);
    });
    return Object.freeze(obj);
};

const IS_VERTICAL = window.innerHeight > window.innerWidth;
const primaryAxis = IS_VERTICAL ? window.innerHeight : window.innerWidth;

let ASSET_FOLDER = "2160p";
if (primaryAxis <= 1920) ASSET_FOLDER = "1080p";
else if (primaryAxis <= 2560) ASSET_FOLDER = "1440p";

const CONFIG = deepFreeze({
    slideshow: {
        imageCount: {
            horizontal: 97,
            vertical: 97 // Coloque a quantidade EXATA das suas imagens verticais aqui
        },
        duration: 8000, 
        transition: 2000, 
        softness: 0.6, 
        invertLuma: true,
        vignette: {
            color: { r: 33, g: 13, b: 32 }, 
            size: IS_VERTICAL ? 0.8 : 0.6,  
            opacity: 1.0, 
            blendMode: 'multiply', 
            isVerticalVignette: IS_VERTICAL ? 1 : 0
        }
    },
    player: { 
        interval: 2000 
    }
});