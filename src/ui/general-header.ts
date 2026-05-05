import $ from "jquery";
import { log } from "../utils/log.js";
import { settingsModal } from "./settings-modal.js";

export class GeneralHeaderUI {
  private $settingsBtn: JQuery | null;
  private injected: boolean;

  constructor() {
    this.$settingsBtn = null;
    this.injected = false;
  }

  update(): void {
    this._ensureInjected();
  }

  private _ensureInjected(): void {
    if (this.injected) {
      return;
    }

    const $headerButtonGroup = $(".headerButtonGroup");
    if ($headerButtonGroup.length === 0) {
      return;
    }

    this.$settingsBtn = $(
      '<button id="yuketang-js-general-settings-btn" class="btn btn-sm btn-secondary"></button>',
    );
    this.$settingsBtn.text("脚本设置");
    this.$settingsBtn.on("click", () => {
      settingsModal.open();
    });

    $headerButtonGroup.append(this.$settingsBtn);
    this.injected = true;

    log("🔲 Settings button added to headerButtonGroup");
  }
}
