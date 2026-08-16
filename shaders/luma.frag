precision highp float;
varying vec2 vUv;
uniform sampler2D texCurrent;
uniform sampler2D texNext;
uniform float progress;
uniform float softness;

uniform vec2 resCurrent;
uniform vec2 resNext;
uniform vec2 canvasRes;
uniform vec3 u_vColor;
uniform float u_vSize;
uniform float u_vOpacity;

// Variáveis float estáveis para o CEF
uniform float u_vBlend; 
uniform float u_invertLuma; 
uniform float u_isVerticalVignette;

vec2 coverUv(vec2 uv, vec2 texRes) {
    vec2 ratio = canvasRes / texRes; 
    float maxRatio = max(ratio.x, ratio.y);
    vec2 scale = vec2(maxRatio / ratio.x, maxRatio / ratio.y);
    return (uv - 0.5) / scale + 0.5;
}

float luma(vec3 color) { 
    return dot(color, vec3(0.299, 0.587, 0.114)); 
}

void main() {
    vec2 uvC = coverUv(vUv, resCurrent); 
    vec2 uvN = coverUv(vUv, resNext);
    vec4 colorC = texture2D(texCurrent, uvC); 
    vec4 colorN = texture2D(texNext, uvN);
    
    float l = luma(colorC.rgb); 
    
    if (u_invertLuma > 0.5) { l = 1.0 - l; }
    
    float p = progress * (1.0 + softness) - softness;
    float mixFactor = 1.0 - smoothstep(p, p + softness, l);
    vec4 finalColor = mix(colorC, colorN, mixFactor);
    
    float vFactor = 0.0;
    
    if (u_isVerticalVignette > 0.5) { 
        vFactor = smoothstep(0.0, u_vSize, vUv.y) * u_vOpacity; 
    } else { 
        float dist = distance(vUv, vec2(0.5, 0.5)); 
        vFactor = smoothstep(0.2, u_vSize, dist) * u_vOpacity; 
    }

    vec3 baseColor = finalColor.rgb; 
    vec3 vColor = u_vColor;
    
    if (u_vBlend > 0.5 && u_vBlend < 1.5) { 
        // 1.0 - MULTIPLY
        finalColor.rgb = baseColor * mix(vec3(1.0), vColor, vFactor); 
    } else if (u_vBlend > 1.5) { 
        // 2.0 - SCREEN
        finalColor.rgb = mix(baseColor, vec3(1.0) - (vec3(1.0) - baseColor) * (vec3(1.0) - vColor), vFactor); 
    } else { 
        // 0.0 - NORMAL
        finalColor.rgb = mix(baseColor, vColor, vFactor); 
    }
    
    gl_FragColor = finalColor;
}
