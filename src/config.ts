import { log } from "./utils.js";

const CONFIG_KEY = "yuketang-js-config";

interface AudioConfig {
  selected: string;
}

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: string;
}

interface Config {
  audio: AudioConfig;
  llm: LlmConfig;
}

const DEFAULT_CONFIG: Config = {
  audio: {
    selected: "preset:0",
  },
  llm: {
    baseUrl: "",
    apiKey: "",
    model: "",
    reasoningEffort: "high",
  },
};

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this._loadConfig();
  }

  private _loadConfig(): Config {
    try {
      const stored = GM_getValue<string | null>(CONFIG_KEY, null);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Config>;
        log(`📋 Config loaded from storage`);
        return this._mergeWithDefaults(parsed);
      }
    } catch (err) {
      const error = err as Error;
      log(`⚠️ Config load error: ${error.message}`);
    }
    log(`📋 Using default config`);
    return this._deepClone(DEFAULT_CONFIG);
  }

  private _mergeWithDefaults(loaded: Partial<Config>): Config {
    return {
      audio: {
        selected: loaded.audio?.selected ?? DEFAULT_CONFIG.audio.selected,
      },
      llm: {
        baseUrl: loaded.llm?.baseUrl ?? DEFAULT_CONFIG.llm.baseUrl,
        apiKey: loaded.llm?.apiKey ?? DEFAULT_CONFIG.llm.apiKey,
        model: loaded.llm?.model ?? DEFAULT_CONFIG.llm.model,
        reasoningEffort:
          loaded.llm?.reasoningEffort ?? DEFAULT_CONFIG.llm.reasoningEffort,
      },
    };
  }

  private _deepClone(obj: Config): Config {
    return JSON.parse(JSON.stringify(obj));
  }

  private _saveConfig(): boolean {
    try {
      GM_setValue(CONFIG_KEY, JSON.stringify(this.config));
      log(`💾 Config saved to storage`);
      return true;
    } catch (err) {
      const error = err as Error;
      log(`❌ Config save error: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets selected audio preset
   * @returns {string} - "preset:0" or "preset:1"
   */
  getSelectedAudio(): string {
    return this.config.audio.selected;
  }

  /**
   * Set selected audio preset
   * @param {string} presetId - "preset:0" or "preset:1"
   */
  setSelectedAudio(presetId: string): boolean {
    this.config.audio.selected = presetId;
    return this._saveConfig();
  }

  /**
   * Gets entire audio configuration
   * @returns {{ selected: string }}
   */
  getAudioConfig(): AudioConfig {
    return JSON.parse(JSON.stringify(this.config.audio)) as AudioConfig;
  }

  getLlmConfig(): LlmConfig {
    return JSON.parse(JSON.stringify(this.config.llm)) as LlmConfig;
  }

  setLlmConfig(newConfig: Partial<LlmConfig>): boolean {
    this.config.llm = { ...this.config.llm, ...newConfig };
    return this._saveConfig();
  }
}

export const config = new ConfigManager();
