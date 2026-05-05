import { AUDIO_DATA, AudioData } from "../data.js";
import { config } from "../config.js";
import { log } from "./log.js";

export class AudioController {
  private audioElement: HTMLAudioElement;
  private currentAudioData: AudioData;

  constructor() {
    this.audioElement = new Audio();
    this.currentAudioData = AUDIO_DATA[0];
    this._initializeAudio();
    this._restoreConfig();
  }

  /**
   * Restore audio configuration from storage
   * @private
   */
  private _restoreConfig(): void {
    const audioConfig = config.getAudioConfig();

    // Restore selected audio
    if (audioConfig.selected && audioConfig.selected.startsWith("preset:")) {
      const presetId = parseInt(audioConfig.selected.split(":")[1]);
      if (presetId >= 0 && presetId < AUDIO_DATA.length) {
        this.currentAudioData = AUDIO_DATA[presetId];
        log(`🎵 Preset audio restored: ${AUDIO_DATA[presetId].name}`);
      }
    }

    this._initializeAudio();
  }

  private _initializeAudio(): void {
    if (this.currentAudioData && this.currentAudioData.data) {
      this.audioElement.src = this.currentAudioData.data;
    }
  }

  private _isPlaying(): boolean {
    return !this.audioElement.paused;
  }

  /**
   * Plays the audio.
   * If the previous audio is still playing, this play request will be ignored.
   */
  play(): void {
    if (!this._isPlaying()) {
      this.audioElement.currentTime = 0;
      this.audioElement.play().catch((err: unknown) => {
        log(`❌ Audio play error: ${err}`);
      });
    }
  }

  stop(): void {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  /**
   * Switches to a different audio by name or index.
   * @param {string|number} nameOrIndex - Audio name or index
   */
  setAudio(nameOrIndex: string | number): boolean {
    let newIndex = -1;

    if (typeof nameOrIndex === "number") {
      newIndex = nameOrIndex;
    } else if (typeof nameOrIndex === "string") {
      newIndex = AUDIO_DATA.findIndex((audio) => audio.name === nameOrIndex);
    }

    if (newIndex < 0 || newIndex >= AUDIO_DATA.length) {
      console.error(`Audio] Invalid audio index or name: ${nameOrIndex}`);
      return false;
    }

    this.currentAudioData = AUDIO_DATA[newIndex];
    this._initializeAudio();

    // Save to config
    config.setSelectedAudio(`preset:${newIndex}`);

    return true;
  }
}

export const audioController = new AudioController();
