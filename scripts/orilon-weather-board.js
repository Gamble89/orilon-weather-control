// Orilon Weather Control module board runtime
// Generated from v47 Heatwave No Debris macro

class OrilonWeatherBoard {
  static async openBoard() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only a GM can control Orilon weather.");
      return;
    }

    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.warn("No active scene found.");
      return;
    }

    // ======================================================
    // GLOBAL RUNTIME
    // ======================================================

    globalThis.ORILON_WEATHER_RUNTIME = globalThis.ORILON_WEATHER_RUNTIME || {
      timeoutIds: [],
      intervalIds: [],
      activeSceneId: null,
      activeMode: null
    };

    const RUNTIME = globalThis.ORILON_WEATHER_RUNTIME;
    RUNTIME.timeoutIds = RUNTIME.timeoutIds || [];
    RUNTIME.intervalIds = RUNTIME.intervalIds || [];
    RUNTIME.transitionLocked = Boolean(RUNTIME.transitionLocked);
    RUNTIME.transitionMessage = RUNTIME.transitionMessage || "";
    RUNTIME.activeAshParticles = Number(RUNTIME.activeAshParticles || 0);
    RUNTIME.activeBlizzardParticles = Number(RUNTIME.activeBlizzardParticles || 0);

    function clearRuntimeTimers() {
      for (const id of RUNTIME.timeoutIds || []) clearTimeout(id);
      for (const id of RUNTIME.intervalIds || []) clearInterval(id);
      RUNTIME.timeoutIds = [];
      RUNTIME.intervalIds = [];
      RUNTIME.activeSceneId = null;
      RUNTIME.activeMode = null;
      RUNTIME.activeAshParticles = 0;
      RUNTIME.activeBlizzardParticles = 0;

      try {
        document.querySelectorAll(".orilon-weather-local-fx").forEach(el => el.remove());
      } catch (_err) {}
    }

    function runtimeTimeout(fn, delay) {
      const id = setTimeout(() => {
        RUNTIME.timeoutIds = (RUNTIME.timeoutIds || []).filter(existing => existing !== id);
        fn();
      }, delay);
      RUNTIME.timeoutIds.push(id);
      return id;
    }

    function runtimeInterval(fn, delay) {
      const id = setInterval(fn, delay);
      RUNTIME.intervalIds.push(id);
      return id;
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, Number(ms || 0)));
    }

    function isWeatherTransitionLocked() {
      return Boolean(RUNTIME.transitionLocked);
    }

    // ======================================================
    // CONFIG
    // ======================================================

    const FLAG_SCOPE = "world";
    const WEATHER_STATE_FLAG = "orilonWeatherState";
    const WEATHER_SOUND_FLAG = "orilonWeatherSound";
    const WEATHER_SOUND_SOURCE_FLAG = "orilonWeatherSoundSource";
    const WEATHER_EFFECT_FLAG = "orilonWeatherEffect";
    const WEATHER_EFFECT_SOURCE_FLAG = "orilonWeatherEffectSource";
    const WEATHER_TOKEN_VISION_FLAG = "orilonWeatherTokenVision";
    const WEATHER_TOKEN_VISION_SOURCE_FLAG = "orilonWeatherTokenVisionSource";

    const WEATHER_SOUND_FOLDER = "Weather Control Sounds";
    const WEATHER_SOUND_FOLDER_ENCODED = "Weather%20Control%20Sounds";
    const AUDIO_EXTENSIONS = [".mp3", ".ogg", ".wav", ".flac", ".webm", ".m4a"];

    // Foundry often displays paths with %20 even when the Data folder uses spaces.
    // These folders are all tried. The first folder with audio files wins, but empty browse
    // results do not stop the scan anymore.
    const WEATHER_SOUND_FOLDERS_TO_TRY = [
      WEATHER_SOUND_FOLDER,
      `${WEATHER_SOUND_FOLDER}/`,
      WEATHER_SOUND_FOLDER_ENCODED,
      `${WEATHER_SOUND_FOLDER_ENCODED}/`,
      "sounds/Weather Control Sounds",
      "sounds/Weather Control Sounds/",
      "sounds/Weather%20Control%20Sounds",
      "sounds/Weather%20Control%20Sounds/",
      "audio/Weather Control Sounds",
      "audio/Weather Control Sounds/",
      "audio/Weather%20Control%20Sounds",
      "audio/Weather%20Control%20Sounds/"
    ];

    // These only kick in if FilePicker cannot see the folder. They match the folder path
    // Foundry shows when copied from the file picker.
    const FALLBACK_SOUND_LIBRARY = {
      "Light Rain In The Forest": "Weather%20Control%20Sounds/light-rain-in-the-forest.mp3",
      "Light Rain": "Weather%20Control%20Sounds/light-rain.mp3",
      "Heavy Rain": "Weather%20Control%20Sounds/heavy-rain.mp3",
      "Storm": "Weather%20Control%20Sounds/storm.mp3",
      "Thunderstorm": "Weather%20Control%20Sounds/thunderstorm.mp3",
      "Gale": "Weather%20Control%20Sounds/gale.mp3",
      "Violent Storm": "Weather%20Control%20Sounds/violent-storm.mp3",
      "Hurricane": "Weather%20Control%20Sounds/hurricane.mp3",
      "Fog Day": "Weather%20Control%20Sounds/fog-day.mp3",
      "Fog": "Weather%20Control%20Sounds/fog.mp3",
      "Heavy Fog": "Weather%20Control%20Sounds/heavy-fog.mp3",
      "Snow": "Weather%20Control%20Sounds/snow.mp3",
      "Blizzard": "Weather%20Control%20Sounds/blizzard.mp3",
      "Windy Country": "Weather%20Control%20Sounds/windy-country.mp3",
      "Wind": "Weather%20Control%20Sounds/wind.mp3",
      "Ashfall": "Weather%20Control%20Sounds/ashfall.mp3",
      "Heavy Ashfall": "Weather%20Control%20Sounds/heavy-ashfall.mp3",
      "Ash Heap Falling Embers": "Weather%20Control%20Sounds/ash-heap-falling-embers.mp3"
    };

    let SOUND_LIBRARY = {};
    let SOUND_SCAN_STATUS = { tried: [], matchedFolder: null, files: [], usedFallback: false, errorCount: 0 };

    function cleanSoundLabel(path) {
      const filename = String(path || "").split("/").pop() || "Weather Sound";
      return filename
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
    }

    function isAudioFile(path) {
      const lower = String(path || "").toLowerCase();
      return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
    }

    function addSoundLibraryEntry(library, path) {
      if (!isAudioFile(path)) return;

      let label = cleanSoundLabel(path);
      let uniqueLabel = label;
      let counter = 2;

      while (Object.prototype.hasOwnProperty.call(library, uniqueLabel)) {
        uniqueLabel = `${label} ${counter}`;
        counter += 1;
      }

      library[uniqueLabel] = path;
    }

    async function scanWeatherSoundFolder() {
      const FilePickerImpl = foundry?.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;
      const nextLibrary = {};
      const tried = [];
      let matchedFolder = null;
      let errorCount = 0;

      if (!FilePickerImpl?.browse) {
        console.warn("ORILON Weather SFX: FilePicker browse API not available. Using fallback sound paths.");
        SOUND_LIBRARY = { ...FALLBACK_SOUND_LIBRARY };
        SOUND_SCAN_STATUS = { tried, matchedFolder: null, files: Object.values(SOUND_LIBRARY), usedFallback: true, errorCount };
        return SOUND_LIBRARY;
      }

      for (const path of WEATHER_SOUND_FOLDERS_TO_TRY) {
        tried.push(path);
        try {
          const result = await FilePickerImpl.browse("data", path);
          const files = (result?.files || []).filter(isAudioFile);

          if (files.length) {
            matchedFolder = path;
            for (const filePath of files) addSoundLibraryEntry(nextLibrary, filePath);
            break;
          }
        } catch (err) {
          errorCount += 1;
        }
      }

      // If the folder browse failed, still provide the exact Foundry-style %20 paths so
      // scene sound nodes can be created from the known Weather Control Sounds folder.
      if (!Object.keys(nextLibrary).length) {
        Object.assign(nextLibrary, FALLBACK_SOUND_LIBRARY);
        SOUND_SCAN_STATUS = { tried, matchedFolder, files: Object.values(nextLibrary), usedFallback: true, errorCount };
        console.warn("ORILON Weather SFX: No files found by FilePicker scan. Using fallback paths.", SOUND_SCAN_STATUS);
      } else {
        SOUND_SCAN_STATUS = { tried, matchedFolder, files: Object.values(nextLibrary), usedFallback: false, errorCount };
        console.log("ORILON Weather SFX: Sound scan successful.", SOUND_SCAN_STATUS);
      }

      SOUND_LIBRARY = nextLibrary;
      return SOUND_LIBRARY;
    }

    function weatherSoundPath(filenameOrPath) {
      return filenameOrPath;
    }

    const AUDIO = {
      overcast: "",
      heatwave: "",
      lightRain: "",
      heavyRain: "",
      thunderstorm: "",
      hurricane: "",
      fog: "",
      snow: "",
      blizzard: "",
      wind: "",
      ashfall: "",
      embers: ""
    };

    let visualEngine = "fxmasterSafe"; // fxmasterSafe | native
    let sceneSfxEnabled = true;
    let atmosphereLightingEnabled = true;
    let stormLightningEnabled = true;
    let smoothLocalLightningEnabled = true;
    let galeDebrisEnabled = true;
    let weatherScreenOverlayEnabled = true;
    let characterWeatherEffectsEnabled = true;
    let tokenVisionWeatherEnabled = true;
    let fogIntensityMultiplier = 1.0;
    let selectedSoundNames = [];

    // FXMaster profiles are intentionally conservative.
    // The raw hurricane preset produced fog alpha 0.3 and rain density 5,
    // which can swallow the map. We tune it down after the preset is created.
    const WEATHER_PRESETS = {
      clear: {
        id: "clear",
        label: "Clear / Sunny",
        shortLabel: "Clear / Sunny",
        category: "Atmosphere",
        tone: "Clean sky, open visibility, and standard daylight atmosphere.",
        description: "Stops FXMaster weather, clears native weather, removes scene-local SFX, stops pulses, restores token vision, and resets atmosphere.",
        fxPreset: null,
        nativeWeather: "",
        atmosphereDarkness: 0.0,
        useLightning: false,
        clearFilters: true,
        sounds: []
      },

      overcast: {
        id: "overcast",
        label: "Overcast",
        shortLabel: "Overcast",
        category: "Atmosphere",
        tone: "Grey cloud cover, dimmer daylight, and the feeling of weather closing in.",
        description: "A non-rain cloud state for travel atmosphere: darker sky, slow grey haze, and mild visibility pressure without precipitation.",
        fxPreset: "mist",
        fxOptions: { density: "low", speed: "low", direction: 0, soundFx: false },
        nativeWeather: "",
        atmosphereDarkness: 0.14,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_overcast_low_haze",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#7f8589" },
            scale: 1.35,
            speed: 0.24,
            lifetime: 1,
            density: 0.045,
            alpha: 0.14,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_overcast_cloud_deck",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#636b72",
            scale: 2.25,
            speed: 0.30,
            direction: 0,
            density: 0.24,
            alpha: 0.30,
            opacity: 0.30
          }
        },
        useLightning: false,
        sounds: [
          { name: "Orilon Weather — Overcast", path: AUDIO.overcast, volume: 0.20, radius: 999999, repeat: true, hidden: false }
        ]
      },

      heatwave: {
        id: "heatwave",
        label: "Heatwave",
        shortLabel: "Heatwave",
        category: "Atmosphere",
        tone: "Punishing sun, hot air shimmer, dry haze, and glare that makes distance unreliable.",
        description: "A harsh dry-weather state: warm haze, slight glare, heat shimmer overlay, and mild vision pressure without rain or fog.",
        fxPreset: "mist",
        fxOptions: { density: "low", speed: "low", direction: 0, soundFx: false },
        nativeWeather: "",
        atmosphereDarkness: 0.03,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_heatwave_haze",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#b38b52" },
            scale: 1.18,
            speed: 0.20,
            lifetime: 1,
            density: 0.030,
            alpha: 0.10,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_heatwave_dust_haze",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#a5743e",
            scale: 1.55,
            speed: 0.22,
            direction: 0,
            density: 0.08,
            alpha: 0.12,
            opacity: 0.12
          }
        },
        useLightning: false,
        localWindDebris: null,
        sounds: [
          { name: "Orilon Weather — Heatwave", path: AUDIO.heatwave, volume: 0.20, radius: 999999, repeat: true, hidden: false }
        ]
      },

      lightRain: {
        id: "lightRain",
        label: "Light Rain",
        shortLabel: "Light Rain",
        category: "Rain",
        tone: "",
        description: "FXMaster drizzle strengthened into a proper light rain while staying clearly below heavy rain.",
        fxPreset: "drizzle",
        fxOptions: { density: "medium", speed: "low", direction: 78, soundFx: false },
        nativeWeather: "rain",
        atmosphereDarkness: 0.04,
        clearFilters: true,
        rain: {
          direction: 78,
          density: 1.35,
          speed: 0.95,
          scale: 1.22,
          lifetime: 2.45,
          alpha: 0.64,
          splash: false,
          tint: { apply: false, value: "#FFFFFF" }
        },
        fog: null,
        useLightning: false,
        sounds: [
          { name: "Orilon Weather — Light Rain", path: AUDIO.lightRain, volume: 0.28, radius: 999999, repeat: true, hidden: false }
        ]
      },

      heavyRain: {
        id: "heavyRain",
        label: "Heavy Rain",
        shortLabel: "Heavy Rain",
        category: "Rain",
        tone: "",
        description: "FXMaster rain tuned thick and fast, with the former storm fog package now applied to Heavy Rain and moving left to right.",
        fxPreset: "rain",
        fxOptions: { density: "high", speed: "medium", direction: 75, soundFx: false },
        nativeWeather: "rain",
        atmosphereDarkness: 0.24,
        clearFilters: true,
        rain: {
          direction: 75,
          density: 2.45,
          speed: 1.65,
          scale: 1.62,
          lifetime: 2.55,
          alpha: 0.84,
          splash: true,
          tint: { apply: false, value: "#FFFFFF" }
        },
        fog: {
          id: "apiPreset_orilon_heavy_rain_mist",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#59616a" },
            scale: 1.28,
            speed: 1.85,
            lifetime: 1,
            density: 0.085,
            alpha: 0.22,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_heavy_rain_cloud_mist",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#59616a",
            scale: 1.65,
            speed: 1.15,
            direction: 0,
            density: 0.17,
            alpha: 0.24,
            opacity: 0.24
          }
        },
        useLightning: false,
        sounds: [
          { name: "Orilon Weather — Heavy Rain", path: AUDIO.heavyRain, volume: 0.44, radius: 999999, repeat: true, hidden: false }
        ]
      },

      thunderstorm: {
        id: "thunderstorm",
        label: "Thunderstorm",
        shortLabel: "Storm",
        category: "Storm",
        tone: "",
        description: "Controlled FXMaster storm rain plus the former gale fog package, now moving left to right. Storm gets lightning strikes, but less often than Gale.",
        fxPreset: "rain",
        fxOptions: { density: "high", speed: "high", direction: 72, soundFx: false },
        nativeWeather: "rain",
        atmosphereDarkness: 0.46,
        clearFilters: true,
        rain: {
          direction: 72,
          density: 3.25,
          speed: 2.20,
          scale: 2.00,
          lifetime: 2.35,
          alpha: 0.88,
          splash: true,
          tint: { apply: false, value: "#FFFFFF" }
        },
        fog: {
          id: "apiPreset_orilon_storm_fog",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#20242a" },
            scale: 1.35,
            speed: 2.25,
            lifetime: 1,
            density: 0.10,
            alpha: 0.24,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_storm_cloud_mist",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#2d333a",
            scale: 2.05,
            speed: 1.65,
            direction: 0,
            density: 0.24,
            alpha: 0.30,
            opacity: 0.30
          }
        },
        useLightning: true,
        lightning: {
          baseDarkness: 0.46,
          flashDarkness: 0.05,
          strikeFlashDarkness: 0.0,
          flashHoldMs: 70,
          fadeOutMs: 760,
          settleDarkness: 0.24,
          minIntervalMs: 9500,
          maxIntervalMs: 18000,
          doubleFlashChance: 0.06,
          doubleFlashDelayMs: 180,
          strikeChance: 0.16,
          overlayPeak: 0.38,
          strikeOverlayPeak: 0.82,
          overlayFadeMs: 980
        },
        sounds: [
          { name: "Orilon Weather — Thunderstorm", path: AUDIO.thunderstorm, volume: 0.52, radius: 999999, repeat: true, hidden: false }
        ]
      },

      galeHurricane: {
        id: "galeHurricane",
        label: "Gale / Hurricane",
        shortLabel: "Gale",
        category: "Catastrophic",
        tone: "Violent wind, punishing rain, fast left-to-right fog, and active lightning strikes.",
        description: "Controlled hurricane preset: punishing rain, fast-moving gale fog, cloud pressure, more frequent lightning strikes than Storm, and a subtle debris layer.",
        fxPreset: "hurricane",
        fxOptions: { density: "high", speed: "high", direction: 65, soundFx: false },
        nativeWeather: "rain",
        atmosphereDarkness: 0.64,
        clearFilters: true,
        rain: {
          direction: 65,
          density: 4.15,
          speed: 3.10,
          scale: 2.35,
          lifetime: 2.4,
          alpha: 0.88,
          splash: true,
          tint: { apply: false, value: "#FFFFFF" }
        },
        fog: {
          id: "apiPreset_orilon_gale_fog",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#1d2126" },
            scale: 1.45,
            speed: 2.85,
            lifetime: 1,
            density: 0.14,
            alpha: 0.28,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_gale_cloud_mist",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#2c3238",
            scale: 2.25,
            speed: 2.05,
            direction: 0,
            density: 0.30,
            alpha: 0.34,
            opacity: 0.34
          }
        },
        extraEffects: [
          {
            id: "apiPreset_orilon_extra_gale_debris",
            type: "clouds",
            options: {
              belowTokens: false,
              belowTiles: false,
              belowForeground: false,
              darknessActivationEnabled: false,
              soundFxEnabled: false,
              tint: "#5d6f3b",
              scale: 0.68,
              speed: 3.35,
              direction: 0,
              density: 0.09,
              alpha: 0.11,
              opacity: 0.11
            }
          }
        ],
        useLightning: true,
        lightning: {
          baseDarkness: 0.62,
          flashDarkness: 0.03,
          strikeFlashDarkness: 0.0,
          flashHoldMs: 65,
          fadeOutMs: 980,
          settleDarkness: 0.30,
          minIntervalMs: 5200,
          maxIntervalMs: 10500,
          doubleFlashChance: 0.10,
          doubleFlashDelayMs: 145,
          strikeChance: 0.34,
          overlayPeak: 0.46,
          strikeOverlayPeak: 0.92,
          overlayFadeMs: 1150
        },
        sounds: [
          { name: "Orilon Weather — Gale / Hurricane", path: AUDIO.hurricane, volume: 0.62, radius: 999999, repeat: true, hidden: false }
        ]
      },

      fog: {
        id: "fog",
        label: "Fog / Mist",
        shortLabel: "Fog",
        category: "Mist",
        tone: "Thick field fog with reduced visibility.",
        description: "A stronger normal fog state: visually present, map-obscuring, and dangerous without becoming full heavy fog.",
        fxPreset: "mist",
        fxOptions: { density: "high", speed: "low", soundFx: false },
        nativeWeather: "fog",
        atmosphereDarkness: 0.20,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_controlled_fog",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#8f989e" },
            scale: 1.55,
            speed: 0.58,
            lifetime: 1,
            density: 0.14,
            alpha: 0.44,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_fog_cloud_sheet",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#969fa5",
            scale: 2.20,
            speed: 0.34,
            direction: 0,
            density: 0.28,
            alpha: 0.40,
            opacity: 0.40
          }
        },
        useLightning: false,
        localWindDebris: null,
        sounds: [
          { name: "Orilon Weather — Fog Wind", path: AUDIO.fog, volume: 0.22, radius: 999999, repeat: true, hidden: false }
        ]
      },

      heavyFog: {
        id: "heavyFog",
        label: "Heavy Fog",
        shortLabel: "Heavy Fog",
        category: "Mist",
        tone: "Dense field-obscuring fog.",
        description: "A heavier fog state for travel danger, battlefield concealment, and reduced visibility scenes.",
        fxPreset: "rolling-fog",
        fxOptions: { density: "high", speed: "low", soundFx: false },
        nativeWeather: "fog",
        atmosphereDarkness: 0.22,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_heavy_fog",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#8f989e" },
            scale: 1.65,
            speed: 0.72,
            lifetime: 1,
            density: 0.16,
            alpha: 0.44,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_heavy_fog_cloud_sheet",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#9aa2a8",
            scale: 2.35,
            speed: 0.48,
            direction: 0,
            density: 0.28,
            alpha: 0.40,
            opacity: 0.40
          }
        },
        useLightning: false,
        localWindDebris: null,
        sounds: [
          { name: "Orilon Weather — Heavy Fog", path: AUDIO.fog, volume: 0.27, radius: 999999, repeat: true, hidden: false }
        ]
      },

      snow: {
        id: "snow",
        label: "Falling Snow",
        shortLabel: "Snow",
        category: "Cold",
        tone: "Cold snowfall with darker winter haze and reduced visibility.",
        description: "FXMaster snow with a colder grey-blue haze. Snow remains playable, but sight and perception are now meaningfully reduced.",
        fxPreset: "snow",
        fxOptions: { density: "medium", speed: "medium", direction: 80, soundFx: false },
        nativeWeather: "snow",
        atmosphereDarkness: 0.16,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_snow_cold_haze",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#aebbc5" },
            scale: 1.24,
            speed: 0.36,
            lifetime: 1,
            density: 0.060,
            alpha: 0.18,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_snow_winter_haze",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#a9b6c0",
            scale: 1.62,
            speed: 0.34,
            direction: 0,
            density: 0.12,
            alpha: 0.20,
            opacity: 0.20
          }
        },
        useLightning: false,
        localWindDebris: null,
        sounds: [
          { name: "Orilon Weather — Snow", path: AUDIO.snow, volume: 0.34, radius: 999999, repeat: true, hidden: false }
        ]
      },

      blizzard: {
        id: "blizzard",
        label: "Blizzard",
        shortLabel: "Blizzard",
        category: "Cold",
        tone: "Violent wind, punishing snow, whiteout visibility, and dangerous cold exposure.",
        description: "A harsh whiteout state: fast snow, wind pressure, heavy cold haze, local snow streaks, and severe token sight reduction. Players should immediately know they are in trouble.",
        fxPreset: "snow",
        fxOptions: { density: "high", speed: "high", direction: 64, soundFx: false },
        nativeWeather: "snow",
        atmosphereDarkness: 0.36,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_blizzard_whiteout_fog",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#c5ced6" },
            scale: 1.82,
            speed: 1.55,
            lifetime: 1,
            density: 0.18,
            alpha: 0.42,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_blizzard_snow_curtain",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#b7c2cb",
            scale: 2.40,
            speed: 2.25,
            direction: 0,
            density: 0.34,
            alpha: 0.46,
            opacity: 0.46
          }
        },
        extraEffects: [
          {
            id: "apiPreset_orilon_blizzard_grey_crosswind",
            type: "clouds",
            options: {
              belowTokens: false,
              belowTiles: false,
              belowForeground: false,
              darknessActivationEnabled: false,
              soundFxEnabled: false,
              tint: "#8e9aa4",
              scale: 1.15,
              speed: 3.10,
              direction: 0,
              density: 0.18,
              alpha: 0.22,
              opacity: 0.22
            }
          }
        ],
        useLightning: false,
        localWindDebris: {
          enabled: true,
          type: "blizzard",
          intervalMs: 190,
          minBurst: 5,
          maxBurst: 11,
          maxActiveParticles: 160,
          speedMin: 780,
          speedMax: 2100,
          colors: ["#edf4f8", "#dce7ed", "#c9d5dd", "#f7fbff"]
        },
        sounds: [
          { name: "Orilon Weather — Blizzard", path: AUDIO.blizzard, volume: 0.58, radius: 999999, repeat: true, hidden: false }
        ]
      },

      wind: {
        id: "wind",
        label: "High Wind",
        shortLabel: "Wind",
        category: "Wind",
        tone: "Fast-moving air, dust, leaves, and field pressure.",
        description: "FXMaster windy preset with fast left-to-right cloud wisps and local light debris gusts.",
        fxPreset: "windy",
        fxOptions: { density: "medium", speed: "high", direction: 0, soundFx: false },
        nativeWeather: "",
        atmosphereDarkness: 0.04,
        clearFilters: true,
        rain: null,
        fog: null,
        clouds: {
          id: "apiPreset_orilon_wind_wisps",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#8f8b7c",
            scale: 1.15,
            speed: 1.65,
            direction: 0,
            density: 0.10,
            alpha: 0.13,
            opacity: 0.13
          }
        },
        useLightning: false,
        localWindDebris: {
          enabled: true,
          type: "leaves",
          intervalMs: 880,
          minBurst: 1,
          maxBurst: 3,
          speedMin: 2100,
          speedMax: 5200,
          colors: ["#6f7f39", "#8a6d36", "#4f6330", "#9a8147", "#5b4a2c"]
        },
        sounds: [
          { name: "Orilon Weather — High Wind", path: AUDIO.wind, volume: 0.38, radius: 999999, repeat: true, hidden: false }
        ]
      },

      ashfall: {
        id: "ashfall",
        label: "Ashfall",
        shortLabel: "Ashfall",
        category: "Hazard",
        tone: "Dirty air, falling soot, and faint ember flecks.",
        description: "A layered ashfall: smoky grey haze, visible ash drift, and subtle ember flecks.",
        fxPreset: "ashfall",
        fxOptions: { density: "medium", speed: "low", direction: 0, soundFx: false },
        nativeWeather: "",
        atmosphereDarkness: 0.20,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_ash_smoke",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#5a5652" },
            scale: 1.22,
            speed: 0.42,
            lifetime: 1,
            density: 0.065,
            alpha: 0.19,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_ash_smoke_clouds",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#4a4642",
            scale: 1.65,
            speed: 0.32,
            direction: 0,
            density: 0.15,
            alpha: 0.22,
            opacity: 0.22
          }
        },
        useLightning: false,
        localWindDebris: {
          enabled: true,
          type: "ashfall",
          intervalMs: 320,
          minBurst: 4,
          maxBurst: 8,
          maxActiveParticles: 90,
          speedMin: 5600,
          speedMax: 10200,
          colors: ["#9a9288", "#807970", "#6f6962", "#56514b", "#b07845", "#cf7a34"]
        },
        sounds: [
          { name: "Orilon Weather — Ashfall", path: AUDIO.ashfall, volume: 0.28, radius: 999999, repeat: true, hidden: false }
        ]
      },

      heavyAshfall: {
        id: "heavyAshfall",
        label: "Heavy Ashfall",
        shortLabel: "Heavy Ash",
        category: "Hazard",
        tone: "Thick smoke, choking ash, and ember drift.",
        description: "A heavier hazardous ashfall state with darker charcoal smoke, denser ash, and ember drift.",
        fxPreset: "ashfall",
        fxOptions: { density: "high", speed: "medium", direction: 0, soundFx: false },
        nativeWeather: "",
        atmosphereDarkness: 0.31,
        clearFilters: true,
        rain: null,
        fog: {
          id: "apiPreset_orilon_heavy_ash_smoke",
          type: "fog",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: { apply: true, value: "#3f3d3b" },
            scale: 1.50,
            speed: 0.58,
            lifetime: 1,
            density: 0.13,
            alpha: 0.34,
            direction: 0
          }
        },
        clouds: {
          id: "apiPreset_orilon_heavy_ash_clouds",
          type: "clouds",
          options: {
            belowTokens: false,
            belowTiles: false,
            belowForeground: false,
            darknessActivationEnabled: false,
            soundFxEnabled: false,
            tint: "#312f2d",
            scale: 2.05,
            speed: 0.46,
            direction: 0,
            density: 0.30,
            alpha: 0.42,
            opacity: 0.42
          }
        },
        extraEffects: [
          {
            id: "apiPreset_orilon_heavy_ash_ember_haze",
            type: "clouds",
            options: {
              belowTokens: false,
              belowTiles: false,
              belowForeground: false,
              darknessActivationEnabled: false,
              soundFxEnabled: false,
              tint: "#b05e2a",
              scale: 0.72,
              speed: 0.82,
              direction: 0,
              density: 0.045,
              alpha: 0.075,
              opacity: 0.075
            }
          }
        ],
        useLightning: false,
        localWindDebris: {
          enabled: true,
          type: "heavyAshfall",
          intervalMs: 260,
          minBurst: 6,
          maxBurst: 11,
          maxActiveParticles: 130,
          speedMin: 6000,
          speedMax: 11000,
          colors: ["#9a9288", "#736d65", "#5b554f", "#3f3b36", "#c46a2d", "#dc8a38", "#2d2b28"]
        },
        sounds: [
          { name: "Orilon Weather — Heavy Ashfall", path: AUDIO.ashfall, volume: 0.34, radius: 999999, repeat: true, hidden: false }
        ]
      }
    };

    const ACTIVE_EFFECT_MODE_ADD = globalThis.CONST?.ACTIVE_EFFECT_MODES?.ADD ?? 2;

    const WEATHER_CHARACTER_EFFECT_PROFILES = {
      overcast: {
        label: "Overcast",
        visibility: "Dim overcast visibility",
        penalty: -1,
        visionMultiplier: 0.90,
        visionCap: 150,
        visionMinimum: 10,
        description: "Grey cloud cover and low contrast make distant details slightly harder to read."
      },
      heatwave: {
        label: "Heatwave",
        visibility: "Heat shimmer visibility",
        penalty: -1,
        visionMultiplier: 0.75,
        visionCap: 100,
        visionMinimum: 10,
        description: "Glare, wavering heat, and dry haze make long sightlines unreliable."
      },
      lightRain: {
        label: "Light Rain",
        visibility: "Mild rain visibility",
        penalty: -1,
        visionMultiplier: 0.85,
        visionCap: 120,
        visionMinimum: 10,
        description: "Light rainfall makes distant details harder to read. Applies a small Perception penalty."
      },
      heavyRain: {
        label: "Heavy Rain",
        visibility: "Heavy rain visibility",
        penalty: -2,
        visionMultiplier: 0.65,
        visionCap: 80,
        visionMinimum: 10,
        description: "Heavy rain reduces visibility and makes careful observation harder."
      },
      thunderstorm: {
        label: "Storm",
        visibility: "Storm visibility",
        penalty: -3,
        visionMultiplier: 0.50,
        visionCap: 60,
        visionMinimum: 10,
        description: "Storm rain, thunder, and poor light interfere with sight and hearing."
      },
      galeHurricane: {
        label: "Gale",
        visibility: "Gale visibility",
        penalty: -4,
        visionMultiplier: 0.35,
        visionCap: 40,
        visionMinimum: 10,
        description: "Violent weather makes sightlines unstable and observation unreliable."
      },
      fog: {
        label: "Fog / Mist",
        visibility: "Thick fog visibility",
        penalty: -3,
        visionMultiplier: 0.32,
        visionCap: 30,
        visionMinimum: 5,
        description: "Thick fog obscures distance, reduces token sight range, and makes observation unreliable."
      },
      heavyFog: {
        label: "Heavy Fog",
        visibility: "Heavy fog visibility",
        penalty: -5,
        visionMultiplier: 0.20,
        visionCap: 15,
        visionMinimum: 5,
        description: "Dense fog heavily obscures the field and sharply limits useful visibility."
      },
      snow: {
        label: "Falling Snow",
        visibility: "Snow visibility",
        penalty: -2,
        visionMultiplier: 0.70,
        visionCap: 80,
        visionMinimum: 10,
        description: "Darker snowfall and winter haze reduce sight range and make distant details harder to read."
      },
      blizzard: {
        label: "Blizzard",
        visibility: "Whiteout visibility",
        penalty: -5,
        visionMultiplier: 0.20,
        visionCap: 20,
        visionMinimum: 5,
        description: "Blinding snow and violent wind create whiteout conditions. Token sight range is severely limited."
      },
      wind: {
        label: "High Wind",
        visibility: "Wind visibility",
        penalty: -1,
        visionMultiplier: 0.85,
        visionCap: 120,
        visionMinimum: 10,
        description: "Wind-blown dust, leaves, and pressure make observation less reliable."
      },
      ashfall: {
        label: "Ashfall",
        visibility: "Ash visibility",
        penalty: -3,
        visionMultiplier: 0.45,
        visionCap: 60,
        visionMinimum: 10,
        description: "Ash and smoke reduce visibility, limit token sight range, and make careful observation difficult."
      },
      heavyAshfall: {
        label: "Heavy Ashfall",
        visibility: "Heavy ash visibility",
        penalty: -5,
        visionMultiplier: 0.25,
        visionCap: 25,
        visionMinimum: 5,
        description: "Thick ash and smoke severely limit visibility and heavily reduce token sight range."
      }
    };


    // ======================================================
    // HELPERS
    // ======================================================

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function clamp01(value) {
      return Math.min(Math.max(Number(value ?? 0), 0), 1);
    }

    function getSceneDarkness(targetScene = scene) {
      return Number(targetScene.environment?.darknessLevel ?? 0);
    }

    async function setSceneDarkness(targetScene, value) {
      await targetScene.update({ "environment.darknessLevel": clamp01(value) });
    }

    function currentWeatherState(targetScene = scene) {
      return targetScene.getFlag(FLAG_SCOPE, WEATHER_STATE_FLAG) || null;
    }

    function getOrilonWeatherSounds(targetScene = scene) {
      return targetScene.sounds.filter(sound => {
        try {
          if (sound.getFlag(FLAG_SCOPE, WEATHER_SOUND_FLAG) === true) return true;
          if (sound.getFlag(FLAG_SCOPE, WEATHER_SOUND_SOURCE_FLAG) === "Weather Control") return true;
        } catch (_err) {}

        const name = String(sound.name || "");
        return name.startsWith("Orilon Weather —") || name.startsWith("Weather Control —");
      });
    }

    function getSceneCenter(targetScene) {
      const width = targetScene.width || targetScene.dimensions?.width || canvas.dimensions?.width || 4000;
      const height = targetScene.height || targetScene.dimensions?.height || canvas.dimensions?.height || 3000;
      return { x: Math.round(width / 2), y: Math.round(height / 2) };
    }

    function nativeWeatherValue(targetScene = scene) {
      return targetScene.weather ?? targetScene.environment?.weather ?? "";
    }

    function nativeWeatherLabel(targetScene = scene) {
      const value = nativeWeatherValue(targetScene);
      return value === "" || value === null || value === undefined ? "None" : String(value);
    }

    function getFxApi() {
      return globalThis.FXMASTER?.api || null;
    }

    function fxmasterAvailable() {
      return Boolean(getFxApi()?.presets?.switch);
    }

    function clone(value) {
      try {
        return foundry.utils.deepClone(value);
      } catch (_err) {
        return JSON.parse(JSON.stringify(value ?? null));
      }
    }

    async function redrawCanvas() {
      try {
        if (canvas?.perception?.update) {
          canvas.perception.update({ initializeVision: true, refreshLighting: true }, true);
        }
        if (canvas?.effects?.refresh) canvas.effects.refresh();
        if (canvas?.lighting?.refresh) canvas.lighting.refresh();
      } catch (err) {
        console.warn("ORILON Weather: canvas refresh attempt failed.", err);
      }
    }

    async function clearNativeWeather(targetScene) {
      const attempts = [
        { weather: "" },
        { weather: null },
        { "environment.weather": "" },
        { "environment.weather": null }
      ];

      for (const data of attempts) {
        try {
          await targetScene.update(data);
          return true;
        } catch (_err) {}
      }

      return false;
    }

    async function applyNativeWeather(targetScene, weatherId) {
      if (!weatherId) return clearNativeWeather(targetScene);

      const attempts = [
        { weather: weatherId },
        { "environment.weather": weatherId }
      ];

      for (const data of attempts) {
        try {
          await targetScene.update(data);
          return true;
        } catch (_err) {}
      }

      ui.notifications.warn(`Native weather was not accepted by this Foundry build: ${weatherId}`);
      return false;
    }

    async function clearSceneSfx(targetScene) {
      const sounds = getOrilonWeatherSounds(targetScene);
      if (!sounds.length) return 0;

      const ids = sounds.map(sound => sound.id).filter(Boolean);
      if (!ids.length) return 0;

      await targetScene.deleteEmbeddedDocuments("AmbientSound", ids);
      await sleep(80);
      await redrawCanvas();
      return ids.length;
    }

    async function applySceneSfx(targetScene, preset) {
      const center = getSceneCenter(targetScene);

      if (!Object.keys(SOUND_LIBRARY || {}).length) {
        await scanWeatherSoundFolder();
      }

      const soundSet = buildSoundsFromSelectedNames(preset);

      const ambientSoundDocs = soundSet
        .filter(sound => String(sound.path || "").trim())
        .map(sound => ({
          name: sound.name || `Orilon Weather — ${preset.label}`,
          x: center.x,
          y: center.y,
          radius: sound.radius ?? 999999,
          path: weatherSoundPath(sound.path),
          volume: sound.volume ?? 0.5,
          repeat: true,
          hidden: sound.hidden ?? false,
          easing: false,
          walls: false,
          flags: {
            [FLAG_SCOPE]: {
              [WEATHER_SOUND_FLAG]: true,
              [WEATHER_SOUND_SOURCE_FLAG]: "Weather Control",
              weatherId: preset.id,
              weatherLabel: preset.label
            }
          }
        }));

      console.log("ORILON Weather SFX: AmbientSound build", {
        preset: preset?.id,
        scene: targetScene?.name,
        center,
        selectedSoundNames,
        soundSet,
        ambientSoundDocs,
        soundScanStatus: SOUND_SCAN_STATUS
      });

      if (ambientSoundDocs.length) {
        await targetScene.createEmbeddedDocuments("AmbientSound", ambientSoundDocs);
        ui.notifications.info(`Weather SFX node(s) created: ${ambientSoundDocs.length}`);
      } else {
        ui.notifications.warn("Scene-Local SFX is enabled, but no valid weather sound paths were found.");
      }

      return ambientSoundDocs.length;
    }

    function normalizedFxOptions(baseOptions = {}, patch = {}) {
      return {
        belowTokens: false,
        belowTiles: false,
        belowForeground: false,
        darknessActivationEnabled: false,
        soundFxEnabled: false,
        ...baseOptions,
        ...patch
      };
    }

    function tuneRainOptions(existing = {}, profile = {}) {
      return normalizedFxOptions(existing, {
        tint: profile.tint ?? existing.tint ?? { apply: false, value: "#FFFFFF" },
        topDown: false,
        splash: profile.splash ?? existing.splash ?? false,
        scale: profile.scale ?? existing.scale ?? 1.5,
        direction: profile.direction ?? existing.direction ?? 75,
        speed: profile.speed ?? existing.speed ?? 1,
        lifetime: profile.lifetime ?? existing.lifetime ?? 2.5,
        density: profile.density ?? existing.density ?? 1,
        alpha: profile.alpha ?? existing.alpha ?? 0.8
      });
    }

    function scaleFogValue(value, fallback, min = 0, max = 1) {
      const base = Number(value ?? fallback ?? 0);
      const scaled = base * Number(fogIntensityMultiplier || 1);
      return Math.min(Math.max(scaled, min), max);
    }

    function tuneFogOptions(existing = {}, fogProfile = {}) {
      const profileOptions = fogProfile.options || {};
      return normalizedFxOptions(existing, {
        tint: profileOptions.tint ?? existing.tint ?? { apply: true, value: "#777777" },
        scale: profileOptions.scale ?? existing.scale ?? 1,
        direction: profileOptions.direction ?? existing.direction ?? 0,
        speed: profileOptions.speed ?? existing.speed ?? 1,
        lifetime: profileOptions.lifetime ?? existing.lifetime ?? 1,
        density: scaleFogValue(profileOptions.density, existing.density ?? 0.03, 0, 0.75),
        alpha: scaleFogValue(profileOptions.alpha, existing.alpha ?? 0.1, 0, 0.80),
        topDown: profileOptions.topDown ?? existing.topDown ?? false
      });
    }

    function tuneCloudOptions(existing = {}, cloudProfile = {}) {
      const profileOptions = cloudProfile.options || {};
      const alphaValue = scaleFogValue(profileOptions.alpha ?? profileOptions.opacity, existing.alpha ?? existing.opacity ?? 0.18, 0, 0.85);
      return normalizedFxOptions(existing, {
        tint: profileOptions.tint ?? existing.tint ?? "#777777",
        scale: profileOptions.scale ?? existing.scale ?? 1.5,
        direction: profileOptions.direction ?? existing.direction ?? 0,
        speed: profileOptions.speed ?? existing.speed ?? 0.5,
        density: scaleFogValue(profileOptions.density, existing.density ?? 0.1, 0, 0.75),
        alpha: alphaValue,
        opacity: alphaValue,
        topDown: profileOptions.topDown ?? existing.topDown ?? false
      });
    }

    async function refreshFxmasterEffects(targetScene) {
      try {
        await targetScene.setFlag("fxmaster", "_apiEffectsUpdateOptions", {
          skipFading: true,
          nonce: foundry.utils.randomID()
        });
      } catch (err) {
        console.warn("ORILON Weather: FXMaster update option nonce failed.", err);
      }

      await redrawCanvas();
    }

    async function clearFxmasterWeather(targetScene) {
      const api = getFxApi();

      try {
        if (api?.presets?.switch) {
          await api.presets.switch(null, { scene: targetScene.uuid, silent: true });
        }
      } catch (err) {
        console.warn("ORILON Weather: FXMaster preset clear failed.", err);
      }

      try {
        await targetScene.unsetFlag("fxmaster", "effects");
      } catch (_err) {}

      try {
        await targetScene.unsetFlag("fxmaster", "filters");
      } catch (_err) {}

      await refreshFxmasterEffects(targetScene);
    }

    async function applyOrilonFxAdjustments(targetScene, preset) {
      if (!preset || (!preset.rain && !preset.fog && !preset.clouds && !preset.extraEffects && !preset.clearFilters)) return;

      const effects = foundry.utils.deepClone(targetScene.getFlag("fxmaster", "effects") || {});
      let changed = false;
      let hasFog = false;
      let hasClouds = false;

      for (const [effectId, effect] of Object.entries(effects)) {
        if (!effect || typeof effect !== "object") continue;

        if (effect.type === "rain" && preset.rain) {
          effect.options = tuneRainOptions(effect.options || {}, preset.rain);
          changed = true;
          continue;
        }

        if (effect.type === "fog") {
          if (preset.fog) {
            effect.options = tuneFogOptions(effect.options || {}, preset.fog);
            hasFog = true;
            changed = true;
          } else if (String(effectId).startsWith("apiPreset_orilon_")) {
            delete effects[effectId];
            changed = true;
          }
        }

        if (effect.type === "clouds") {
          if (preset.clouds) {
            effect.options = tuneCloudOptions(effect.options || {}, preset.clouds);
            hasClouds = true;
            changed = true;
          } else if (String(effectId).startsWith("apiPreset_orilon_")) {
            delete effects[effectId];
            changed = true;
          }
        }
      }

      if (preset.fog && !hasFog) {
        effects[preset.fog.id || `apiPreset_orilon_${preset.id}_fog`] = {
          type: preset.fog.type || "fog",
          options: tuneFogOptions({}, preset.fog)
        };
        changed = true;
      }

      if (preset.clouds && !hasClouds) {
        effects[preset.clouds.id || `apiPreset_orilon_${preset.id}_clouds`] = {
          type: preset.clouds.type || "clouds",
          options: tuneCloudOptions({}, preset.clouds)
        };
        changed = true;
      }

      for (const extra of (preset.extraEffects || [])) {
        if (!extra || !extra.id || !extra.type) continue;
        if (extra.type === "clouds") {
          effects[extra.id] = {
            type: extra.type,
            options: tuneCloudOptions({}, extra)
          };
          changed = true;
        } else if (extra.type === "fog") {
          effects[extra.id] = {
            type: extra.type,
            options: tuneFogOptions({}, extra)
          };
          changed = true;
        }
      }

      if (preset.clearFilters) {
        try {
          await targetScene.unsetFlag("fxmaster", "filters");
        } catch (_err) {}
      }

      if (!changed) return;

      await targetScene.setFlag("fxmaster", "effects", effects);
      await refreshFxmasterEffects(targetScene);
    }

    async function applyFxmasterControlledWeather(targetScene, preset) {
      if (!fxmasterAvailable()) {
        ui.notifications.warn("FXMaster API not found. Falling back to native weather.");
        return { fxApplied: false, fxMode: "missing" };
      }

      const api = getFxApi();

      if (!preset.fxPreset) {
        await clearFxmasterWeather(targetScene);
        return { fxApplied: true, fxMode: "cleared" };
      }

      const options = {
        scene: targetScene.uuid,
        silent: false,
        soundFx: false,
        ...(preset.fxOptions || {})
      };

      try {
        const result = await api.presets.switch(preset.fxPreset, options);

        // v15: use the working preset call as the baseline, then apply
        // tightly controlled Orilon rain/fog tuning for each weather state.
        await applyOrilonFxAdjustments(targetScene, preset);
        await redrawCanvas();

        return {
          fxApplied: Boolean(result),
          fxMode: "fxmaster-orilon-tuned",
          fxPreset: preset.fxPreset,
          fxOptions: options
        };
      } catch (err) {
        console.error("ORILON Weather: FXMaster preset failed.", err);
        ui.notifications.error(`FXMaster preset failed: ${preset.fxPreset}`);
        return { fxApplied: false, fxMode: "preset-error", error: err.message };
      }
    }

    function getLocalFxHost() {
      // v42: use a body-fixed client overlay. The v39 scene-board host could render
      // behind the canvas on some Foundry layouts, which hid the smoky veil, ash, and embers.
      return document.body;
    }

    function ensureWeatherFxHost() {
      return document.body;
    }

    function ensureSmoothLightningOverlay() {
      let overlay = document.getElementById("orilon-weather-lightning-overlay");
      if (overlay) return overlay;

      overlay = document.createElement("div");
      overlay.id = "orilon-weather-lightning-overlay";
      overlay.className = "orilon-weather-local-fx";
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "999";
      overlay.style.opacity = "0";
      overlay.style.background = `
        radial-gradient(circle at 50% 20%, rgba(220,235,255,0.95), rgba(170,205,255,0.42) 28%, rgba(120,160,220,0.08) 68%, transparent 100%),
        linear-gradient(180deg, rgba(225,240,255,0.72), rgba(160,190,255,0.12))
      `;
      overlay.style.mixBlendMode = "screen";
      overlay.style.willChange = "opacity";

      document.body.appendChild(overlay);
      return overlay;
    }

    function spawnLightningBolt(isStrike = false) {
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.classList.add("orilon-weather-local-fx");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.style.position = "fixed";
      svg.style.left = `${randomInt(12, 88)}vw`;
      svg.style.top = "0";
      svg.style.width = isStrike ? "16vw" : "10vw";
      svg.style.height = isStrike ? "55vh" : "38vh";
      svg.style.pointerEvents = "none";
      svg.style.zIndex = "1000";
      svg.style.opacity = "0.92";
      svg.style.filter = "drop-shadow(0 0 12px rgba(210,230,255,0.95)) drop-shadow(0 0 28px rgba(140,180,255,0.45))";

      const polyline = document.createElementNS(svgNS, "polyline");
      const mid = randomInt(42, 58);
      const points = [
        `${mid},0`,
        `${mid - randomInt(8, 20)},18`,
        `${mid + randomInt(4, 18)},34`,
        `${mid - randomInt(10, 22)},52`,
        `${mid + randomInt(2, 18)},70`,
        `${mid - randomInt(4, 16)},100`
      ].join(" ");

      polyline.setAttribute("points", points);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke", "rgba(235,245,255,0.98)");
      polyline.setAttribute("stroke-width", isStrike ? "4.6" : "3.0");
      polyline.setAttribute("stroke-linecap", "round");
      polyline.setAttribute("stroke-linejoin", "round");
      svg.appendChild(polyline);

      document.body.appendChild(svg);

      requestAnimationFrame(() => {
        svg.style.transition = "opacity 460ms ease-out, transform 680ms ease-out";
        svg.style.opacity = "0";
        svg.style.transform = "translateY(10px) scaleY(0.98)";
      });

      runtimeTimeout(() => svg.remove(), 760);
    }

    async function triggerLightningPulse(targetScene, lightningConfig, isStrike = false) {
      if (RUNTIME.activeSceneId !== targetScene.id) return;

      if (!smoothLocalLightningEnabled) {
        const base = clamp01(lightningConfig.baseDarkness ?? 0.30);
        const flash = clamp01(isStrike ? (lightningConfig.strikeFlashDarkness ?? 0.0) : (lightningConfig.flashDarkness ?? 0.03));
        await setSceneDarkness(targetScene, flash);
        runtimeTimeout(async () => {
          if (RUNTIME.activeSceneId !== targetScene.id) return;
          await setSceneDarkness(targetScene, base);
        }, Number(lightningConfig.fadeOutMs ?? 760));
        return;
      }

      const overlay = ensureSmoothLightningOverlay();
      const peak = isStrike
        ? Number(lightningConfig.strikeOverlayPeak ?? 0.85)
        : Number(lightningConfig.overlayPeak ?? 0.42);
      const fadeMs = Number(lightningConfig.overlayFadeMs ?? lightningConfig.fadeOutMs ?? 950);
      const holdMs = Number(lightningConfig.flashHoldMs ?? 65);

      overlay.style.transition = "none";
      overlay.style.opacity = String(Math.min(Math.max(peak, 0), 1));

      if (isStrike) spawnLightningBolt(true);

      runtimeTimeout(() => {
        overlay.style.transition = `opacity ${fadeMs}ms cubic-bezier(0.16, 0.84, 0.28, 1)`;
        overlay.style.opacity = "0";
      }, holdMs);
    }

    function scheduleNextLightning(targetScene, lightningConfig) {
      if (RUNTIME.activeSceneId !== targetScene.id) return;
      if (RUNTIME.activeMode !== "storm-lightning") return;

      const delay = randomInt(lightningConfig.minIntervalMs ?? 7000, lightningConfig.maxIntervalMs ?? 21000);

      runtimeTimeout(async () => {
        if (RUNTIME.activeSceneId !== targetScene.id) return;
        if (RUNTIME.activeMode !== "storm-lightning") return;

        const isStrike = Math.random() < Number(lightningConfig.strikeChance ?? 0);
        await triggerLightningPulse(targetScene, lightningConfig, isStrike);

        if (!isStrike && Math.random() < Number(lightningConfig.doubleFlashChance ?? 0)) {
          runtimeTimeout(async () => {
            if (RUNTIME.activeSceneId !== targetScene.id) return;
            if (RUNTIME.activeMode !== "storm-lightning") return;
            await triggerLightningPulse(targetScene, lightningConfig, false);
          }, lightningConfig.doubleFlashDelayMs ?? 180);
        }

        scheduleNextLightning(targetScene, lightningConfig);
      }, delay);
    }


    function ensureAshfallOverlayStyle() {
      let style = document.getElementById("orilon-weather-ashfall-overlay-style");
      if (style) return style;

      style = document.createElement("style");
      style.id = "orilon-weather-ashfall-overlay-style";
      style.className = "orilon-weather-local-fx";
      style.textContent = `
        @keyframes orilonAshfallVeilDrift {
          0% { transform: translate3d(-1.2%, -0.4%, 0) scale(1.035); opacity: 0.78; }
          50% { transform: translate3d(0.9%, 0.6%, 0) scale(1.055); opacity: 0.94; }
          100% { transform: translate3d(1.6%, -0.2%, 0) scale(1.045); opacity: 0.84; }
        }
        @keyframes orilonAshParticleFall {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rot-start, 0deg)) scale(var(--scale, 1));
            opacity: var(--opacity-start, 0.42);
          }
          82% { opacity: var(--opacity-mid, 0.30); }
          100% {
            transform: translate3d(var(--dx, 10vw), var(--dy, 120vh), 0) rotate(var(--rot-end, 420deg)) scale(var(--scale, 1));
            opacity: 0;
          }
        }
        @keyframes orilonWindDebrisCross {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rot-start, 0deg));
            opacity: var(--opacity-start, 0.42);
          }
          100% {
            transform: translate3d(112vw, var(--dy, 0px), 0) rotate(var(--rot-end, 1080deg));
            opacity: 0;
          }
        }
        #orilon-weather-ashfall-overlay {
          contain: layout paint style;
          isolation: isolate;
        }
        #orilon-weather-ashfall-particle-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          contain: layout paint style;
        }
        .orilon-ashfall-veil,
        .orilon-ashfall-vignette,
        .orilon-ashfall-ember-glow {
          position: absolute;
          pointer-events: none;
        }
        .orilon-ashfall-veil {
          inset: -8%;
          mix-blend-mode: multiply;
          will-change: transform, opacity;
          animation: orilonAshfallVeilDrift 20s ease-in-out infinite alternate;
        }
        .orilon-ashfall-vignette,
        .orilon-ashfall-ember-glow {
          inset: 0;
        }
        .orilon-ashfall-overlay.standard .orilon-ashfall-veil {
          background:
            radial-gradient(ellipse at 50% 32%, rgba(108,102,94,0.11), transparent 55%),
            radial-gradient(ellipse at 15% 78%, rgba(88,72,55,0.075), transparent 46%),
            radial-gradient(ellipse at 82% 66%, rgba(66,62,58,0.08), transparent 56%),
            linear-gradient(180deg, rgba(70,66,60,0.10), rgba(24,22,20,0.16));
          opacity: 0.44;
          animation-duration: 22s;
        }
        .orilon-ashfall-overlay.heavy .orilon-ashfall-veil {
          background:
            radial-gradient(ellipse at 48% 28%, rgba(92,85,76,0.16), transparent 52%),
            radial-gradient(ellipse at 18% 76%, rgba(86,68,50,0.10), transparent 48%),
            radial-gradient(ellipse at 82% 65%, rgba(58,54,49,0.12), transparent 56%),
            linear-gradient(180deg, rgba(48,45,42,0.18), rgba(16,15,14,0.28));
          opacity: 0.64;
          animation-duration: 16s;
        }
        .orilon-ashfall-overlay.standard .orilon-ashfall-vignette {
          background: radial-gradient(circle at 50% 42%, transparent 44%, rgba(24,22,20,0.13) 80%, rgba(9,8,7,0.30) 100%);
          mix-blend-mode: multiply;
          opacity: 0.78;
        }
        .orilon-ashfall-overlay.heavy .orilon-ashfall-vignette {
          background: radial-gradient(circle at 50% 42%, transparent 38%, rgba(19,17,15,0.22) 76%, rgba(8,7,6,0.46) 100%);
          mix-blend-mode: multiply;
          opacity: 0.90;
        }
        .orilon-ashfall-overlay.standard .orilon-ashfall-ember-glow {
          background: radial-gradient(circle at 78% 72%, rgba(190,84,32,0.035), transparent 30%);
          mix-blend-mode: screen;
          opacity: 0.32;
        }
        .orilon-ashfall-overlay.heavy .orilon-ashfall-ember-glow {
          background: radial-gradient(circle at 76% 70%, rgba(190,84,32,0.075), transparent 34%), radial-gradient(circle at 28% 82%, rgba(180,76,28,0.040), transparent 28%);
          mix-blend-mode: screen;
          opacity: 0.52;
        }
        .orilon-ash-particle {
          position: absolute;
          left: var(--x, 50vw);
          top: var(--y, -8vh);
          width: var(--size, 4px);
          height: var(--size, 4px);
          border-radius: 50%;
          background: var(--color, #807970);
          box-shadow: var(--shadow, 0 0 4px rgba(0,0,0,0.30));
          filter: var(--blur, none);
          pointer-events: none;
          will-change: transform, opacity;
          transform: translate3d(0,0,0);
          animation: orilonAshParticleFall var(--duration, 8000ms) linear forwards;
        }
        .orilon-wind-particle {
          position: fixed;
          left: -4vw;
          top: var(--y, 50vh);
          width: var(--w, 9px);
          height: var(--h, 5px);
          border-radius: 80% 20% 80% 20%;
          background: var(--color, #6f7f39);
          box-shadow: 0 0 5px rgba(0,0,0,0.45);
          pointer-events: none;
          will-change: transform, opacity;
          transform: translate3d(0,0,0);
          animation: orilonWindDebrisCross var(--duration, 3200ms) linear forwards;
        }
      `;
      document.head.appendChild(style);
      return style;
    }

    function getAshfallOverlay() {
      return document.getElementById("orilon-weather-ashfall-overlay");
    }

    function getAshfallParticleLayer() {
      return document.getElementById("orilon-weather-ashfall-particle-layer");
    }

    function startAshfallScreenOverlay(targetScene, preset) {
      if (!weatherScreenOverlayEnabled) return;
      if (!preset || !["ashfall", "heavyAshfall"].includes(preset.id)) return;
      if (RUNTIME.activeSceneId && RUNTIME.activeSceneId !== targetScene.id) return;

      ensureAshfallOverlayStyle();

      const isHeavy = preset.id === "heavyAshfall";
      let overlay = getAshfallOverlay();

      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "orilon-weather-ashfall-overlay";
        overlay.className = "orilon-weather-local-fx orilon-ashfall-overlay";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "40";
        overlay.style.overflow = "hidden";
        overlay.style.opacity = "1";
        overlay.style.mixBlendMode = "normal";

        const veil = document.createElement("div");
        veil.className = "orilon-weather-local-fx orilon-ashfall-veil";

        const vignette = document.createElement("div");
        vignette.className = "orilon-weather-local-fx orilon-ashfall-vignette";

        const emberGlow = document.createElement("div");
        emberGlow.className = "orilon-weather-local-fx orilon-ashfall-ember-glow";

        const particleLayer = document.createElement("div");
        particleLayer.id = "orilon-weather-ashfall-particle-layer";
        particleLayer.className = "orilon-weather-local-fx orilon-ashfall-particle-layer";

        overlay.appendChild(veil);
        overlay.appendChild(vignette);
        overlay.appendChild(emberGlow);
        overlay.appendChild(particleLayer);
        document.body.appendChild(overlay);
      }

      overlay.classList.toggle("heavy", isHeavy);
      overlay.classList.toggle("standard", !isHeavy);
      overlay.dataset.weatherId = preset.id;
    }

    function cleanupParticleElement(particle, isAshParticle) {
      if (!particle?.isConnected) return;
      particle.remove();
      if (isAshParticle) RUNTIME.activeAshParticles = Math.max(0, Number(RUNTIME.activeAshParticles || 0) - 1);
    }

    function buildAshParticle(profile = {}) {
      const colors = profile.colors || ["#9a9288", "#807970", "#6f6962", "#56514b", "#b07845", "#cf7a34"];
      const isHeavyAsh = profile.type === "heavyAshfall";
      const isEmber = Math.random() < (isHeavyAsh ? 0.16 : 0.08);

      const baseSize = randomInt(isHeavyAsh ? 3 : 2, isHeavyAsh ? 9 : 7);
      const duration = randomInt(profile.speedMin ?? 5600, profile.speedMax ?? 10200);
      const depthRoll = Math.random();
      const depth = isEmber ? "ember" : depthRoll < 0.28 ? "far" : depthRoll < 0.82 ? "mid" : "near";
      const depthScale = depth === "far" ? 0.58 : depth === "near" ? 1.46 : 1;
      const travelDuration = Math.round(duration * (depth === "far" ? 1.36 : depth === "near" ? 0.78 : 1));
      const particleSize = Math.max(1, Math.round(baseSize * depthScale));

      const baseOpacity = isEmber
        ? (Math.random() * 0.38 + 0.34)
        : (isHeavyAsh ? (Math.random() * 0.42 + 0.28) : (Math.random() * 0.36 + 0.22));
      const opacityMultiplier = depth === "far" ? 0.52 : depth === "near" ? 1.18 : 1;
      const finalOpacity = Math.min(0.86, baseOpacity * opacityMultiplier);

      const startX = randomInt(-8, 108);
      const startY = randomInt(-20, 5);
      const fallDistance = randomInt(104, 136);
      const sidePush = randomInt(isHeavyAsh ? -20 : -14, isHeavyAsh ? 30 : 22);
      const rotateEnd = randomInt(80, isHeavyAsh ? 820 : 620);
      const blur = depth === "far" ? "blur(0.8px)" : depth === "near" ? "blur(0.15px)" : "blur(0.35px)";

      const particle = document.createElement("span");
      particle.className = `orilon-weather-local-fx orilon-ash-particle ${isEmber ? "ember" : depth}`;
      particle.style.setProperty("--x", `${startX}vw`);
      particle.style.setProperty("--y", `${startY}vh`);
      particle.style.setProperty("--dx", `${sidePush}vw`);
      particle.style.setProperty("--dy", `${fallDistance}vh`);
      particle.style.setProperty("--size", `${particleSize}px`);
      particle.style.setProperty("--scale", String(depthScale));
      particle.style.setProperty("--duration", `${travelDuration}ms`);
      particle.style.setProperty("--opacity-start", String(finalOpacity));
      particle.style.setProperty("--opacity-mid", String(Math.max(0.08, finalOpacity * 0.55)));
      particle.style.setProperty("--rot-start", `${randomInt(0, 360)}deg`);
      particle.style.setProperty("--rot-end", `${rotateEnd}deg`);
      particle.style.setProperty("--blur", blur);
      particle.style.zIndex = depth === "near" || isEmber ? "44" : depth === "far" ? "42" : "43";

      if (isEmber) {
        particle.style.setProperty("--color", ["#d8792f", "#f0a24c", "#b85327"][randomInt(0, 2)]);
        particle.style.setProperty("--shadow", "0 0 11px rgba(232,112,40,0.66)");
      } else {
        particle.style.setProperty("--color", colors[randomInt(0, colors.length - 1)]);
        particle.style.setProperty("--shadow", depth === "near" ? "0 0 6px rgba(0,0,0,0.44)" : "0 0 4px rgba(0,0,0,0.30)");
      }

      RUNTIME.activeAshParticles = Number(RUNTIME.activeAshParticles || 0) + 1;
      particle.addEventListener("animationend", () => cleanupParticleElement(particle, true), { once: true });
      runtimeTimeout(() => cleanupParticleElement(particle, true), travelDuration + 500);
      return particle;
    }

    function spawnAshParticles(profile = {}, count = 1) {
      const layer = getAshfallParticleLayer();
      if (!layer) return;

      const maxActive = Number(profile.maxActiveParticles ?? (profile.type === "heavyAshfall" ? 130 : 90));
      const fragment = document.createDocumentFragment();
      let created = 0;

      for (let i = 0; i < count; i++) {
        if (Number(RUNTIME.activeAshParticles || 0) >= maxActive) break;
        fragment.appendChild(buildAshParticle(profile));
        created += 1;
      }

      if (created) layer.appendChild(fragment);
    }



    function ensureColdWeatherOverlayStyle() {
      let style = document.getElementById("orilon-weather-cold-overlay-style");
      if (style) return style;

      style = document.createElement("style");
      style.id = "orilon-weather-cold-overlay-style";
      style.className = "orilon-weather-local-fx";
      style.textContent = `
        @keyframes orilonBlizzardVeilPulse {
          0% { transform: translate3d(-1.0%, -0.6%, 0) scale(1.04); opacity: 0.72; }
          50% { transform: translate3d(1.2%, 0.4%, 0) scale(1.07); opacity: 0.96; }
          100% { transform: translate3d(2.0%, -0.2%, 0) scale(1.05); opacity: 0.82; }
        }
        @keyframes orilonBlizzardSnowStreak {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--angle, -14deg)) scaleX(var(--scale-x, 1));
            opacity: 0;
          }
          12% { opacity: var(--opacity-start, 0.62); }
          80% { opacity: var(--opacity-mid, 0.38); }
          100% {
            transform: translate3d(var(--dx, 62vw), var(--dy, 24vh), 0) rotate(var(--angle, -14deg)) scaleX(var(--scale-x, 1));
            opacity: 0;
          }
        }
        #orilon-weather-cold-overlay {
          contain: layout paint style;
          isolation: isolate;
        }
        #orilon-weather-blizzard-particle-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          contain: layout paint style;
        }
        .orilon-blizzard-whiteout,
        .orilon-blizzard-vignette,
        .orilon-blizzard-cold-glare {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .orilon-blizzard-whiteout {
          inset: -10%;
          background:
            radial-gradient(ellipse at 46% 34%, rgba(235,242,247,0.24), transparent 50%),
            radial-gradient(ellipse at 18% 76%, rgba(176,190,202,0.15), transparent 48%),
            radial-gradient(ellipse at 86% 56%, rgba(217,228,236,0.16), transparent 48%),
            linear-gradient(180deg, rgba(185,198,208,0.18), rgba(56,64,72,0.24));
          mix-blend-mode: screen;
          animation: orilonBlizzardVeilPulse 7.5s ease-in-out infinite alternate;
          will-change: transform, opacity;
          opacity: 0.80;
        }
        .orilon-blizzard-vignette {
          background: radial-gradient(circle at 50% 42%, transparent 30%, rgba(92,105,116,0.20) 70%, rgba(21,27,32,0.52) 100%);
          mix-blend-mode: multiply;
          opacity: 0.76;
        }
        .orilon-blizzard-cold-glare {
          background:
            linear-gradient(90deg, rgba(245,250,255,0.08), transparent 18%, transparent 82%, rgba(245,250,255,0.08)),
            radial-gradient(circle at 52% 44%, rgba(245,250,255,0.06), transparent 38%);
          mix-blend-mode: screen;
          opacity: 0.62;
        }
        .orilon-blizzard-streak {
          position: absolute;
          left: var(--x, -8vw);
          top: var(--y, 50vh);
          width: var(--w, 52px);
          height: var(--h, 2px);
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, var(--color, rgba(236,244,249,0.72)), transparent);
          filter: var(--blur, blur(0.25px));
          box-shadow: 0 0 8px rgba(225,240,255,0.22);
          pointer-events: none;
          will-change: transform, opacity;
          animation-name: orilonBlizzardSnowStreak;
          animation-duration: var(--duration, 1400ms);
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `;

      document.head.appendChild(style);
      return style;
    }

    function getColdWeatherOverlay() {
      return document.getElementById("orilon-weather-cold-overlay");
    }

    function getBlizzardParticleLayer() {
      return document.getElementById("orilon-weather-blizzard-particle-layer");
    }

    function startColdWeatherOverlay(targetScene, preset) {
      if (!weatherScreenOverlayEnabled) return;
      if (!preset || preset.id !== "blizzard") return;
      if (RUNTIME.activeSceneId && RUNTIME.activeSceneId !== targetScene.id) return;

      ensureColdWeatherOverlayStyle();

      let overlay = getColdWeatherOverlay();
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "orilon-weather-cold-overlay";
        overlay.className = "orilon-weather-local-fx orilon-cold-overlay blizzard";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "41";
        overlay.style.overflow = "hidden";
        overlay.style.opacity = "1";
        overlay.style.mixBlendMode = "normal";

        const whiteout = document.createElement("div");
        whiteout.className = "orilon-weather-local-fx orilon-blizzard-whiteout";

        const vignette = document.createElement("div");
        vignette.className = "orilon-weather-local-fx orilon-blizzard-vignette";

        const glare = document.createElement("div");
        glare.className = "orilon-weather-local-fx orilon-blizzard-cold-glare";

        const particleLayer = document.createElement("div");
        particleLayer.id = "orilon-weather-blizzard-particle-layer";
        particleLayer.className = "orilon-weather-local-fx orilon-blizzard-particle-layer";

        overlay.appendChild(whiteout);
        overlay.appendChild(vignette);
        overlay.appendChild(glare);
        overlay.appendChild(particleLayer);
        document.body.appendChild(overlay);
      }

      overlay.dataset.weatherId = preset.id;
    }

    function ensureAtmosphereOverlayStyle() {
      let style = document.getElementById("orilon-weather-atmosphere-overlay-style");
      if (style) return style;

      style = document.createElement("style");
      style.id = "orilon-weather-atmosphere-overlay-style";
      style.className = "orilon-weather-local-fx";
      style.textContent = `
        @keyframes orilonHeatwaveShimmerDrift {
          0% { transform: translate3d(-2%, 0, 0) skewX(-1.2deg); opacity: 0.38; }
          50% { transform: translate3d(1.5%, -0.6%, 0) skewX(1.4deg); opacity: 0.58; }
          100% { transform: translate3d(2.2%, 0.4%, 0) skewX(-0.7deg); opacity: 0.44; }
        }
        @keyframes orilonHeatwaveGlarePulse {
          0% { opacity: 0.28; transform: scale(1.01); }
          100% { opacity: 0.46; transform: scale(1.035); }
        }
        #orilon-weather-atmosphere-overlay {
          contain: layout paint style;
          isolation: isolate;
        }
        .orilon-atmosphere-heat-veil,
        .orilon-atmosphere-heat-glare,
        .orilon-atmosphere-heat-vignette {
          position: absolute;
          pointer-events: none;
        }
        .orilon-atmosphere-heat-veil {
          inset: -8%;
          background:
            radial-gradient(ellipse at 50% 30%, rgba(220,164,86,0.10), transparent 54%),
            radial-gradient(ellipse at 20% 75%, rgba(170,112,56,0.060), transparent 44%),
            linear-gradient(180deg, rgba(160,105,45,0.065), rgba(68,40,20,0.075));
          mix-blend-mode: screen;
          will-change: transform, opacity;
          animation: orilonHeatwaveShimmerDrift 8.5s ease-in-out infinite alternate;
        }
        .orilon-atmosphere-heat-glare {
          inset: 0;
          background:
            linear-gradient(90deg, transparent 0%, rgba(244,191,106,0.040) 22%, transparent 34%, rgba(244,191,106,0.035) 62%, transparent 78%),
            radial-gradient(circle at 52% 34%, rgba(255,214,130,0.09), transparent 36%);
          mix-blend-mode: screen;
          will-change: transform, opacity;
          animation: orilonHeatwaveGlarePulse 5.5s ease-in-out infinite alternate;
        }
        .orilon-atmosphere-heat-vignette {
          inset: 0;
          background: radial-gradient(circle at 50% 44%, transparent 48%, rgba(94,50,20,0.060) 82%, rgba(35,20,12,0.13) 100%);
          mix-blend-mode: multiply;
          opacity: 0.70;
        }
      `;
      document.head.appendChild(style);
      return style;
    }

    function getAtmosphereOverlay() {
      return document.getElementById("orilon-weather-atmosphere-overlay");
    }

    function startAtmosphereScreenOverlay(targetScene, preset) {
      if (!weatherScreenOverlayEnabled) return;
      if (!preset || preset.id !== "heatwave") return;
      if (RUNTIME.activeSceneId && RUNTIME.activeSceneId !== targetScene.id) return;

      ensureAtmosphereOverlayStyle();

      let overlay = getAtmosphereOverlay();
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "orilon-weather-atmosphere-overlay";
        overlay.className = "orilon-weather-local-fx orilon-atmosphere-overlay heatwave";
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "39";
        overlay.style.overflow = "hidden";
        overlay.style.opacity = "1";
        overlay.style.mixBlendMode = "normal";

        const veil = document.createElement("div");
        veil.className = "orilon-weather-local-fx orilon-atmosphere-heat-veil";

        const glare = document.createElement("div");
        glare.className = "orilon-weather-local-fx orilon-atmosphere-heat-glare";

        const vignette = document.createElement("div");
        vignette.className = "orilon-weather-local-fx orilon-atmosphere-heat-vignette";

        overlay.appendChild(veil);
        overlay.appendChild(glare);
        overlay.appendChild(vignette);
        document.body.appendChild(overlay);
      }

      overlay.dataset.weatherId = preset.id;
    }

    function startWeatherScreenOverlay(targetScene, preset) {
      startAshfallScreenOverlay(targetScene, preset);
      startColdWeatherOverlay(targetScene, preset);
      startAtmosphereScreenOverlay(targetScene, preset);
    }

    async function restartCurrentLocalWeatherRuntime(targetScene = scene) {
      const state = currentWeatherState(targetScene);
      const preset = WEATHER_PRESETS[state?.id];

      clearRuntimeTimers();

      if (!preset || preset.id === "clear") return false;

      if (preset.useLightning && stormLightningEnabled && atmosphereLightingEnabled) {
        await startStormLightning(targetScene, preset);
        return true;
      }

      if (preset.localWindDebris && galeDebrisEnabled) {
        RUNTIME.activeSceneId = targetScene.id;
        RUNTIME.activeMode = `local-${preset.id}`;
        startLocalWeatherDebris(targetScene, preset);
        return true;
      }

      if (weatherScreenOverlayEnabled) {
        RUNTIME.activeSceneId = targetScene.id;
        RUNTIME.activeMode = `overlay-${preset.id}`;
        startWeatherScreenOverlay(targetScene, preset);
        return true;
      }

      return false;
    }

    function cleanupBlizzardParticleElement(particle) {
      if (!particle?.isConnected) return;
      particle.remove();
      RUNTIME.activeBlizzardParticles = Math.max(0, Number(RUNTIME.activeBlizzardParticles || 0) - 1);
    }

    function buildBlizzardParticle(profile = {}) {
      const colors = profile.colors || ["#edf4f8", "#dce7ed", "#c9d5dd", "#f7fbff"];
      const duration = randomInt(profile.speedMin ?? 780, profile.speedMax ?? 2100);
      const depthRoll = Math.random();
      const depth = depthRoll < 0.24 ? "far" : depthRoll < 0.78 ? "mid" : "near";
      const width = randomInt(depth === "near" ? 44 : 24, depth === "near" ? 104 : 76);
      const height = depth === "far" ? 1 : depth === "near" ? randomInt(2, 4) : 2;
      const opacity = depth === "far" ? (Math.random() * 0.22 + 0.18) : depth === "near" ? (Math.random() * 0.40 + 0.46) : (Math.random() * 0.32 + 0.32);
      const travelDuration = Math.round(duration * (depth === "far" ? 1.28 : depth === "near" ? 0.78 : 1));

      const particle = document.createElement("span");
      particle.className = `orilon-weather-local-fx orilon-blizzard-streak ${depth}`;
      particle.style.setProperty("--x", `${randomInt(-18, 102)}vw`);
      particle.style.setProperty("--y", `${randomInt(-6, 102)}vh`);
      particle.style.setProperty("--dx", `${randomInt(42, 92)}vw`);
      particle.style.setProperty("--dy", `${randomInt(10, 38)}vh`);
      particle.style.setProperty("--w", `${width}px`);
      particle.style.setProperty("--h", `${height}px`);
      particle.style.setProperty("--duration", `${travelDuration}ms`);
      particle.style.setProperty("--opacity-start", String(opacity));
      particle.style.setProperty("--opacity-mid", String(Math.max(0.10, opacity * 0.66)));
      particle.style.setProperty("--angle", `${randomInt(-18, -8)}deg`);
      particle.style.setProperty("--scale-x", String(depth === "near" ? 1.35 : depth === "far" ? 0.78 : 1));
      particle.style.setProperty("--color", colors[randomInt(0, colors.length - 1)]);
      particle.style.setProperty("--blur", depth === "far" ? "blur(0.8px)" : depth === "near" ? "blur(0.15px)" : "blur(0.35px)");
      particle.style.zIndex = depth === "near" ? "46" : depth === "far" ? "44" : "45";

      RUNTIME.activeBlizzardParticles = Number(RUNTIME.activeBlizzardParticles || 0) + 1;
      particle.addEventListener("animationend", () => cleanupBlizzardParticleElement(particle), { once: true });
      runtimeTimeout(() => cleanupBlizzardParticleElement(particle), travelDuration + 350);
      return particle;
    }

    function spawnBlizzardParticles(profile = {}, count = 1) {
      const layer = getBlizzardParticleLayer();
      if (!layer) return;

      const maxActive = Number(profile.maxActiveParticles ?? 160);
      const fragment = document.createDocumentFragment();
      let created = 0;

      for (let i = 0; i < count; i++) {
        if (Number(RUNTIME.activeBlizzardParticles || 0) >= maxActive) break;
        fragment.appendChild(buildBlizzardParticle(profile));
        created += 1;
      }

      if (created) layer.appendChild(fragment);
    }
    function spawnWindParticle(profile = {}) {
      ensureAshfallOverlayStyle();

      const colors = profile.colors || ["#6f7f39", "#8a6d36", "#4f6330", "#9a8147", "#5b4a2c", "#3f5428"];
      const size = randomInt(5, 13);
      const duration = randomInt(profile.speedMin ?? 1800, profile.speedMax ?? 4200);
      const particle = document.createElement("span");

      particle.className = "orilon-weather-local-fx orilon-wind-particle";
      particle.style.setProperty("--y", `${randomInt(8, 92)}vh`);
      particle.style.setProperty("--dy", `${randomInt(-80, 80)}px`);
      particle.style.setProperty("--duration", `${duration}ms`);
      particle.style.setProperty("--w", `${size}px`);
      particle.style.setProperty("--h", `${Math.max(3, Math.floor(size * 0.55))}px`);
      particle.style.setProperty("--color", colors[randomInt(0, colors.length - 1)]);
      particle.style.setProperty("--opacity-start", String(Math.random() * 0.35 + 0.35));
      particle.style.setProperty("--rot-start", `${randomInt(0, 360)}deg`);
      particle.style.setProperty("--rot-end", `${randomInt(540, 1680)}deg`);
      particle.style.zIndex = "43";

      particle.addEventListener("animationend", () => cleanupParticleElement(particle, false), { once: true });
      document.body.appendChild(particle);
      runtimeTimeout(() => cleanupParticleElement(particle, false), duration + 300);
    }

    function spawnWeatherDebris(profile = {}) {
      const isAsh = profile.type === "ash" || profile.type === "ashfall" || profile.type === "heavyAshfall";
      if (isAsh) {
        spawnAshParticles(profile, 1);
        return;
      }

      if (profile.type === "blizzard") {
        spawnBlizzardParticles(profile, 1);
        return;
      }

      spawnWindParticle(profile);
    }

    function startLocalWeatherDebris(targetScene, preset) {
      const profile = preset?.localWindDebris || (preset?.id === "galeHurricane" ? {
        enabled: true,
        type: "leaves",
        intervalMs: 520,
        minBurst: 2,
        maxBurst: 5,
        speedMin: 1800,
        speedMax: 4200,
        colors: ["#6f7f39", "#8a6d36", "#4f6330", "#9a8147", "#5b4a2c", "#3f5428"]
      } : null);

      startWeatherScreenOverlay(targetScene, preset);

      if (!galeDebrisEnabled || !profile?.enabled) return;

      runtimeInterval(() => {
        if (RUNTIME.activeSceneId !== targetScene.id) return;

        const burst = randomInt(profile.minBurst ?? 1, profile.maxBurst ?? 3);
        const isAsh = profile.type === "ash" || profile.type === "ashfall" || profile.type === "heavyAshfall";
        const isBlizzard = profile.type === "blizzard";

        if (isAsh) {
          spawnAshParticles(profile, burst);
          return;
        }

        if (isBlizzard) {
          spawnBlizzardParticles(profile, burst);
          return;
        }

        for (let i = 0; i < burst; i++) {
          runtimeTimeout(() => spawnWeatherDebris(profile), randomInt(0, 320));
        }
      }, profile.intervalMs ?? 700);
    }

    async function startStormLightning(targetScene, preset) {
      clearRuntimeTimers();
      if (!preset?.lightning) return;

      RUNTIME.activeSceneId = targetScene.id;
      RUNTIME.activeMode = "storm-lightning";

      await setSceneDarkness(targetScene, preset.lightning.baseDarkness ?? preset.atmosphereDarkness ?? 0.30);

      startLocalWeatherDebris(targetScene, preset);

      runtimeTimeout(() => {
        scheduleNextLightning(targetScene, preset.lightning);
      }, randomInt(2200, 5200));
    }


    function collectSceneWeatherEffectActors(targetScene = scene) {
      const tokens = Array.from(targetScene?.tokens?.contents || targetScene?.tokens || []);
      const actors = [];
      const seen = new Set();

      for (const tokenDoc of tokens) {
        const actor = tokenDoc?.actor || (tokenDoc?.actorId ? game.actors?.get(tokenDoc.actorId) : null);
        if (!actor?.createEmbeddedDocuments || !actor?.deleteEmbeddedDocuments) continue;

        // Weather should affect creatures in the scene, not loot piles, journal actors, or helper documents.
        if (actor.type && !["character", "npc"].includes(String(actor.type))) continue;

        const key = actor.uuid || actor.id || tokenDoc.id;
        if (seen.has(key)) continue;
        seen.add(key);
        actors.push(actor);
      }

      return actors;
    }

    function collectActorsWithOrilonWeatherEffects(targetScene = scene) {
      const actors = collectSceneWeatherEffectActors(targetScene);
      const seen = new Set(actors.map(actor => actor.uuid || actor.id));

      for (const actor of Array.from(game.actors?.contents || [])) {
        const hasWeatherEffect = Array.from(actor.effects || []).some(effect => {
          try { return effect.getFlag(FLAG_SCOPE, WEATHER_EFFECT_FLAG) === true; }
          catch (_err) { return false; }
        });

        if (!hasWeatherEffect) continue;

        const key = actor.uuid || actor.id;
        if (seen.has(key)) continue;
        seen.add(key);
        actors.push(actor);
      }

      return actors;
    }

    function orilonWeatherEffectIds(actor) {
      return Array.from(actor?.effects || [])
        .filter(effect => {
          try { return effect.getFlag(FLAG_SCOPE, WEATHER_EFFECT_FLAG) === true; }
          catch (_err) { return false; }
        })
        .map(effect => effect.id)
        .filter(Boolean);
    }

    async function clearWeatherActiveEffects(targetScene = scene, options = {}) {
      const includePriorActors = options.includePriorActors ?? true;
      const actors = includePriorActors
        ? collectActorsWithOrilonWeatherEffects(targetScene)
        : collectSceneWeatherEffectActors(targetScene);

      let removed = 0;

      for (const actor of actors) {
        const ids = orilonWeatherEffectIds(actor);
        if (!ids.length) continue;

        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
          removed += ids.length;
        } catch (err) {
          console.warn(`ORILON Weather: could not remove weather effect from ${actor.name}.`, err);
        }
      }

      return removed;
    }

    function buildWeatherActiveEffectData(preset) {
      const profile = WEATHER_CHARACTER_EFFECT_PROFILES[preset?.id];
      if (!profile) return null;

      const penalty = Number(profile.penalty || 0);
      const penaltyText = penalty > 0 ? `+${penalty}` : String(penalty);

      return {
        name: `Orilon Weather — ${profile.label}`,
        img: "icons/svg/aura.svg",
        disabled: false,
        description: `
          <p><strong>${escapeHtml(profile.visibility)}</strong></p>
          <p>${escapeHtml(profile.description)}</p>
          <p>Mechanical effect: ${escapeHtml(penaltyText)} to Perception checks and passive Perception while this weather is active.</p>
          <p>Token vision layer: ${escapeHtml(weatherTokenVisionSummaryForPreset(preset))}.</p>
        `,
        changes: [
          {
            key: "system.skills.prc.bonuses.check",
            mode: ACTIVE_EFFECT_MODE_ADD,
            value: penaltyText,
            priority: 20
          },
          {
            key: "system.skills.prc.bonuses.passive",
            mode: ACTIVE_EFFECT_MODE_ADD,
            value: penaltyText,
            priority: 20
          }
        ],
        flags: {
          [FLAG_SCOPE]: {
            [WEATHER_EFFECT_FLAG]: true,
            [WEATHER_EFFECT_SOURCE_FLAG]: "Weather Control",
            weatherId: preset.id,
            weatherLabel: preset.label,
            sceneId: scene.id,
            sceneName: scene.name,
            appliedAt: Date.now(),
            perceptionPenalty: penalty
          }
        }
      };
    }

    function weatherEffectSummaryForPreset(preset) {
      const profile = WEATHER_CHARACTER_EFFECT_PROFILES[preset?.id];
      if (!profile) return "None";
      const penalty = Number(profile.penalty || 0);
      const penaltyText = penalty > 0 ? `+${penalty}` : String(penalty);
      return `${profile.visibility}; ${penaltyText} Perception; ${weatherTokenVisionSummaryForPreset(preset)}`;
    }

    function currentOrilonWeatherEffectCount(targetScene = scene) {
      let count = 0;
      for (const actor of collectActorsWithOrilonWeatherEffects(targetScene)) {
        count += orilonWeatherEffectIds(actor).length;
      }
      return count;
    }

    async function applyWeatherActiveEffects(targetScene, preset) {
      const effectData = buildWeatherActiveEffectData(preset);
      if (!effectData) return 0;

      const actors = collectSceneWeatherEffectActors(targetScene);
      let applied = 0;

      for (const actor of actors) {
        try {
          const existing = orilonWeatherEffectIds(actor);
          if (existing.length) await actor.deleteEmbeddedDocuments("ActiveEffect", existing);

          await actor.createEmbeddedDocuments("ActiveEffect", [foundry.utils.deepClone(effectData)]);
          applied += 1;
        } catch (err) {
          console.warn(`ORILON Weather: could not apply weather effect to ${actor.name}.`, err);
        }
      }

      if (applied) {
        ui.notifications.info(`Weather character effect applied to ${applied} actor(s).`);
      }

      return applied;
    }


    function collectSceneWeatherEffectTokens(targetScene = scene) {
      const tokens = Array.from(targetScene?.tokens?.contents || targetScene?.tokens || []);
      return tokens.filter(tokenDoc => {
        const actor = tokenDoc?.actor || (tokenDoc?.actorId ? game.actors?.get(tokenDoc.actorId) : null);
        if (!actor) return false;
        if (actor.type && !["character", "npc"].includes(String(actor.type))) return false;
        return true;
      });
    }

    function tokenHasSightEnabled(tokenDoc) {
      const sight = tokenDoc?.sight || {};
      return Boolean(sight.enabled ?? foundry.utils.getProperty(tokenDoc, "sight.enabled"));
    }

    function tokenSightRange(tokenDoc) {
      const value = tokenDoc?.sight?.range ?? foundry.utils.getProperty(tokenDoc, "sight.range") ?? 0;
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    }

    function weatherTokenVisionSummaryForPreset(preset) {
      const profile = WEATHER_CHARACTER_EFFECT_PROFILES[preset?.id];
      if (!profile) return "No token sight change";

      const multiplier = Math.round(Number(profile.visionMultiplier ?? 1) * 100);
      const cap = Number(profile.visionCap ?? 0);
      const min = Number(profile.visionMinimum ?? 0);
      return `Sight ${multiplier}%${cap ? `, max ${cap} ft` : ""}${min ? `, min ${min} ft` : ""}`;
    }

    function calculateWeatherSightRange(originalRange, preset) {
      const profile = WEATHER_CHARACTER_EFFECT_PROFILES[preset?.id];
      if (!profile) return null;

      const multiplier = Number(profile.visionMultiplier ?? 1);
      const cap = Number(profile.visionCap ?? 0);
      const minimum = Number(profile.visionMinimum ?? 5);
      const original = Number(originalRange ?? 0);

      let reduced;
      if (!Number.isFinite(original) || original <= 0) {
        // In many Foundry setups, 0 is used as unlimited/default. While weather is active,
        // convert that into the weather cap, then restore the original 0 when weather clears.
        reduced = cap || 60;
      } else {
        reduced = original * multiplier;
        if (cap > 0) reduced = Math.min(reduced, cap);
      }

      if (minimum > 0) reduced = Math.max(reduced, minimum);
      return Math.max(0, Math.round(reduced));
    }

    function currentOrilonWeatherTokenVisionCount(targetScene = scene) {
      let count = 0;
      for (const tokenDoc of Array.from(targetScene?.tokens?.contents || targetScene?.tokens || [])) {
        try {
          if (tokenDoc.getFlag(FLAG_SCOPE, WEATHER_TOKEN_VISION_FLAG)) count += 1;
        } catch (_err) {}
      }
      return count;
    }

    async function clearWeatherTokenVision(targetScene = scene) {
      const tokens = Array.from(targetScene?.tokens?.contents || targetScene?.tokens || []);
      let restored = 0;

      for (const tokenDoc of tokens) {
        let stored = null;
        try { stored = tokenDoc.getFlag(FLAG_SCOPE, WEATHER_TOKEN_VISION_FLAG); }
        catch (_err) { stored = null; }

        if (!stored) continue;

        const updateData = {};
        if (Object.prototype.hasOwnProperty.call(stored, "originalSightRange")) {
          updateData["sight.range"] = Number(stored.originalSightRange ?? 0);
        }
        if (Object.prototype.hasOwnProperty.call(stored, "originalSightEnabled")) {
          updateData["sight.enabled"] = Boolean(stored.originalSightEnabled);
        }

        try {
          if (Object.keys(updateData).length) await tokenDoc.update(updateData);
          await tokenDoc.unsetFlag(FLAG_SCOPE, WEATHER_TOKEN_VISION_FLAG);
          restored += 1;
        } catch (err) {
          console.warn(`ORILON Weather: could not restore token vision for ${tokenDoc.name}.`, err);
        }
      }

      return restored;
    }

    async function applyWeatherTokenVision(targetScene, preset) {
      const profile = WEATHER_CHARACTER_EFFECT_PROFILES[preset?.id];
      if (!profile) return 0;

      const tokens = collectSceneWeatherEffectTokens(targetScene);
      let applied = 0;

      for (const tokenDoc of tokens) {
        if (!tokenHasSightEnabled(tokenDoc)) continue;

        let existing = null;
        try { existing = tokenDoc.getFlag(FLAG_SCOPE, WEATHER_TOKEN_VISION_FLAG); }
        catch (_err) { existing = null; }

        const originalSightRange = existing?.originalSightRange ?? tokenSightRange(tokenDoc);
        const originalSightEnabled = existing?.originalSightEnabled ?? tokenHasSightEnabled(tokenDoc);
        const newRange = calculateWeatherSightRange(originalSightRange, preset);
        if (newRange === null) continue;

        try {
          await tokenDoc.setFlag(FLAG_SCOPE, WEATHER_TOKEN_VISION_FLAG, {
            [WEATHER_TOKEN_VISION_SOURCE_FLAG]: "Weather Control",
            weatherId: preset.id,
            weatherLabel: preset.label,
            sceneId: targetScene.id,
            sceneName: targetScene.name,
            appliedAt: Date.now(),
            originalSightRange,
            originalSightEnabled,
            weatherSightRange: newRange,
            summary: weatherTokenVisionSummaryForPreset(preset)
          });
          await tokenDoc.update({ "sight.range": newRange, "sight.enabled": originalSightEnabled });
          applied += 1;
        } catch (err) {
          console.warn(`ORILON Weather: could not apply token vision weather to ${tokenDoc.name}.`, err);
        }
      }

      if (applied) {
        ui.notifications.info(`Weather token vision applied to ${applied} token(s).`);
      }

      return applied;
    }

    async function clearOrilonWeather(targetScene, options = {}) {
      const restoreDarkness = options.restoreDarkness ?? true;
      const clearSounds = options.clearSounds ?? true;
      const clearNative = options.clearNative ?? true;
      const clearRuntime = options.clearRuntime ?? true;
      const clearFx = options.clearFx ?? true;
      const clearCharacterEffects = options.clearCharacterEffects ?? true;
      const clearTokenVision = options.clearTokenVision ?? true;

      if (clearRuntime) clearRuntimeTimers();
      if (clearFx) await clearFxmasterWeather(targetScene);
      if (clearNative) await clearNativeWeather(targetScene);
      if (clearSounds) await clearSceneSfx(targetScene);
      if (clearCharacterEffects) await clearWeatherActiveEffects(targetScene, { includePriorActors: true });
      if (clearTokenVision) await clearWeatherTokenVision(targetScene);

      await targetScene.unsetFlag(FLAG_SCOPE, WEATHER_STATE_FLAG);

      if (restoreDarkness) {
        await setSceneDarkness(targetScene, 0.0);
      }
    }

    async function forceCanvasVisibility(targetScene = scene) {
      await clearOrilonWeather(targetScene, {
        restoreDarkness: true,
        clearSounds: true,
        clearNative: true,
        clearRuntime: true,
        clearFx: true,
        clearCharacterEffects: true,
        clearTokenVision: true
      });
      await redrawCanvas();
    }

    function clientRuntimeProfileForPreset(preset) {
      if (!preset) return { schema: 1, overlay: "none", particles: "none", clientRuntime: false };

      const profiles = {
        ashfall: { overlay: "ashfall-smoky-veil", particles: "ash-and-embers", intensity: "standard" },
        heavyAshfall: { overlay: "ashfall-smoky-veil", particles: "ash-and-embers", intensity: "heavy" },
        blizzard: { overlay: "blizzard-whiteout", particles: "wind-driven-snow", intensity: "severe" },
        heatwave: { overlay: "heatwave-shimmer", particles: "none", intensity: "standard" }
      };

      const profile = profiles[preset.id] || { overlay: "none", particles: preset.localWindDebris ? preset.localWindDebris.type || "local-weather" : "none", intensity: "standard" };

      return {
        schema: 1,
        boardVersion: "v47-heatwave-no-debris",
        weatherId: preset.id,
        weatherLabel: preset.label,
        clientRuntime: profile.overlay !== "none" || profile.particles !== "none",
        overlay: profile.overlay,
        particles: profile.particles,
        intensity: profile.intensity,
        screenOverlayEnabled: weatherScreenOverlayEnabled,
        localParticlesEnabled: galeDebrisEnabled
      };
    }

    async function applyWeatherPreset(targetScene, preset) {
      if (!preset) {
        ui.notifications.warn("No weather preset selected.");
        return;
      }

      if (preset.id === "clear") {
        await clearOrilonWeather(targetScene, {
          restoreDarkness: true,
          clearSounds: true,
          clearNative: true,
          clearRuntime: true,
          clearFx: true,
          clearCharacterEffects: true,
          clearTokenVision: true
        });
        await redrawCanvas();
        ui.notifications.info("Orilon weather cleared from this scene.");
        return;
      }

      await clearOrilonWeather(targetScene, {
        restoreDarkness: false,
        clearSounds: true,
        clearNative: true,
        clearRuntime: true,
        clearFx: true,
        clearCharacterEffects: true,
        clearTokenVision: true
      });

      // Give Foundry a beat to finish document deletes and FX refreshes before placing the replacement state.
      await sleep(120);
      await redrawCanvas();

      let nativeApplied = false;
      let fxResult = null;

      if (visualEngine === "fxmasterSafe") {
        fxResult = await applyFxmasterControlledWeather(targetScene, preset);
        if (!fxResult?.fxApplied) {
          nativeApplied = await applyNativeWeather(targetScene, preset.nativeWeather || "");
        }
      } else {
        nativeApplied = await applyNativeWeather(targetScene, preset.nativeWeather || "");
      }

      const atmosphereValue = atmosphereLightingEnabled
        ? Number(preset.atmosphereDarkness ?? 0)
        : 0;

      await setSceneDarkness(targetScene, atmosphereValue);

      let createdSounds = 0;
      if (sceneSfxEnabled) {
        createdSounds = await applySceneSfx(targetScene, preset);
      }

      let appliedCharacterEffects = 0;
      if (characterWeatherEffectsEnabled) {
        appliedCharacterEffects = await applyWeatherActiveEffects(targetScene, preset);
      }

      let appliedTokenVision = 0;
      if (tokenVisionWeatherEnabled) {
        appliedTokenVision = await applyWeatherTokenVision(targetScene, preset);
      }

      if (preset.useLightning && stormLightningEnabled && atmosphereLightingEnabled) {
        await startStormLightning(targetScene, preset);
      } else if (preset.localWindDebris) {
        clearRuntimeTimers();
        RUNTIME.activeSceneId = targetScene.id;
        RUNTIME.activeMode = `local-${preset.id}`;
        startLocalWeatherDebris(targetScene, preset);
      } else if (weatherScreenOverlayEnabled && clientRuntimeProfileForPreset(preset)?.overlay !== "none") {
        clearRuntimeTimers();
        RUNTIME.activeSceneId = targetScene.id;
        RUNTIME.activeMode = `overlay-${preset.id}`;
        startWeatherScreenOverlay(targetScene, preset);
      }

      await targetScene.setFlag(FLAG_SCOPE, WEATHER_STATE_FLAG, {
        id: preset.id,
        label: preset.label,
        category: preset.category,
        appliedAt: Date.now(),
        sceneId: targetScene.id,
        sceneName: targetScene.name,
        visualEngine,
        fxPreset: preset.fxPreset,
        fxResult,
        nativeWeather: preset.nativeWeather || "",
        nativeApplied,
        sceneSfxEnabled,
        soundCount: createdSounds,
        selectedSoundNames: [...selectedSoundNames],
        characterWeatherEffectsEnabled,
        characterEffectCount: appliedCharacterEffects,
        characterEffectSummary: weatherEffectSummaryForPreset(preset),
        tokenVisionWeatherEnabled,
        tokenVisionCount: appliedTokenVision,
        tokenVisionSummary: weatherTokenVisionSummaryForPreset(preset),
        clientRuntime: clientRuntimeProfileForPreset(preset),
        atmosphereLightingEnabled,
        atmosphereDarkness: atmosphereValue,
        fogIntensityMultiplier,
        stormLightningEnabled,
        lightningRuntimeActive: Boolean(preset.useLightning && stormLightningEnabled && atmosphereLightingEnabled),
        boardVersion: "v47-heatwave-no-debris"
      });

      await redrawCanvas();
      ui.notifications.info(`Orilon weather applied: ${preset.label}`);
    }

    async function syncCurrentWeatherState(targetScene = scene, options = {}) {
      const state = currentWeatherState(targetScene);
      if (!state?.id || state.id === "clear") {
        ui.notifications.info("No live Orilon weather state to sync.");
        return { synced: false, reason: "no-weather" };
      }

      const preset = WEATHER_PRESETS[state.id];
      if (!preset) {
        ui.notifications.warn(`Stored weather state is unknown: ${state.id}`);
        return { synced: false, reason: "unknown-weather" };
      }

      const rebuildSfx = options.rebuildSfx ?? true;
      const resyncCharacterEffects = options.resyncCharacterEffects ?? true;
      const resyncTokenVision = options.resyncTokenVision ?? true;
      const refreshFx = options.refreshFx ?? true;

      let createdSounds = getOrilonWeatherSounds(targetScene).length;
      let appliedCharacterEffects = currentOrilonWeatherEffectCount(targetScene);
      let appliedTokenVision = currentOrilonWeatherTokenVisionCount(targetScene);

      if (refreshFx && visualEngine === "fxmasterSafe") {
        await applyFxmasterControlledWeather(targetScene, preset);
      }

      if (atmosphereLightingEnabled) {
        await setSceneDarkness(targetScene, Number(preset.atmosphereDarkness ?? 0));
      }

      if (rebuildSfx) {
        await clearSceneSfx(targetScene);
        createdSounds = sceneSfxEnabled ? await applySceneSfx(targetScene, preset) : 0;
      }

      if (resyncCharacterEffects) {
        await clearWeatherActiveEffects(targetScene, { includePriorActors: true });
        appliedCharacterEffects = characterWeatherEffectsEnabled ? await applyWeatherActiveEffects(targetScene, preset) : 0;
      }

      if (resyncTokenVision) {
        await clearWeatherTokenVision(targetScene);
        appliedTokenVision = tokenVisionWeatherEnabled ? await applyWeatherTokenVision(targetScene, preset) : 0;
      }

      clearRuntimeTimers();
      if (preset.useLightning && stormLightningEnabled && atmosphereLightingEnabled) {
        await startStormLightning(targetScene, preset);
      } else if (preset.localWindDebris) {
        RUNTIME.activeSceneId = targetScene.id;
        RUNTIME.activeMode = `local-${preset.id}`;
        startLocalWeatherDebris(targetScene, preset);
      } else if (weatherScreenOverlayEnabled && clientRuntimeProfileForPreset(preset)?.overlay !== "none") {
        RUNTIME.activeSceneId = targetScene.id;
        RUNTIME.activeMode = `overlay-${preset.id}`;
        startWeatherScreenOverlay(targetScene, preset);
      }

      await targetScene.setFlag(FLAG_SCOPE, WEATHER_STATE_FLAG, {
        ...state,
        syncedAt: Date.now(),
        sceneSfxEnabled,
        soundCount: createdSounds,
        selectedSoundNames: [...selectedSoundNames],
        characterWeatherEffectsEnabled,
        characterEffectCount: appliedCharacterEffects,
        characterEffectSummary: weatherEffectSummaryForPreset(preset),
        tokenVisionWeatherEnabled,
        tokenVisionCount: appliedTokenVision,
        tokenVisionSummary: weatherTokenVisionSummaryForPreset(preset),
        boardVersion: "v47-heatwave-no-debris"
      });

      await redrawCanvas();
      ui.notifications.info(`Orilon weather synced: ${preset.label}`);
      return { synced: true, preset, createdSounds, appliedCharacterEffects, appliedTokenVision };
    }

    async function runWeatherTransition(label, task) {
      if (isWeatherTransitionLocked()) {
        ui.notifications.warn("Orilon weather is already changing. Please let the current transition finish.");
        return null;
      }

      RUNTIME.transitionLocked = true;
      RUNTIME.transitionMessage = label || "Updating weather...";

      try {
        return await task();
      } catch (err) {
        console.error("ORILON Weather: transition failed.", err);
        ui.notifications.error(`Orilon weather transition failed: ${err.message || err}`);
        return null;
      } finally {
        RUNTIME.transitionLocked = false;
        RUNTIME.transitionMessage = "";
      }
    }

    function formatTime(timestamp) {
      if (!timestamp) return "Never";
      try { return new Date(timestamp).toLocaleString(); }
      catch (_err) { return "Unknown"; }
    }

    function fxEffectSummary() {
      const effects = scene.getFlag("fxmaster", "effects") || {};
      const filters = scene.getFlag("fxmaster", "filters") || {};
      return `${Object.keys(effects).length} effect(s), ${Object.keys(filters).length} filter(s)`;
    }

    function statusSummaryHtml() {
      const state = currentWeatherState();
      const sfxCount = getOrilonWeatherSounds(scene).length;
      const characterEffectCount = currentOrilonWeatherEffectCount(scene);
      const tokenVisionCount = currentOrilonWeatherTokenVisionCount(scene);
      const runtimeText = RUNTIME.activeMode === "storm-lightning" ? "Storm pulses active" : (RUNTIME.activeMode || "Idle");

      return `
        <div class="orilon-live-strip">
          <div><span>Scene</span><strong>${escapeHtml(scene.name)}</strong></div>
          <div><span>Live Weather</span><strong>${escapeHtml(state?.label || "None")}</strong></div>
          <div><span>Engine</span><strong>${escapeHtml(visualEngine === "fxmasterSafe" ? "FXMaster Tuned" : "Native")}</strong></div>
          <div><span>SFX Nodes</span><strong>${sfxCount}</strong></div>
          <div><span>Character FX</span><strong>${characterEffectCount}</strong></div>
          <div><span>Token Vision</span><strong>${tokenVisionCount}</strong></div>
          <div><span>Runtime</span><strong>${escapeHtml(runtimeText)}</strong></div>
        </div>
      `;
    }

    function advancedInfoHtml() {
      const state = currentWeatherState();
      const effects = scene.getFlag("fxmaster", "effects") || {};
      const filters = scene.getFlag("fxmaster", "filters") || {};

      return `
        <style>
          .orilon-advanced-info {
            padding: 18px;
            background: radial-gradient(circle at top, rgba(95,75,38,0.22), transparent 42%),
              linear-gradient(180deg, rgba(12,12,15,0.99), rgba(5,5,8,0.99));
            color: rgba(245,240,226,0.95);
            font-family: "Cinzel", "Trajan Pro", Georgia, serif;
          }
          .orilon-advanced-info-title {
            color: rgba(232,218,184,0.98);
            font-size: 20px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          .orilon-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .orilon-info-item {
            padding: 11px;
            background: rgba(255,255,255,0.035);
            border: 1px solid rgba(225,210,170,0.13);
            border-radius: 12px;
          }
          .orilon-info-item span {
            display: block;
            color: rgba(220,220,220,0.62);
            font-family: Georgia, serif;
            font-size: 12px;
            margin-bottom: 5px;
          }
          .orilon-info-item strong, .orilon-info-item pre {
            display: block;
            color: rgba(245,240,226,0.95);
            font-size: 12px;
            line-height: 1.35;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
          }
          .orilon-info-item pre {
            max-height: 260px;
            overflow: auto;
            background: rgba(0,0,0,0.3);
            padding: 8px;
            border-radius: 8px;
          }
  </style>
        <div class="orilon-advanced-info">
          <div class="orilon-advanced-info-title">Advanced Weather Info</div>
          <div class="orilon-info-grid">
            <div class="orilon-info-item"><span>Active Scene</span><strong>${escapeHtml(scene.name)}</strong></div>
            <div class="orilon-info-item"><span>Live Orilon Weather</span><strong>${escapeHtml(state?.label || "None")}</strong></div>
            <div class="orilon-info-item"><span>Visual Engine</span><strong>${escapeHtml(visualEngine)}</strong></div>
            <div class="orilon-info-item"><span>FXMaster Available</span><strong>${fxmasterAvailable() ? "Yes" : "No"}</strong></div>
            <div class="orilon-info-item"><span>Native Weather Value</span><strong>${escapeHtml(nativeWeatherLabel(scene))}</strong></div>
            <div class="orilon-info-item"><span>Scene Darkness</span><strong>${getSceneDarkness(scene)}</strong></div>
            <div class="orilon-info-item"><span>Scene-Local SFX</span><strong>${getOrilonWeatherSounds(scene).length} sound marker(s)</strong></div>
            <div class="orilon-info-item"><span>Character Weather Effects</span><strong>${characterWeatherEffectsEnabled ? "Enabled" : "Disabled"}; ${currentOrilonWeatherEffectCount(scene)} active effect(s)</strong></div>
            <div class="orilon-info-item"><span>Token Vision Weather</span><strong>${tokenVisionWeatherEnabled ? "Enabled" : "Disabled"}; ${currentOrilonWeatherTokenVisionCount(scene)} token(s) limited</strong></div>
            <div class="orilon-info-item"><span>Runtime Mode</span><strong>${escapeHtml(RUNTIME.activeMode || "Idle")}</strong></div>
            <div class="orilon-info-item"><span>Smooth Local Lightning</span><strong>${smoothLocalLightningEnabled ? "Enabled" : "Disabled"}</strong></div>
            <div class="orilon-info-item"><span>Local Weather Particles</span><strong>${galeDebrisEnabled ? "Enabled" : "Disabled"}</strong></div>
            <div class="orilon-info-item"><span>Weather Screen Overlays</span><strong>${weatherScreenOverlayEnabled ? "Enabled" : "Disabled"}</strong></div>
            <div class="orilon-info-item"><span>Fog / Mist Intensity</span><strong>${Math.round(fogIntensityMultiplier * 100)}%</strong></div>
            <div class="orilon-info-item"><span>Last Applied</span><strong>${escapeHtml(formatTime(state?.appliedAt))}</strong></div>
            <div class="orilon-info-item"><span>Board Version</span><strong>v47 Heatwave No Debris</strong></div>
            <div class="orilon-info-item"><span>Sound Scan Status</span><pre>${escapeHtml(JSON.stringify(SOUND_SCAN_STATUS, null, 2))}</pre></div>
            <div class="orilon-info-item"><span>Sound Library</span><pre>${escapeHtml(JSON.stringify(SOUND_LIBRARY, null, 2))}</pre></div>
            <div class="orilon-info-item"><span>FXMaster Effects</span><pre>${escapeHtml(JSON.stringify(effects, null, 2))}</pre></div>
            <div class="orilon-info-item"><span>FXMaster Filters</span><pre>${escapeHtml(JSON.stringify(filters, null, 2))}</pre></div>
          </div>
        </div>
      `;
    }

    function openAdvancedInfoDialog() {
      new Dialog({
        title: "Orilon Weather — Advanced Info",
        content: advancedInfoHtml(),
        buttons: {
          refresh: { label: "Refresh", callback: () => openAdvancedInfoDialog() },
          close: { label: "Close" }
        }
      }, { width: 900, resizable: true }).render(true);
    }

    function presetButtonHtml(preset, selectedWeatherId) {
      const state = currentWeatherState();
      const isLive = state?.id === preset.id;
      const isSelected = selectedWeatherId === preset.id;

      const classes = [
        "orilon-weather-preset",
        isSelected ? "selected" : "",
        isLive ? "live" : "",
        preset.id === "clear" ? "clear" : ""
      ].join(" ");

      return `
        <button type="button" class="${classes}" data-weather-id="${escapeHtml(preset.id)}">
          <span class="orilon-weather-preset-title">${escapeHtml(preset.shortLabel || preset.label)}</span>
          ${isLive ? `<span class="orilon-preset-pill">Live</span>` : ``}
        </button>
      `;
    }

    function selectedPresetDetailsHtml(preset) {
      if (!preset) return "";

      const percent = value => `${Math.round(Number(value || 0) * 100)}%`;
      const recommended = soundChoicesForPreset(preset);
      const selected = selectedSoundNames.length ? selectedSoundNames : recommended;
      const liveState = currentWeatherState();
      const isLive = liveState?.id === preset.id;

      const effects = [];
      if (preset.fxPreset) effects.push(`FXMaster: ${preset.fxPreset}`);
      if (preset.nativeWeather) effects.push(`Native: ${preset.nativeWeather}`);
      if (preset.rain) effects.push("Rain layer");
      if (preset.fog) effects.push("Fog layer");
      if (preset.clouds) effects.push("Cloud layer");
      if (preset.useLightning) effects.push("Lightning pulses");
      if (preset.localWindDebris || preset.extraEffects?.length) effects.push("Debris / particles");
      if (["ashfall", "heavyAshfall"].includes(preset.id) && weatherScreenOverlayEnabled) effects.push("Smoky ash overlay");
      if (preset.id === "blizzard" && weatherScreenOverlayEnabled) effects.push("Whiteout overlay");
      if (preset.id === "heatwave" && weatherScreenOverlayEnabled) effects.push("Heat shimmer overlay");
      if (!effects.length) effects.push("Clear scene state");

      return `
        <section class="orilon-selected-card ${isLive ? "is-live" : ""}">
          <div class="orilon-selected-topline">
            <span>${escapeHtml(preset.category || "Weather")}</span>
            ${isLive ? `<strong>Currently Live</strong>` : `<strong>Selected</strong>`}
          </div>
          <div class="orilon-selected-title">${escapeHtml(preset.label)}</div>
          ${preset.tone ? `<div class="orilon-selected-tone">${escapeHtml(preset.tone)}</div>` : ``}
          <p class="orilon-selected-description">${escapeHtml(preset.description || "No description available.")}</p>
          <div class="orilon-summary-grid">
            <div><span>Atmosphere</span><strong>${percent(preset.atmosphereDarkness)}</strong></div>
            <div><span>Lightning</span><strong>${preset.useLightning ? "Available" : "None"}</strong></div>
            <div><span>Sound Mode</span><strong>${sceneSfxEnabled ? "Scene SFX On" : "Scene SFX Off"}</strong></div>
            <div><span>Character FX</span><strong>${characterWeatherEffectsEnabled ? weatherEffectSummaryForPreset(preset) : "Off"}</strong></div>
            <div><span>Token Vision</span><strong>${tokenVisionWeatherEnabled ? weatherTokenVisionSummaryForPreset(preset) : "Off"}</strong></div>
            <div><span>Sounds</span><strong>${selected.length || recommended.length || 0} selected</strong></div>
          </div>
          <div class="orilon-effect-line">
            ${effects.map(effect => `<span>${escapeHtml(effect)}</span>`).join("")}
          </div>
        </section>
      `;
    }

    // ======================================================
    // UI
    // ======================================================

    let selectedWeatherId = currentWeatherState()?.id || "lightRain";
    function soundChoicesForPreset(preset) {
      const names = Object.keys(SOUND_LIBRARY || {});
      if (!names.length) return [];

      const byLower = new Map(names.map(name => [name.toLowerCase(), name]));

      const exact = (...labels) => {
        for (const label of labels) {
          const match = byLower.get(String(label).toLowerCase());
          if (match) return [match];
        }
        return [];
      };

      const findAny = (...terms) => {
        const loweredTerms = terms.map(term => String(term).toLowerCase());
        return names.filter(name => {
          const lower = name.toLowerCase();
          return loweredTerms.some(term => lower.includes(term));
        });
      };

      const unique = values => [...new Set(values)].filter(Boolean);

      switch (preset?.id) {
        case "overcast":
          return exact("Overcast");
        case "heatwave":
          return exact("Heatwave");
        case "lightRain":
          return unique([
            ...exact("Light Rain In The Forest", "Light Rain In Forest"),
            ...findAny("light rain in the forest", "light rain forest", "forest light rain", "forest rain"),
            ...exact("Light Rain")
          ]).slice(0, 2);
        case "heavyRain":
          return unique([
            ...exact("Heavy Rain"),
            ...findAny("heavy rain")
          ]).slice(0, 2);
        case "thunderstorm":
          return unique([
            ...exact("Storm"),
            ...findAny("storm"),
            ...exact("Thunderstorm")
          ]).slice(0, 2);
        case "galeHurricane":
          return unique([
            ...exact("Gale"),
            ...findAny("gale"),
            ...exact("Violent Storm", "Hurricane")
          ]).slice(0, 2);
        case "fog":
        case "heavyFog":
        case "rollingFog":
          return exact("Fog Day");
        case "snow":
          return exact("Snow");
        case "blizzard":
          return exact("Blizzard");
        case "wind":
          return exact("Windy Country");
        case "ashfall":
        case "heavyAshfall":
          return exact("Ash Heap Falling Embers");
        default:
          return [];
      }
    }

    function weatherSoundVolume(preset, path, name = "") {
      const normalizedPath = String(path || "").toLowerCase();
      const normalizedName = String(name || "").toLowerCase();

      if (normalizedPath.includes("weather%20control%20sounds/ash-heap-falling-embers.mp3") || normalizedName === "ash heap falling embers") {
        return 0.78;
      }

      if (preset?.id === "galeHurricane") return 0.62;
      if (preset?.id === "blizzard") return 0.58;
      if (preset?.id === "overcast") return 0.20;
      if (preset?.id === "heatwave") return 0.20;
      if (preset?.id === "heavyAshfall") return 0.34;
      return 0.42;
    }

    function buildSoundsFromSelectedNames(preset) {
      const names = selectedSoundNames.length ? selectedSoundNames : soundChoicesForPreset(preset);

      return names
        .map(name => {
          const path = SOUND_LIBRARY[name];
          if (!path) return null;

          return {
            name: `Weather Control — ${name}`,
            path,
            volume: weatherSoundVolume(preset, path, name),
            radius: 999999,
            repeat: true,
            hidden: false
          };
        })
        .filter(Boolean);
    }


    const content = `
      <style>
        .orilon-weather-admin { height: 82vh; min-height: 650px; display: grid; grid-template-rows: auto 1fr; overflow: hidden; background: radial-gradient(circle at 12% 0%, rgba(156,118,52,0.20), transparent 34%), radial-gradient(circle at 90% 8%, rgba(70,95,125,0.13), transparent 34%), linear-gradient(180deg, rgba(13,13,16,0.99), rgba(5,5,8,0.99)); color: rgba(245,240,226,0.95); font-family: "Cinzel", "Trajan Pro", Georgia, serif; }
        .orilon-weather-admin * { box-sizing: border-box; }
        .orilon-weather-header { display: grid; grid-template-columns: minmax(300px, 1fr) auto; gap: 14px; align-items: center; padding: 14px 16px; border-bottom: 1px solid rgba(225,210,170,0.16); background: rgba(0,0,0,0.30); }
        .orilon-weather-title { color: rgba(232,218,184,0.98); font-size: 22px; letter-spacing: 0.16em; text-transform: uppercase; text-shadow: 0 2px 12px rgba(0,0,0,1), 0 0 22px rgba(232,218,184,0.12); }
        .orilon-weather-subtitle { margin-top: 4px; color: rgba(245,240,226,0.58); font-family: Georgia, serif; font-size: 12px; letter-spacing: 0.02em; }
        .orilon-header-actions { display: grid; grid-template-columns: auto auto auto auto; gap: 8px; align-items: center; }
        .orilon-weather-body { display: grid; grid-template-columns: 260px minmax(360px, 1fr) 390px; min-height: 0; }
        .orilon-weather-pane { min-height: 0; overflow: auto; padding: 14px; border-right: 1px solid rgba(225,210,170,0.11); }
        .orilon-weather-pane.center { background: rgba(255,255,255,0.014); }
        .orilon-weather-pane.right { border-right: 0; border-left: 1px solid rgba(225,210,170,0.11); }
        .orilon-weather-admin button { min-height: 34px; padding: 8px 11px; background: linear-gradient(180deg, rgba(78,68,48,0.92), rgba(32,31,30,0.96)); border: 1px solid rgba(232,218,184,0.24); border-radius: 10px; color: rgba(245,240,226,0.96); font-family: "Cinzel", "Trajan Pro", Georgia, serif; font-size: 12px; letter-spacing: 0.05em; cursor: pointer; }
        .orilon-weather-admin button:hover { border-color: rgba(232,218,184,0.55); box-shadow: 0 0 18px rgba(232,218,184,0.08); }
        .orilon-weather-admin button.ghost { background: rgba(255,255,255,0.045); }
        .orilon-weather-admin button.danger { background: rgba(80,24,24,0.78); border-color: rgba(255,190,190,0.22); }
        .orilon-weather-admin button.apply { min-height: 38px; padding-inline: 16px; background: linear-gradient(180deg, rgba(124,98,50,0.98), rgba(45,38,28,0.98)); border-color: rgba(232,218,184,0.42); }
        .orilon-weather-admin button:disabled,
        .orilon-weather-admin input:disabled,
        .orilon-weather-admin select:disabled { opacity: 0.45 !important; cursor: not-allowed !important; filter: grayscale(0.65); }
        .orilon-weather-admin.is-busy { cursor: progress; }
        .orilon-transition-banner { display: none; grid-column: 1 / -1; padding: 8px 11px; border-top: 1px solid rgba(232,218,184,0.10); border-bottom: 1px solid rgba(232,218,184,0.10); background: rgba(124,98,50,0.20); color: rgba(245,240,226,0.88); font-family: Georgia, serif; font-size: 12px; letter-spacing: 0.03em; }
        .orilon-weather-admin.is-busy .orilon-transition-banner { display: block; }
        .orilon-bb-card { padding: 13px; margin-bottom: 12px; background: rgba(0,0,0,0.24); border: 1px solid rgba(225,210,170,0.13); border-radius: 14px; }
        .orilon-bb-section-title { margin-bottom: 10px; color: rgba(232,218,184,0.96); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
        .orilon-weather-preset-list { display: grid; gap: 7px; }
        .orilon-weather-group-title { margin: 8px 2px 2px; color: rgba(232,218,184,0.62); font-family: Georgia, serif; font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; }
        .orilon-weather-group-title:first-child { margin-top: 0; }
        .orilon-weather-preset { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; text-align: left; padding: 9px 10px; min-height: 38px; background: rgba(255,255,255,0.032); border: 1px solid rgba(225,210,170,0.11); border-radius: 12px; }
        .orilon-weather-preset.selected { background: rgba(92,80,58,0.72); border-color: rgba(232,218,184,0.48); }
        .orilon-weather-preset.live { box-shadow: inset 0 0 0 1px rgba(140,210,150,0.24), 0 0 18px rgba(140,210,150,0.06); }
        .orilon-weather-preset.clear { border-color: rgba(255,190,190,0.22); }
        .orilon-weather-preset-title { display: block; color: rgba(245,240,226,0.96); font-size: 12px; line-height: 1.15; }
        .orilon-preset-pill { padding: 2px 6px; border-radius: 999px; border: 1px solid rgba(150,230,165,0.28); color: rgba(205,255,210,0.92); background: rgba(30,95,45,0.20); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
        .orilon-selected-card { min-height: 230px; padding: 18px; background: radial-gradient(circle at top right, rgba(232,218,184,0.12), transparent 38%), linear-gradient(180deg, rgba(15,15,18,0.86), rgba(0,0,0,0.34)); border: 1px solid rgba(225,210,170,0.15); border-radius: 16px; }
        .orilon-selected-card.is-live { border-color: rgba(160,230,170,0.22); box-shadow: 0 0 22px rgba(140,210,150,0.06); }
        .orilon-selected-topline { display: flex; justify-content: space-between; gap: 10px; color: rgba(232,218,184,0.70); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 10px; }
        .orilon-selected-topline strong { color: rgba(245,240,226,0.85); font-weight: normal; }
        .orilon-selected-title { color: rgba(245,240,226,0.96); font-size: 28px; letter-spacing: 0.10em; text-transform: uppercase; line-height: 1.05; margin-bottom: 10px; text-shadow: 0 2px 12px rgba(0,0,0,0.8); }
        .orilon-selected-tone, .orilon-selected-description { color: rgba(220,220,220,0.68); font-family: Georgia, serif; font-size: 13px; line-height: 1.4; }
        .orilon-selected-tone { margin-bottom: 8px; color: rgba(232,218,184,0.72); }
        .orilon-selected-description { margin: 0 0 12px 0; }
        .orilon-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
        .orilon-summary-grid div, .orilon-live-strip div { padding: 9px; background: rgba(255,255,255,0.034); border: 1px solid rgba(225,210,170,0.12); border-radius: 11px; }
        .orilon-summary-grid span, .orilon-live-strip span { display: block; color: rgba(220,220,220,0.58); font-family: Georgia, serif; font-size: 11px; margin-bottom: 4px; }
        .orilon-summary-grid strong, .orilon-live-strip strong { display: block; color: rgba(245,240,226,0.95); font-size: 12px; line-height: 1.25; overflow-wrap: anywhere; }
        .orilon-effect-line { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
        .orilon-effect-line span { padding: 4px 8px; border-radius: 999px; border: 1px solid rgba(225,210,170,0.14); background: rgba(84,61,30,0.22); color: rgba(232,218,184,0.80); font-family: Georgia, serif; font-size: 11px; }
        .orilon-live-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
        .orilon-advanced-toggle { margin-top: 12px; }
        .orilon-advanced-toggle summary { cursor: pointer; list-style: none; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(225,210,170,0.14); background: rgba(255,255,255,0.034); color: rgba(232,218,184,0.92); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
        .orilon-advanced-toggle summary::-webkit-details-marker { display: none; }
        .orilon-advanced-body { margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .orilon-toggle-card { display: flex !important; gap: 10px; align-items: center; padding: 10px; margin: 0 !important; background: rgba(255,255,255,0.032); border: 1px solid rgba(225,210,170,0.12); border-radius: 12px; cursor: pointer; }
        .orilon-toggle-card input[type="checkbox"] { width: 17px !important; height: 17px !important; min-height: 17px !important; margin: 0 !important; accent-color: rgba(232,218,184,0.95); }
        .orilon-toggle-card input[type="range"] { width: 100%; margin-top: 8px; }
        .orilon-toggle-card select { width: 100%; min-height: 34px; margin-top: 6px; padding: 6px 8px; background: #111116 !important; color: #f5f0e2 !important; border: 1px solid rgba(225,210,170,0.25); border-radius: 10px; }
        .orilon-toggle-card strong { color: rgba(245,240,226,0.92); font-size: 12px; letter-spacing: 0.04em; }
        .orilon-toggle-card small { display: block; margin-top: 3px; color: rgba(220,220,220,0.54); font-family: Georgia, serif; font-size: 11px; line-height: 1.25; }
        .orilon-sound-menu { width: 100%; margin-top: 8px; padding: 8px; max-height: 360px; overflow: auto; background: rgba(0,0,0,0.24); border: 1px solid rgba(225,210,170,0.16); border-radius: 12px; }
        .orilon-sound-checkbox-row { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; padding: 8px; margin-bottom: 6px; border: 1px solid rgba(225,210,170,0.10); border-radius: 10px; background: rgba(255,255,255,0.026); cursor: pointer; }
        .orilon-sound-checkbox-row:last-child { margin-bottom: 0; }
        .orilon-sound-checkbox-row:hover { border-color: rgba(232,218,184,0.34); background: rgba(232,218,184,0.055); }
        .orilon-sound-checkbox-row input { width: 16px !important; height: 16px !important; min-height: 16px !important; margin: 0 !important; accent-color: rgba(232,218,184,0.95); }
        .orilon-sound-name { color: rgba(245,240,226,0.94); font-family: Georgia, serif; font-size: 12px; line-height: 1.2; }
        .orilon-sound-path { display: block; margin-top: 3px; color: rgba(220,220,220,0.48); font-family: Georgia, serif; font-size: 10px; line-height: 1.2; overflow-wrap: anywhere; }
        .orilon-sound-badge { padding: 3px 7px; border-radius: 999px; border: 1px solid rgba(225,210,170,0.18); color: rgba(232,218,184,0.86); background: rgba(84,61,30,0.28); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
        .orilon-sound-badge.selected { border-color: rgba(180,230,170,0.30); color: rgba(210,255,205,0.92); background: rgba(40,95,45,0.22); }
        .orilon-sound-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
        .orilon-sound-count { color: rgba(220,220,220,0.62); font-family: Georgia, serif; font-size: 11px; line-height: 1.3; }
        .orilon-empty-sound-menu { padding: 10px; border-radius: 10px; color: rgba(245,240,226,0.70); background: rgba(255,255,255,0.035); font-family: Georgia, serif; font-size: 12px; line-height: 1.35; }
        .orilon-path-note { margin-top: 10px; padding: 9px 10px; border-radius: 12px; border: 1px dashed rgba(225,210,170,0.18); color: rgba(220,220,220,0.60); font-family: Georgia, serif; font-size: 11px; line-height: 1.35; }
        @media (max-width: 1180px) { .orilon-weather-body { grid-template-columns: 230px minmax(320px, 1fr) 340px; } .orilon-summary-grid, .orilon-live-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } .orilon-advanced-body { grid-template-columns: 1fr; } .orilon-header-actions { grid-template-columns: auto auto; } }
      </style>
      <div class="orilon-weather-admin">
        <div class="orilon-weather-header">
          <div><div class="orilon-weather-title">Weather Control</div><div class="orilon-weather-subtitle">Pick weather → review it → apply it to the active scene.</div></div>
          <div class="orilon-header-actions"><button type="button" class="apply" id="orilon-apply-weather">Apply</button><button type="button" class="danger" id="orilon-clear-weather">Clear</button><button type="button" class="ghost" id="orilon-advanced-info">Info</button><button type="button" class="ghost" id="orilon-refresh-weather">Refresh / Sync</button></div>
        </div>
        <div class="orilon-transition-banner" id="orilon-transition-banner">Weather transition in progress...</div>
        <div class="orilon-weather-body">
          <aside class="orilon-weather-pane left"><div class="orilon-bb-card"><div class="orilon-bb-section-title">Weather</div><div id="orilon-weather-preset-list" class="orilon-weather-preset-list"></div></div></aside>
          <main class="orilon-weather-pane center"><div id="orilon-weather-details"></div><div class="orilon-bb-card" style="margin-top:12px;"><div class="orilon-bb-section-title">Live Scene State</div><div id="orilon-mini-status"></div></div>
            <details class="orilon-advanced-toggle"><summary>Advanced Tuning</summary><div class="orilon-advanced-body">
              <label class="orilon-toggle-card"><span style="width:100%;"><strong>Visual Engine</strong><select id="orilon-visual-engine"><option value="fxmasterSafe">FXMaster Tuned</option><option value="native">Native Fallback</option></select></span></label>
              <label class="orilon-toggle-card"><span style="width:100%;"><strong>Fog / Mist: <span id="orilon-fog-intensity-label">100%</span></strong><input id="orilon-fog-intensity-slider" type="range" min="50" max="220" step="5" value="100"></span></label>
              <label class="orilon-toggle-card"><input id="orilon-atmosphere-lighting-enabled" type="checkbox" checked><span><strong>Atmosphere Lighting</strong><small>Scene darkness changes with weather.</small></span></label>
              <label class="orilon-toggle-card"><input id="orilon-storm-lightning-enabled" type="checkbox" checked><span><strong>Lightning Pulses</strong><small>Storm and gale flash timing.</small></span></label>
              <label class="orilon-toggle-card"><input id="orilon-smooth-local-lightning-enabled" type="checkbox" checked><span><strong>Smooth Lightning Overlay</strong><small>Client-side flash overlay.</small></span></label>
              <label class="orilon-toggle-card"><input id="orilon-gale-debris-enabled" type="checkbox" checked><span><strong>Local Weather Particles</strong><small>Local leaves, ash, embers, and storm debris.</small></span></label>
              <label class="orilon-toggle-card"><input id="orilon-ashfall-screen-overlay-enabled" type="checkbox" checked><span><strong>Weather Screen Overlays</strong><small>Ashfall smoke, blizzard whiteout, and heatwave shimmer overlays.</small></span></label>
              <label class="orilon-toggle-card"><input id="orilon-character-weather-effects-enabled" type="checkbox" checked><span><strong>Character Weather Effects</strong><small>Applies/removes Orilon visibility penalties on scene characters.</small></span></label>
              <label class="orilon-toggle-card"><input id="orilon-token-vision-weather-enabled" type="checkbox" checked><span><strong>Token Vision Weather</strong><small>Reduces token sight range during low-visibility weather, then restores it on clear.</small></span></label>
            </div></details>
          </main>
          <aside class="orilon-weather-pane right"><div class="orilon-bb-card"><div class="orilon-bb-section-title">Sound</div><label class="orilon-toggle-card" style="margin-bottom:10px !important;"><input id="orilon-scene-sfx-enabled" type="checkbox" checked><span><strong>Scene-Local SFX</strong><small>Create weather sound nodes when applying weather.</small></span></label><div id="orilon-sound-count" class="orilon-sound-count"></div><div id="orilon-sound-selector" class="orilon-sound-menu"></div><div class="orilon-sound-tools"><button type="button" class="ghost" id="orilon-recommend-sounds">Recommended</button><button type="button" class="ghost" id="orilon-refresh-sounds">Scan Sounds</button></div><div class="orilon-path-note">Expected folder: <strong>Weather Control Sounds</strong>. Foundry may display spaces as <strong>%20</strong>.</div></div></aside>
        </div>
      </div>
    `;

    const dlg = new Dialog({
      title: "Orilon Weather Control",
      content,
      buttons: {
        close: { label: "Close" }
      },
      default: "close",
      render: async html => {
        await scanWeatherSoundFolder();

        if (!selectedSoundNames.length) {
          selectedSoundNames = soundChoicesForPreset(WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain);
        }
        if (!selectedSoundNames.length) {
        }
        function renderPresetList() {
          const presetGroups = [
            { label: "Atmosphere", presets: [WEATHER_PRESETS.clear, WEATHER_PRESETS.overcast, WEATHER_PRESETS.wind, WEATHER_PRESETS.heatwave] },
            { label: "Rain / Storm", presets: [WEATHER_PRESETS.lightRain, WEATHER_PRESETS.heavyRain, WEATHER_PRESETS.thunderstorm, WEATHER_PRESETS.galeHurricane] },
            { label: "Fog", presets: [WEATHER_PRESETS.fog, WEATHER_PRESETS.heavyFog] },
            { label: "Cold", presets: [WEATHER_PRESETS.snow, WEATHER_PRESETS.blizzard] },
            { label: "Hazard", presets: [WEATHER_PRESETS.ashfall, WEATHER_PRESETS.heavyAshfall] }
          ];

          const presetHtml = presetGroups.map(group => {
            const buttons = group.presets
              .filter(Boolean)
              .map(preset => presetButtonHtml(preset, selectedWeatherId))
              .join("");
            return `<div class="orilon-weather-group-title">${escapeHtml(group.label)}</div>${buttons}`;
          }).join("");

          html.find("#orilon-weather-preset-list").html(presetHtml);

          html.find(".orilon-weather-preset").on("click", ev => {
            selectedWeatherId = ev.currentTarget.dataset.weatherId;
            selectedSoundNames = soundChoicesForPreset(WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain);
            renderAll();
          });
        }

        function renderDetails() {
          const preset = WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain;
          html.find("#orilon-weather-details").html(selectedPresetDetailsHtml(preset));
        }

        function renderMiniStatus() {
          html.find("#orilon-mini-status").html(statusSummaryHtml());
        }

        function renderSoundSelector() {
          const preset = WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain;
          const recommended = new Set(soundChoicesForPreset(preset));
          const names = Object.keys(SOUND_LIBRARY || {});
          const selectedCount = selectedSoundNames.filter(name => names.includes(name)).length;

          html.find("#orilon-sound-count").text(
            `${selectedCount} selected / ${names.length} found.`
          );

          if (!names.length) {
            html.find("#orilon-sound-selector").html(
              `<div class="orilon-empty-sound-menu">No audio files found by scan. Fallback paths are active, but there are no selectable scanned files yet.</div>`
            );
            return;
          }

          const rowsHtml = names.map(name => {
            const checked = selectedSoundNames.includes(name) ? "checked" : "";
            const isRecommended = recommended.has(name);
            const badge = checked ? "Selected" : isRecommended ? "Recommended" : "Available";
            const badgeClass = checked ? "selected" : "";
            const path = SOUND_LIBRARY[name] || "";

            return `
              <label class="orilon-sound-checkbox-row" title="${escapeHtml(path)}">
                <input type="checkbox" class="orilon-sound-checkbox" value="${escapeHtml(name)}" ${checked}>
                <span>
                  <span class="orilon-sound-name">${escapeHtml(name)}</span>
                  <span class="orilon-sound-path">${escapeHtml(path)}</span>
                </span>
                <span class="orilon-sound-badge ${badgeClass}">${escapeHtml(badge)}</span>
              </label>
            `;
          }).join("");

          html.find("#orilon-sound-selector").html(rowsHtml);
        }

        function syncControls() {
          html.find("#orilon-visual-engine").val(visualEngine);
          html.find("#orilon-scene-sfx-enabled").prop("checked", sceneSfxEnabled);
          html.find("#orilon-atmosphere-lighting-enabled").prop("checked", atmosphereLightingEnabled);
          html.find("#orilon-storm-lightning-enabled").prop("checked", stormLightningEnabled);
          html.find("#orilon-smooth-local-lightning-enabled").prop("checked", smoothLocalLightningEnabled);
          html.find("#orilon-gale-debris-enabled").prop("checked", galeDebrisEnabled);
          html.find("#orilon-ashfall-screen-overlay-enabled").prop("checked", weatherScreenOverlayEnabled);
          html.find("#orilon-character-weather-effects-enabled").prop("checked", characterWeatherEffectsEnabled);
          html.find("#orilon-token-vision-weather-enabled").prop("checked", tokenVisionWeatherEnabled);
          html.find("#orilon-fog-intensity-slider").val(Math.round(fogIntensityMultiplier * 100));
          html.find("#orilon-fog-intensity-label").text(`${Math.round(fogIntensityMultiplier * 100)}%`);
        }

        function updateBusyUi() {
          const busy = isWeatherTransitionLocked();
          html.find(".orilon-weather-admin").toggleClass("is-busy", busy);
          html.find("#orilon-transition-banner").text(RUNTIME.transitionMessage || "Weather transition in progress...");
          html.find("button, input, select").prop("disabled", busy);
        }

        async function runBoardTransition(label, task) {
          if (isWeatherTransitionLocked()) {
            ui.notifications.warn("Orilon weather is already changing. Please let the current transition finish.");
            return null;
          }

          RUNTIME.transitionLocked = true;
          RUNTIME.transitionMessage = label || "Updating weather...";
          updateBusyUi();

          try {
            return await task();
          } catch (err) {
            console.error("ORILON Weather: board transition failed.", err);
            ui.notifications.error(`Orilon weather update failed: ${err.message || err}`);
            return null;
          } finally {
            RUNTIME.transitionLocked = false;
            RUNTIME.transitionMessage = "";
            renderAll();
          }
        }

        function bindControls() {
          html.find("#orilon-visual-engine").off("change").on("change", ev => {
            if (isWeatherTransitionLocked()) return;
            visualEngine = String(ev.currentTarget.value || "fxmasterSafe");
            renderAll();
          });

          html.find("#orilon-fog-intensity-slider").off("input change").on("input change", ev => {
            fogIntensityMultiplier = Number(ev.currentTarget.value || 100) / 100;
            html.find("#orilon-fog-intensity-label").text(`${Math.round(fogIntensityMultiplier * 100)}%`);
          });

          html.find("#orilon-sound-selector").off("change", ".orilon-sound-checkbox").on("change", ".orilon-sound-checkbox", ev => {
            const value = String(ev.currentTarget.value || "");
            if (!value) return;

            if (ev.currentTarget.checked) {
              if (!selectedSoundNames.includes(value)) selectedSoundNames.push(value);
            } else {
              selectedSoundNames = selectedSoundNames.filter(name => name !== value);
            }

            renderSoundSelector();
          });

          html.find("#orilon-recommend-sounds").off("click").on("click", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            selectedSoundNames = soundChoicesForPreset(WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain);
            renderAll();
          });

          html.find("#orilon-refresh-sounds").off("click").on("click", async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            await scanWeatherSoundFolder();
            selectedSoundNames = soundChoicesForPreset(WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain);
            renderAll();
            ui.notifications.info(`Weather sounds refreshed: ${Object.keys(SOUND_LIBRARY || {}).length} path(s).`);
          });

          html.find("#orilon-scene-sfx-enabled").off("change").on("change", ev => {
            sceneSfxEnabled = Boolean(ev.currentTarget.checked);
            renderAll();
          });

          html.find("#orilon-atmosphere-lighting-enabled").off("change").on("change", ev => {
            atmosphereLightingEnabled = Boolean(ev.currentTarget.checked);
            if (!atmosphereLightingEnabled) {
              clearRuntimeTimers();
              setSceneDarkness(scene, 0.0);
            }
            renderAll();
          });

          html.find("#orilon-storm-lightning-enabled").off("change").on("change", ev => {
            stormLightningEnabled = Boolean(ev.currentTarget.checked);
            if (!stormLightningEnabled && RUNTIME.activeMode === "storm-lightning") {
              clearRuntimeTimers();
              const state = currentWeatherState();
              const preset = WEATHER_PRESETS[state?.id];
              if (preset && atmosphereLightingEnabled) {
                setSceneDarkness(scene, preset.atmosphereDarkness);
              }
            }
            renderAll();
          });

          html.find("#orilon-smooth-local-lightning-enabled").off("change").on("change", ev => {
            smoothLocalLightningEnabled = Boolean(ev.currentTarget.checked);
            renderAll();
          });

          html.find("#orilon-gale-debris-enabled").off("change").on("change", async ev => {
            galeDebrisEnabled = Boolean(ev.currentTarget.checked);
            await restartCurrentLocalWeatherRuntime(scene);
            renderAll();
          });

          html.find("#orilon-ashfall-screen-overlay-enabled").off("change").on("change", async ev => {
            weatherScreenOverlayEnabled = Boolean(ev.currentTarget.checked);
            if (!weatherScreenOverlayEnabled) {
              document.querySelectorAll("#orilon-weather-ashfall-overlay, #orilon-weather-ashfall-overlay-style, #orilon-weather-cold-overlay, #orilon-weather-cold-overlay-style, #orilon-weather-atmosphere-overlay, #orilon-weather-atmosphere-overlay-style").forEach(el => el.remove());
            } else {
              await restartCurrentLocalWeatherRuntime(scene);
            }
            renderAll();
          });

          html.find("#orilon-character-weather-effects-enabled").off("change").on("change", async ev => {
            characterWeatherEffectsEnabled = Boolean(ev.currentTarget.checked);
            if (!characterWeatherEffectsEnabled) {
              const removed = await clearWeatherActiveEffects(scene, { includePriorActors: true });
              if (removed) ui.notifications.info(`Weather character effect(s) removed: ${removed}`);
            }
            renderAll();
          });

          html.find("#orilon-token-vision-weather-enabled").off("change").on("change", async ev => {
            tokenVisionWeatherEnabled = Boolean(ev.currentTarget.checked);
            if (!tokenVisionWeatherEnabled) {
              const restored = await clearWeatherTokenVision(scene);
              if (restored) ui.notifications.info(`Weather token vision restored on ${restored} token(s).`);
            }
            renderAll();
          });
        }

        function renderAll() {
          renderPresetList();
          renderDetails();
          renderMiniStatus();
          renderSoundSelector();
          syncControls();
          bindControls();
          updateBusyUi();
        }

        html.find("#orilon-apply-weather").on("click", async ev => {
          ev.preventDefault();
          ev.stopPropagation();

          const preset = WEATHER_PRESETS[selectedWeatherId] || WEATHER_PRESETS.lightRain;
          await runBoardTransition(`Applying ${preset.label}...`, async () => {
            await applyWeatherPreset(scene, preset);
          });
        });

        html.find("#orilon-clear-weather").on("click", async ev => {
          ev.preventDefault();
          ev.stopPropagation();

          await runBoardTransition("Clearing Orilon weather...", async () => {
            await applyWeatherPreset(scene, WEATHER_PRESETS.clear);
            selectedWeatherId = "clear";
          });
        });

        html.find("#orilon-refresh-weather").on("click", async ev => {
          ev.preventDefault();
          ev.stopPropagation();

          await runBoardTransition("Refreshing and syncing live weather...", async () => {
            await scanWeatherSoundFolder();
            const state = currentWeatherState(scene);

            if (state?.id && state.id !== "clear" && WEATHER_PRESETS[state.id]) {
              selectedWeatherId = state.id;
              if (!selectedSoundNames.length) {
                selectedSoundNames = soundChoicesForPreset(WEATHER_PRESETS[state.id]);
              }
              await syncCurrentWeatherState(scene, {
                rebuildSfx: true,
                resyncCharacterEffects: true,
                refreshFx: true
              });
            } else {
              await renderAll();
              ui.notifications.info("Orilon weather board refreshed. No live weather state was found to sync.");
            }
          });
        });

        html.find("#orilon-advanced-info").on("click", ev => {
          ev.preventDefault();
          ev.stopPropagation();
          openAdvancedInfoDialog();
        });

        renderAll();
      }
    }, {
      width: 1240,
      height: "auto",
      resizable: true,
      popOut: true
    });

    dlg.render(true);
  }
}

Hooks.once("ready", () => {
  globalThis.OrilonWeatherBoard = OrilonWeatherBoard;

  if (game.user?.isGM) {
    console.log("[Orilon Weather] Module ready.");
  }
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  controls.push({
    name: "orilon-weather",
    title: "Orilon Weather",
    icon: "fas fa-cloud-sun-rain",
    layer: "controls",
    tools: [
      {
        name: "open-weather-board",
        title: "Open Orilon Weather Board",
        icon: "fas fa-cloud-bolt",
        button: true,
        onClick: () => OrilonWeatherBoard.openBoard()
      }
    ]
  });
});

Hooks.on("renderSceneControls", (_app, html) => {
  if (!game.user?.isGM) return;
  const btn = $(`<li class="scene-control" title="Open Orilon Weather Board"><i class="fas fa-cloud-bolt"></i></li>`);
  btn.on("click", () => OrilonWeatherBoard.openBoard());
});
