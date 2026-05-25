// Orilon Weather Control client overlay runtime
const ORILON_WEATHER_MODULE_ID = "orilon-weather-control";
const ORILON_WEATHER_STATE_SCOPE = "world";
const ORILON_WEATHER_STATE_KEY = "orilonWeatherState";

class OrilonWeatherClientRuntime {
  static runtime = {
    activeSceneId: null,
    activeWeatherId: null,
    overlayKey: null,
    particleInterval: null,
    particleCount: 0
  };

  static get currentScene() {
    return canvas?.scene ?? game.scenes?.current ?? null;
  }

  static clear() {
    const rt = this.runtime;
    if (rt.particleInterval) {
      clearInterval(rt.particleInterval);
      rt.particleInterval = null;
    }
    rt.activeSceneId = null;
    rt.activeWeatherId = null;
    rt.overlayKey = null;
    rt.particleCount = 0;
    try {
      document.querySelectorAll('.orilon-client-weather-fx, #orilon-client-weather-style').forEach(el => el.remove());
    } catch (_err) {}
  }

  static ensureStyle() {
    let style = document.getElementById('orilon-client-weather-style');
    if (style) return style;
    style = document.createElement('style');
    style.id = 'orilon-client-weather-style';
    style.textContent = `
      .orilon-client-weather-fx { pointer-events:none; position:fixed; inset:0; overflow:hidden; z-index:39; }
      .orilon-client-weather-fx .veil, .orilon-client-weather-fx .vignette, .orilon-client-weather-fx .glow, .orilon-client-weather-fx .shimmer {
        position:absolute; inset:0; pointer-events:none;
      }
      .orilon-client-weather-fx .particle { position:absolute; pointer-events:none; will-change: transform, opacity; }
      @keyframes orilonAshFall {
        0% { transform: translate3d(var(--sx), -10vh, 0) rotate(var(--rot)); opacity: 0; }
        10% { opacity: var(--oa); }
        100% { transform: translate3d(calc(var(--sx) + var(--dx)), 110vh, 0) rotate(calc(var(--rot) + 160deg)); opacity: 0; }
      }
      @keyframes orilonSnowStreak {
        0% { transform: translate3d(var(--sx), -12vh, 0) rotate(var(--ang)); opacity: 0; }
        8% { opacity: var(--oa); }
        100% { transform: translate3d(calc(var(--sx) + var(--dx)), 108vh, 0) rotate(var(--ang)); opacity: 0; }
      }
      @keyframes orilonHeatPulse {
        0%, 100% { opacity: .20; transform: scale(1) translateY(0px); }
        50% { opacity: .32; transform: scale(1.01) translateY(-2px); }
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  static makeLayer(id) {
    const root = document.createElement('div');
    root.id = id;
    root.className = 'orilon-client-weather-fx';
    return root;
  }

  static spawnParticle(container, kind, opts = {}) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sx = Math.random() * 100;
    const dx = (opts.dxMin ?? -10) + Math.random() * ((opts.dxMax ?? 10) - (opts.dxMin ?? -10));
    const dur = (opts.durMin ?? 4) + Math.random() * ((opts.durMax ?? 9) - (opts.durMin ?? 4));
    p.style.setProperty('--sx', `${sx}vw`);
    p.style.setProperty('--dx', `${dx}vw`);
    p.style.setProperty('--rot', `${Math.floor(Math.random()*360)}deg`);
    p.style.setProperty('--ang', `${opts.angle ?? -18}deg`);
    p.style.setProperty('--oa', `${opts.opacity ?? 0.55}`);
    p.style.left = '0';
    p.style.top = '0';
    p.style.animation = `${kind} ${dur}s linear forwards`;
    if (kind === 'orilonAshFall') {
      const ember = Math.random() < (opts.emberChance ?? 0.12);
      const size = ember ? (2 + Math.random()*2.6) : (2 + Math.random()*3.8);
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.borderRadius = '50%';
      p.style.background = ember ? 'radial-gradient(circle, rgba(255,194,98,.95), rgba(255,112,31,.45) 55%, rgba(255,112,31,0) 70%)' : 'rgba(110,108,103,.85)';
      p.style.boxShadow = ember ? '0 0 8px rgba(255,140,60,.55)' : 'none';
    } else if (kind === 'orilonSnowStreak') {
      const w = 2 + Math.random()*3.5;
      const h = 18 + Math.random()*34;
      p.style.width = `${w}px`;
      p.style.height = `${h}px`;
      p.style.borderRadius = '999px';
      p.style.background = 'linear-gradient(180deg, rgba(255,255,255,0), rgba(245,249,255,.90), rgba(255,255,255,0))';
      p.style.filter = 'blur(.2px)';
      p.style.opacity = '.85';
    }
    p.addEventListener('animationend', () => p.remove(), { once: true });
    container.appendChild(p);
  }

  static runAshfall(intensity='standard') {
    this.ensureStyle();
    this.clear();
    const root = this.makeLayer('orilon-client-ashfall');
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.style.background = intensity === 'heavy'
      ? 'linear-gradient(180deg, rgba(52,49,46,.28), rgba(26,24,22,.45)), radial-gradient(circle at 50% 30%, rgba(106,100,94,.18), rgba(0,0,0,0) 60%)'
      : 'linear-gradient(180deg, rgba(64,61,58,.18), rgba(22,20,18,.28)), radial-gradient(circle at 50% 30%, rgba(118,110,103,.14), rgba(0,0,0,0) 60%)';
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    vignette.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 48%, rgba(20,17,15,.28) 100%)';
    const glow = document.createElement('div');
    glow.className = 'glow';
    glow.style.background = 'radial-gradient(circle at 50% 75%, rgba(255,132,36,.05), rgba(0,0,0,0) 40%)';
    root.append(veil, vignette, glow);
    document.body.appendChild(root);
    const cap = intensity === 'heavy' ? 130 : 90;
    this.runtime.particleInterval = setInterval(() => {
      if (!document.body.contains(root)) return;
      const count = root.querySelectorAll('.particle').length;
      if (count >= cap) return;
      const burst = intensity === 'heavy' ? 4 : 3;
      for (let i=0; i<burst; i++) this.spawnParticle(root, 'orilonAshFall', { dxMin: -8, dxMax: 8, durMin: 4.5, durMax: 8.5, emberChance: intensity === 'heavy' ? 0.18 : 0.10, opacity: intensity === 'heavy' ? 0.68 : 0.50 });
    }, intensity === 'heavy' ? 180 : 260);
  }

  static runBlizzard(intensity='severe') {
    this.ensureStyle();
    this.clear();
    const root = this.makeLayer('orilon-client-blizzard');
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.style.background = 'linear-gradient(180deg, rgba(214,222,231,.24), rgba(175,188,201,.35)), radial-gradient(circle at 50% 38%, rgba(255,255,255,.18), rgba(0,0,0,0) 60%)';
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    vignette.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(153,167,179,.18) 100%)';
    root.append(veil, vignette);
    document.body.appendChild(root);
    const cap = intensity === 'severe' ? 150 : 100;
    this.runtime.particleInterval = setInterval(() => {
      if (!document.body.contains(root)) return;
      const count = root.querySelectorAll('.particle').length;
      if (count >= cap) return;
      const burst = intensity === 'severe' ? 7 : 5;
      for (let i=0; i<burst; i++) this.spawnParticle(root, 'orilonSnowStreak', { dxMin: -38, dxMax: -12, durMin: 1.2, durMax: 2.8, angle: -22, opacity: .76 });
    }, 120);
  }

  static runHeatwave() {
    this.ensureStyle();
    this.clear();
    const root = this.makeLayer('orilon-client-heatwave');
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.style.background = 'linear-gradient(180deg, rgba(223,172,98,.09), rgba(185,126,58,.12)), radial-gradient(circle at 50% 35%, rgba(255,233,177,.10), rgba(0,0,0,0) 56%)';
    const shimmer = document.createElement('div');
    shimmer.className = 'shimmer';
    shimmer.style.background = 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,244,210,.08), rgba(255,255,255,0))';
    shimmer.style.animation = 'orilonHeatPulse 4.2s ease-in-out infinite';
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    vignette.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 55%, rgba(191,114,42,.10) 100%)';
    root.append(veil, shimmer, vignette);
    document.body.appendChild(root);
  }

  static async syncFromScene(scene = this.currentScene) {
    if (!scene || !canvas?.ready) return;
    const state = scene.getFlag(ORILON_WEATHER_STATE_SCOPE, ORILON_WEATHER_STATE_KEY);
    const rt = state?.clientRuntime;
    if (!state || !rt?.clientRuntime || !rt.screenOverlayEnabled) {
      this.clear();
      return;
    }
    const key = `${scene.id}:${rt.weatherId}:${rt.overlay}:${rt.intensity}`;
    if (this.runtime.overlayKey === key) return;

    this.clear();
    this.runtime.activeSceneId = scene.id;
    this.runtime.activeWeatherId = rt.weatherId;
    this.runtime.overlayKey = key;

    switch (rt.overlay) {
      case 'ashfall-smoky-veil':
        this.runAshfall(rt.intensity || 'standard');
        break;
      case 'blizzard-whiteout':
        this.runBlizzard(rt.intensity || 'severe');
        break;
      case 'heatwave-shimmer':
        this.runHeatwave();
        break;
      default:
        this.clear();
    }
  }
}

Hooks.once('canvasReady', () => OrilonWeatherClientRuntime.syncFromScene());
Hooks.on('canvasReady', () => OrilonWeatherClientRuntime.syncFromScene());
Hooks.on('updateScene', (scene, changed) => {
  if (scene.id !== canvas?.scene?.id) return;
  if (changed.flags?.world?.orilonWeatherState || changed.weather || changed.darkness !== undefined) {
    OrilonWeatherClientRuntime.syncFromScene(scene);
  }
});
Hooks.on('deleteScene', scene => {
  if (scene.id === OrilonWeatherClientRuntime.runtime.activeSceneId) OrilonWeatherClientRuntime.clear();
});
Hooks.on('canvasPan', () => {
  if (!canvas?.scene) OrilonWeatherClientRuntime.clear();
});
Hooks.on('closeApplication', app => {
  // no-op; placeholder for future cleanup logic
});

globalThis.OrilonWeatherClientRuntime = OrilonWeatherClientRuntime;
