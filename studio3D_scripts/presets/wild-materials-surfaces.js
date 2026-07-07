// ============================================================
// presets/wild-materials-surfaces.js — "Materials & surfaces" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
export const WILD_MATERIALS_SURFACES = [
  {
        id: "woven",
        name: "Woven Fabric",
        category: "Materials & surfaces",
        kind: "shader",
        swatch: ["#5d4037", "#8d6e63"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "thread1Color",
                label: "Thread Color 1",
                type: "color",
                default: "#a0522d"
            },
            {
                key: "thread2Color",
                label: "Thread Color 2",
                type: "color",
                default: "#deb887"
            },
            {
                key: "weaveScale",
                label: "Weave Scale",
                type: "float",
                default: 8.0,
                min: 2.0,
                max: 20.0
            },
            {
                key: "fuzziness",
                label: "Fuzziness",
                type: "float",
                default: 0.3,
                min: 0.0,
                max: 1.0
            },
            {
                key: "specular",
                label: "Specular",
                type: "float",
                default: 0.6,
                min: 0.0,
                max: 1.5
            },
            {
                key: "twist",
                label: "Twist",
                type: "float",
                default: 0.2,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_thread1Color;
      uniform vec3 u_thread2Color;
      uniform float u_weaveScale;
      uniform float u_fuzziness;
      uniform float u_specular;
      uniform float u_twist;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_weaveScale;
      float patternX = abs(sin(uv.x * 3.14159 + uv.y * u_twist)) * 0.5 + 0.5;
      float patternY = abs(sin(uv.y * 3.14159 + uv.x * u_twist)) * 0.5 + 0.5;
      float weave = (patternX * patternY) * 0.8 + 0.2;
      float fuzzy = fbm(vec3(uv * 0.5, 0.3)) * u_fuzziness;
      vec3 base = mix(u_thread1Color, u_thread2Color, weave);
      base += fuzzy * 0.15;
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), 20.0) * u_specular;
      spec *= 0.5 + 0.5 * weave;
      col = base * (diff * 0.7 + 0.4) + spec * base * 0.5;
      alpha = 1.0;
    `
    },
  {
        id: "topographical",
        name: "Topographical",
        category: "Materials & surfaces",
        kind: "shader",
        swatch: ["#228b22", "#8b4513"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "lowColor",
                label: "Low Elevation Color",
                type: "color",
                default: "#006400"
            },
            {
                key: "highColor",
                label: "High Elevation Color",
                type: "color",
                default: "#d2b48c"
            },
            {
                key: "contourSpacing",
                label: "Contour Spacing",
                type: "float",
                default: 0.15,
                min: 0.05,
                max: 0.5
            },
            {
                key: "relief",
                label: "Relief Intensity",
                type: "float",
                default: 0.5,
                min: 0.0,
                max: 1.0
            },
            {
                key: "waterColor",
                label: "Water Color",
                type: "color",
                default: "#1e90ff"
            },
            {
                key: "terrainScale",
                label: "Terrain Scale",
                type: "float",
                default: 2.5,
                min: 1.0,
                max: 8.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_lowColor;
      uniform vec3 u_highColor;
      uniform float u_contourSpacing;
      uniform float u_relief;
      uniform vec3 u_waterColor;
      uniform float u_terrainScale;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_terrainScale;
      float height = fbm(vec3(uv, 0.5)) * 0.7 + snoise(vec3(uv * 2.0, 0.9)) * 0.3;
      height = height * 0.5 + 0.5;
      float contour = abs(fract(height / u_contourSpacing) - 0.5) * 2.0;
      contour = 1.0 - smoothstep(0.0, 0.03, contour);
      vec3 land = mix(u_lowColor, u_highColor, height);
      float water = step(height, 0.35);
      vec3 colTerrain = mix(land, u_waterColor, water);
      colTerrain = mix(colTerrain, vec3(0.0), contour * 0.6);
      float reliefShade = (diff * 0.5 + 0.5) * (0.8 + 0.2 * u_relief);
      col = colTerrain * reliefShade;
      alpha = 1.0;
    `
    },
  {
        id: "sand",
        name: "Sand",
        category: "Materials & surfaces",
        kind: "shader",
        swatch: ["#c2b280", "#8b7355"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "sandColor",
                label: "Sand Color",
                type: "color",
                default: "#e6c280"
            },
            {
                key: "shadowColor",
                label: "Shadow Color",
                type: "color",
                default: "#8b7355"
            },
            {
                key: "grainSize",
                label: "Grain Size",
                type: "float",
                default: 10.0,
                min: 2.0,
                max: 30.0
            },
            {
                key: "duneScale",
                label: "Dune Scale",
                type: "float",
                default: 1.5,
                min: 0.5,
                max: 5.0
            },
            {
                key: "clumpiness",
                label: "Clumpiness",
                type: "float",
                default: 0.3,
                min: 0.0,
                max: 1.0
            },
            {
                key: "specular",
                label: "Specular",
                type: "float",
                default: 0.2,
                min: 0.0,
                max: 0.8
            }
        ],
        fragUniforms: `
      uniform vec3 u_sandColor;
      uniform vec3 u_shadowColor;
      uniform float u_grainSize;
      uniform float u_duneScale;
      uniform float u_clumpiness;
      uniform float u_specular;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_duneScale;
      float dune = fbm(vec3(uv, 0.3)) * 0.7 + snoise(vec3(uv * 0.5, 0.8)) * 0.3;
      vec2 grainUV = vWorldPos.xy * u_grainSize;
      float grain = snoise(vec3(grainUV, 0.5)) * 0.5 + 0.5;
      grain = grain * 0.8 + 0.2 * snoise(vec3(grainUV * 2.0, 0.9));
      float clump = snoise(vec3(grainUV * 0.2, 0.7));
      grain = mix(grain, 0.5, clump * u_clumpiness);
      vec3 sandCol = mix(u_shadowColor, u_sandColor, grain);
      sandCol = mix(sandCol, u_sandColor, dune * 0.4);
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), 30.0) * u_specular;
      col = sandCol * (diff * 0.8 + 0.3) + spec * u_sandColor * 0.2;
      alpha = 1.0;
    `
    },
  {
        id: "emblem",
        name: "Emblem",
        category: "Materials & surfaces",
        kind: "shader",
        swatch: ["#800020", "#ffd700"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "fabricColor",
                label: "Fabric Color",
                type: "color",
                default: "#800020"
            },
            {
                key: "threadColor",
                label: "Thread Color",
                type: "color",
                default: "#ffd700"
            },
            {
                key: "patternScale",
                label: "Pattern Scale",
                type: "float",
                default: 3.0,
                min: 1.0,
                max: 8.0
            },
            {
                key: "embossHeight",
                label: "Emboss Height",
                type: "float",
                default: 0.4,
                min: 0.1,
                max: 1.0
            },
            {
                key: "metallic",
                label: "Metallic Shine",
                type: "float",
                default: 0.8,
                min: 0.0,
                max: 1.5
            },
            {
                key: "threadWidth",
                label: "Thread Width",
                type: "float",
                default: 0.3,
                min: 0.1,
                max: 0.8
            }
        ],
        fragUniforms: `
      uniform vec3 u_fabricColor;
      uniform vec3 u_threadColor;
      uniform float u_patternScale;
      uniform float u_embossHeight;
      uniform float u_metallic;
      uniform float u_threadWidth;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_patternScale;
      float pattern = fbm(vec3(uv, 0.2));
      pattern = pattern * 0.6 + snoise(vec3(uv * 2.5, 0.7)) * 0.4;
      float filigree = sin(pattern * 10.0) * 0.5 + 0.5;
      filigree = smoothstep(u_threadWidth - 0.05, u_threadWidth, filigree);
      float emboss = pattern * 2.0 - 1.0;
      vec3 normalEmboss = normalize(N + vec3(emboss * u_embossHeight, emboss * u_embossHeight * 0.5, 0.0));
      float fabricShade = diff * 0.7 + 0.4;
      vec3 fabric = u_fabricColor * fabricShade;
      float spec = pow(max(0.0, dot(normalEmboss, normalize(V + KL))), 30.0) * u_metallic;
      col = mix(fabric, u_threadColor, filigree) + spec * u_threadColor * 0.7;
      alpha = 1.0;
    `
    },
  {
    id: 'liquid_metal', name: 'Liquid Metal', category: 'Materials & surfaces', kind: 'shader', swatch: ['#C0C0C0', '#606060'],
    gravity: true,
    params: [
      { key: 'flowSpeed', label: 'Flow Speed', type: 'range', min: 0.0, max: 5.0, step: 0.01, default: 1.0 },
      { key: 'viscosity', label: 'Viscosity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
      { key: 'metallicTint', label: 'Metallic Tint', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'distortion', label: 'Distortion', type: 'range', min: 0.0, max: 2.0, step: 0.01, default: 0.7 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0.5, max: 2.0, step: 0.01, default: 1.2 },
    ],
    fragUniforms: `
      uniform float u_flowSpeed;
      uniform float u_viscosity;
      uniform float u_metallicTint;
      uniform float u_distortion;
      uniform float u_contrast;
    `,
    fragBody: `
      vec2 uv = vUv;
      vec3 gravity = normalize(u_gravity);
      vec2 flowDir = gravity.xy * u_flowSpeed * 0.1;

      float n = 0.0;
      float amp = 1.0;
      float freq = 4.0;
      vec2 p = uv * 5.0;
      for (int i = 0; i < 5; i++) {
        n += amp * abs(snoise(vec3(p + flowDir * u_time * (1.0 + float(i) * 0.2), u_time * 0.1)));
        p *= 2.0;
        amp *= 0.5;
      }
      n = smoothstep(0.2, 0.8, n);

      vec3 metalBase = mix(vec3(0.7, 0.7, 0.8), vec3(0.9, 0.8, 0.6), u_metallicTint);
      float spec = pow(max(0.0, n - 0.5) * 2.0, 3.0);
      col = metalBase * (n * 0.8 + 0.2) + spec * vec3(1.0);
      col = mix(col, col * (1.0 + sin(uv.x * 10.0) * 0.2), u_distortion);
      col = mix(vec3(0.5), col, u_contrast);
      
    `,
  },
  {
    id: 'leather', name: 'Leather', category: 'Materials & surfaces', kind: 'shader', swatch: ['#8B4513', '#452209'],
    params: [
      { key: 'grainSize', label: 'Grain Size', type: 'range', min: 0.1, max: 2.0, step: 0.01, default: 0.5 },
      { key: 'wrinkleDepth', label: 'Wrinkle Depth', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'baseColor', label: 'Base Color', type: 'color', default: '#8B4513' },
      { key: 'aging', label: 'Aging', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
      { key: 'gloss', label: 'Gloss', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.2 },
    ],
    fragUniforms: `
      uniform float u_grainSize;
      uniform float u_wrinkleDepth;
      uniform vec3 u_baseColor;
      uniform float u_aging;
      uniform float u_gloss;
    `,
    fragBody: `
      vec2 uv = vUv;
      float grain = snoise(vec3(uv * 20.0 * u_grainSize, 0.0)) * 0.5 + 0.5;
      float wrinkle = abs(snoise(vec3(uv * 8.0 + u_time * 0.05, u_time * 0.02)));
      wrinkle = smoothstep(0.4, 1.0, wrinkle) * u_wrinkleDepth;

      float ageNoise = snoise(vec3(uv * 30.0, 1.0));
      float age = ageNoise * u_aging;

      vec3 leatherCol = mix(u_baseColor, u_baseColor * 0.7, grain * 0.8 + wrinkle * 0.6);
      leatherCol += age * vec3(0.6, 0.5, 0.4);
      leatherCol = clamp(leatherCol, 0.0, 1.0);

      float spec = pow(max(0.0, grain * 1.2 - 0.2), 8.0) * u_gloss;
      vec3 finalCol = leatherCol + spec;
      col = finalCol;
    `,
  },
  {
    id: 'wood_grain', name: 'Wood Grain', category: 'Materials & surfaces', kind: 'shader', swatch: ['#8B5A2B', '#452d15'],
    params: [
      { key: 'grainScale', label: 'Grain Scale', type: 'range', min: 0.2, max: 3.0, step: 0.01, default: 1.0 },
      { key: 'knotDensity', label: 'Knot Density', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
      { key: 'ringContrast', label: 'Ring Contrast', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.5 },
      { key: 'woodTint', label: 'Wood Tint', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'gloss', label: 'Gloss', type: 'range', min: 0.0, max: 0.5, step: 0.01, default: 0.15 },
    ],
    fragUniforms: `
      uniform float u_grainScale;
      uniform float u_knotDensity;
      uniform float u_ringContrast;
      uniform float u_woodTint;
      uniform float u_gloss;
    `,
    fragBody: `
      vec2 uv = vUv * u_grainScale;
      vec2 grain = vec2(uv.x, uv.y + sin(uv.x * 6.28318) * 0.1);
      float rings = abs(sin(grain.y * 20.0 + grain.x * 5.0)) * 0.5 + 0.5;
      rings = pow(rings, u_ringContrast);

      float knot = 1.0;
      for (int i = 0; i < 3; i++) {
        vec2 knotPos = vec2(
          snoise(vec3(float(i) * 1.3, 0.0, 0.5)) * 0.8 + 0.5,
          snoise(vec3(float(i) * 2.7, 1.0, 0.3)) * 0.8 + 0.5
        );
        float d = length(grain - knotPos) * 8.0;
        float knotShape = 1.0 - smoothstep(0.2, 0.6, d) * 0.9;
        knot = min(knot, knotShape);
      }

      float wood = mix(rings, rings * 0.8 + knot * 0.5, u_knotDensity);
      vec3 baseCol = mix(vec3(0.6, 0.4, 0.2), vec3(0.8, 0.6, 0.3), u_woodTint);
      col = baseCol * (0.5 + wood * 0.6);
      float gloss = pow(rings * 0.8, 3.0) * u_gloss;
      col += gloss;
      
    `,
  },
  {
    id: 'carbon_fiber', name: 'Carbon Fiber', category: 'Materials & surfaces', kind: 'shader', swatch: ['#2F4F4F', '#172727'],
    params: [
      { key: 'weaveScale', label: 'Weave Scale', type: 'range', min: 0.5, max: 5.0, step: 0.01, default: 2.0 },
      { key: 'anisotropy', label: 'Anisotropy', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.8 },
      { key: 'fiberWidth', label: 'Fiber Width', type: 'range', min: 0.1, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'highlight', label: 'Highlight', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'darkness', label: 'Darkness', type: 'range', min: 0.0, max: 0.8, step: 0.01, default: 0.3 },
    ],
    fragUniforms: `
      uniform float u_weaveScale;
      uniform float u_anisotropy;
      uniform float u_fiberWidth;
      uniform float u_highlight;
      uniform float u_darkness;
    `,
    fragBody: `
      vec2 uv = vUv * u_weaveScale;
      float weave = abs(sin(uv.x * 3.14159 * 2.0)) * 0.5 + 0.5;
      float fiber = abs(sin(uv.y * 12.0)) > (1.0 - u_fiberWidth) ? 0.2 : 0.8;
      float pattern = weave * 0.7 + fiber * 0.5;
      float anisotropy = mix(0.0, (uv.x - floor(uv.x)) * 0.5, u_anisotropy);
      float dark = pattern * (1.0 - u_darkness) + u_darkness;
      float highlight = pow(pattern, 2.0) * u_highlight;
      float finalVal = dark + highlight + anisotropy;
      col = vec3(finalVal * 0.8, finalVal * 0.85, finalVal * 0.9);
      
    `,
  },
  {
    id: 'honeycomb', name: 'Honeycomb', category: 'Materials & surfaces', kind: 'shader', swatch: ['#DAA520', '#6d5210'],
    params: [
      { key: 'cellSize', label: 'Cell Size', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.5 },
      { key: 'wallThickness', label: 'Wall Thickness', type: 'range', min: 0.1, max: 1.0, step: 0.01, default: 0.4 },
      { key: 'depthVariation', label: 'Depth Variation', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'warmTone', label: 'Warm Tone', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'highlight', label: 'Highlight', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
    ],
    fragUniforms: `
      uniform float u_cellSize;
      uniform float u_wallThickness;
      uniform float u_depthVariation;
      uniform float u_warmTone;
      uniform float u_highlight;
    `,
    fragBody: `
      vec2 uv = vUv * u_cellSize;
      vec2 q = vec2(uv.x * 1.7320508, uv.y);
      vec2 id = round(q);
      vec2 gv = q - id;
      float angle = atan(gv.y, gv.x) + 3.14159;
      float sector = floor(angle / (3.14159 / 3.0));
      float dist = length(gv);
      float hexDist = 0.5 / cos(mod(angle + 3.14159 / 6.0, 3.14159 / 3.0) - 3.14159 / 6.0);
      float edge = smoothstep(hexDist * 0.95, hexDist, dist);
      float depth = snoise(vec3(id * 0.7, 0.0)) * u_depthVariation;
      float wall = 1.0 - edge * u_wallThickness;
      wall += depth * 0.3;
      float highlight = pow(max(0.0, 1.0 - dist * 2.0), 3.0) * u_highlight;
      col = mix(vec3(0.85, 0.65, 0.2), vec3(0.95, 0.8, 0.4), u_warmTone) * (wall * 0.7 + 0.3);
      col += highlight * vec3(1.0, 0.9, 0.6);
      
    `,
  },
  {
    id: 'camouflage', name: 'Camouflage', category: 'Materials & surfaces', kind: 'shader', swatch: ['#556B2F', '#2a3517'],
    params: [
      { key: 'blobSize', label: 'Blob Size', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.0 },
      { key: 'complexity', label: 'Complexity', type: 'range', min: 0.1, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'color1', label: 'Color1', type: 'color', default: '#556B2F' },
      { key: 'color2', label: 'Color2', type: 'color', default: '#556B2F' },
      { key: 'color3', label: 'Color3', type: 'color', default: '#556B2F' },
    ],
    fragUniforms: `
      uniform float u_blobSize;
      uniform float u_complexity;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
    `,
    fragBody: `
      vec2 uv = vUv * u_blobSize;
      float n1 = snoise(vec3(uv * 3.0, 0.0));
      float n2 = snoise(vec3(uv * 5.0 + 10.0, 1.0));
      float blob = n1 * 0.6 + n2 * 0.4;
      blob = smoothstep(0.2, 0.8, blob) * u_complexity;
      blob += snoise(vec3(uv * 8.0, 2.0)) * 0.3;
      float t = clamp((blob + 0.5) * 1.5, 0.0, 1.0);
      col = mix(mix(u_color1, u_color2, t), u_color3, pow(t, 2.0));
      
    `,
  },
  {
    id: 'acid_wash', name: 'Acid Wash Denim', category: 'Materials & surfaces', kind: 'shader', swatch: ['#4B6E9C', '#25374e'],
    params: [
      { key: 'washIntensity', label: 'Wash Intensity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'fiberDetail', label: 'Fiber Detail', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0.5, max: 2.0, step: 0.01, default: 1.2 },
      { key: 'blueHue', label: 'Blue Hue', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'fadeAmount', label: 'Fade Amount', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
    ],
    fragUniforms: `
      uniform float u_washIntensity;
      uniform float u_fiberDetail;
      uniform float u_contrast;
      uniform float u_blueHue;
      uniform float u_fadeAmount;
    `,
    fragBody: `
      vec2 uv = vUv;
      float noise = snoise(vec3(uv * 20.0, 0.0)) * 0.5 + 0.5;
      float fiber = snoise(vec3(uv * 80.0 + 5.0, 1.0)) * u_fiberDetail;
      float wash = snoise(vec3(uv * 8.0 + 3.0, 2.0)) * u_washIntensity;
      wash = smoothstep(0.3, 0.7, wash);
      float pattern = mix(noise, wash, 0.7) + fiber * 0.2;
      pattern = mix(pattern, pattern * 1.5, u_contrast - 1.0);
      float fade = snoise(vec3(uv * 12.0, 3.0)) * u_fadeAmount;
      vec3 baseBlue = hsv2rgb(vec3(u_blueHue, 0.8, 0.7));
      vec3 white = vec3(0.95);
      col = mix(baseBlue, white, pattern * fade);
      
    `,
  },
];
