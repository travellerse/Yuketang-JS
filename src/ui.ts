import $ from "jquery";
import "bootstrap/dist/css/bootstrap.css";
import * as bootstrap from "bootstrap";
import { log, notify, audioController } from "./utils.js";
import { config } from "./config.js";
import OpenAI from "openai";

export class LessonHeaderUI {
  private $container: JQuery | null;
  private $statusText: JQuery | null;
  private $notifyBtn: JQuery | null;
  private $settingsBtn: JQuery | null;
  private $modal: JQuery | null;
  private lastActiveTime: number | null;

  constructor() {
    this.$container = null;
    this.$statusText = null;
    this.$notifyBtn = null;
    this.$settingsBtn = null;
    this.$modal = null;
    this.lastActiveTime = null; // null means never active
  }

  /**
   * Ensures the UI is injected and updates all status.
   */
  update(): void {
    this._ensureInjected();
    this._updateStatusDisplay();
  }

  /**
   * Mark as active and update lastActiveTime.
   */
  setActive(): void {
    this.lastActiveTime = Date.now();
    this._updateStatusDisplay();
  }

  private _ensureInjected(): void {
    // Check if already injected
    if (this.$container && this.$container.length > 0) {
      return;
    }

    const $header = $(".lesson__header");
    if ($header.length === 0) {
      log("❓ lesson__header not found on this page");
      return;
    }

    // Check if container already exists
    const $existing = $("#yuketang-js-ui-container");
    if ($existing.length > 0) {
      this.$container = $existing;
      this.$statusText = this.$container.find("#yuketang-js-status-text");
      this.$notifyBtn = this.$container.find("#yuketang-js-test-notification");
      this.$settingsBtn = this.$container.find("#yuketang-js-settings-btn");
      return;
    }

    this.$container = $(
      '<div id="yuketang-js-ui-container" class="d-inline-flex align-items-center gap-2"></div>',
    );
    this.$statusText = $(
      '<span id="yuketang-js-status-text" class="badge"></span>',
    );
    this.$notifyBtn = $(
      '<button id="yuketang-js-test-notification" class="btn btn-sm btn-primary"></button>',
    );
    this.$notifyBtn.text("发送测试通知");
    this.$notifyBtn.on("click", () => {
      notify("🆗 测试通知", "【点我消除通知】恭喜！通知系统工作正常。");
      audioController.play();
    });

    this.$settingsBtn = $(
      '<button id="yuketang-js-settings-btn" class="btn btn-sm btn-secondary"></button>',
    );
    this.$settingsBtn.text("脚本设置");
    this.$settingsBtn.on("click", () => {
      this._openSettingsModal();
    });

    this.$container
      .append(this.$statusText)
      .append(this.$notifyBtn)
      .append(this.$settingsBtn);
    $header.append(this.$container);

    // Inject modal
    this._createModal();

    log("🔲 UI container added to lesson__header");
  }

  private _createModal(): void {
    if (this.$modal && this.$modal.length > 0) {
      return;
    }

    const modalHtml = `
      <div class="modal fade" id="yuketang-js-settings-modal" aria-labelledby="yuketang-js-settings-modal-label" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h1 class="modal-title fs-5" id="yuketang-js-settings-modal-label">Yuketang-JS 脚本设置</h1>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <ul class="nav nav-tabs" id="yuketang-js-settings-tabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" id="yuketang-js-classroom-alert-tab" data-bs-toggle="tab" data-bs-target="#yuketang-js-classroom-alert" type="button" role="tab" aria-controls="yuketang-js-classroom-alert" aria-selected="true">
                    通知音频设置
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="yuketang-js-llm-settings-tab" data-bs-toggle="tab" data-bs-target="#yuketang-js-llm-settings" type="button" role="tab" aria-controls="yuketang-js-llm-settings" aria-selected="false">
                    大模型设置
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="yuketang-js-auto-answer-settings-tab" data-bs-toggle="tab" data-bs-target="#yuketang-js-auto-answer-settings" type="button" role="tab" aria-controls="yuketang-js-auto-answer-settings" aria-selected="false">
                    答题设置
                  </button>
                </li>
              </ul>
              <div class="tab-content" id="yuketang-js-settings-tabs-content">
                <div class="tab-pane fade show active" id="yuketang-js-classroom-alert" role="tabpanel" aria-labelledby="yuketang-js-classroom-alert-tab">
                  <div class="mt-3">
                    <div class="d-flex gap-2 mb-3">
                      <button id="yuketang-js-test-audio-btn" class="btn btn-sm btn-warning">测试音频播放</button>
                      <button id="yuketang-js-stop-audio-btn" class="btn btn-sm btn-warning">停止所有音频</button>
                    </div>
                    <h5>选择音频</h5>
                    <div id="yuketang-js-audio-options"></div>
                  </div>
                </div>
                <div class="tab-pane fade" id="yuketang-js-llm-settings" role="tabpanel" aria-labelledby="yuketang-js-llm-settings-tab">
                  <div class="mt-3">
                    <div class="mb-3">
                      <label for="yuketang-js-llm-baseurl" class="form-label">API Base URL</label>
                      <input type="text" class="form-control" id="yuketang-js-llm-baseurl" placeholder="https://...">
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-llm-apikey" class="form-label">API Key</label>
                      <input type="password" class="form-control" id="yuketang-js-llm-apikey" placeholder="sk-xxxxxx">
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-llm-model" class="form-label">模型名称</label>
                      <input type="text" class="form-control" id="yuketang-js-llm-model">
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-llm-reasoning" class="form-label">推理强度</label>
                      <select class="form-select" id="yuketang-js-llm-reasoning">
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="xhigh">xhigh</option>
                      </select>
                    </div>
                    <div class="mb-3">
                      <button id="yuketang-js-llm-test-btn" class="btn btn-primary">测试大模型功能</button>
                    </div>
                  </div>
                </div>
                <div class="tab-pane fade" id="yuketang-js-auto-answer-settings" role="tabpanel" aria-labelledby="yuketang-js-auto-answer-settings-tab">
                  <div class="mt-3">
                    <div class="form-check form-switch mb-3">
                      <input class="form-check-input" type="checkbox" role="switch" id="yuketang-js-aa-enabled">
                      <label class="form-check-label" for="yuketang-js-aa-enabled">启用自动答题（需要配置正确的大模型设置）</label>
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-aa-time-left" class="form-label">限时题目在截止前多少秒启动自动答题</label>
                      <input type="number" class="form-control" id="yuketang-js-aa-time-left" value="30">
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-aa-time-after" class="form-label">不现时题目在收到题目后多少秒启动自动答题</label>
                      <input type="number" class="form-control" id="yuketang-js-aa-time-after" value="15">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("body").append(modalHtml);
    this.$modal = $("#yuketang-js-settings-modal");

    this._populateAudioOptions();
    this._populateLlmOptions();
    this._populateAutoAnswerOptions();
  }

  private _populateAutoAnswerOptions(): void {
    const aaConfig = config.getAutoAnswerConfig();
    const $enabled = $("#yuketang-js-aa-enabled");
    const $timeLeft = $("#yuketang-js-aa-time-left");
    const $timeAfter = $("#yuketang-js-aa-time-after");

    $enabled.prop("checked", aaConfig.enabled);
    $timeLeft.val(aaConfig.timeLeftThreshold);
    $timeAfter.val(aaConfig.timeAfterSend);

    const updateConfig = () => {
      config.setAutoAnswerConfig({
        enabled: Boolean($enabled.prop("checked")),
        timeLeftThreshold: parseInt($timeLeft.val() as string, 10) || 30,
        timeAfterSend: parseInt($timeAfter.val() as string, 10) || 15,
      });
    };

    $enabled.on("change", updateConfig);
    $timeLeft.on("change", updateConfig);
    $timeAfter.on("change", updateConfig);
  }

  private _populateLlmOptions(): void {
    const llmConfig = config.getLlmConfig();
    const $baseUrl = $("#yuketang-js-llm-baseurl");
    const $apiKey = $("#yuketang-js-llm-apikey");
    const $model = $("#yuketang-js-llm-model");
    const $reasoning = $("#yuketang-js-llm-reasoning");

    $baseUrl.val(llmConfig.baseUrl);
    $apiKey.val(llmConfig.apiKey);
    $model.val(llmConfig.model);
    $reasoning.val(llmConfig.reasoningEffort);

    const updateConfig = () => {
      config.setLlmConfig({
        baseUrl: $baseUrl.val() as string,
        apiKey: $apiKey.val() as string,
        model: $model.val() as string,
        reasoningEffort: $reasoning.val() as string,
      });
    };

    $baseUrl.on("change", updateConfig);
    $apiKey.on("change", updateConfig);
    $model.on("change", updateConfig);
    $reasoning.on("change", updateConfig);

    $("#yuketang-js-llm-test-btn").on("click", async () => {
      const baseUrl = $baseUrl.val() as string;
      const apiKey = $apiKey.val() as string;
      const model = $model.val() as string;
      const reasoningEffort = $reasoning.val() as string;

      if (!baseUrl || !apiKey || !model) {
        alert(
          "请完整填写大模型配置(API Base URL、API Key、模型名称均不可以为空)！",
        );
        return;
      }

      const openai = new OpenAI({
        baseURL: baseUrl,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // We are in a browser extension context
      });

      try {
        const btn = $("#yuketang-js-llm-test-btn");
        btn.prop("disabled", true);
        btn.text("测试中...");

        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: 'If you can see this, please say "OK".' },
          ],
          model: model,
          thinking: { type: "enabled" },
          reasoning_effort: reasoningEffort,
          stream: false,
        } as any);

        const reply = completion.choices[0]?.message?.content;
        alert(`测试完成。模型回复:\n${reply}`);
      } catch (e: any) {
        alert(`测试失败:\n${e.message}`);
      } finally {
        const btn = $("#yuketang-js-llm-test-btn");
        btn.prop("disabled", false);
        btn.text("测试大模型功能");
      }
    });
  }

  private _populateAudioOptions(): void {
    const $audioOptions = $("#yuketang-js-audio-options");
    const audioData = [
      { id: 0, name: "默认提示音 1" },
      { id: 1, name: "默认提示音 2" },
    ];

    audioData.forEach((audio) => {
      const radioId = `yuketang-js-audio-${audio.id}`;
      const $radio = $(`
        <div class="form-check">
          <input class="form-check-input" type="radio" name="yuketang-js-audio-select" id="${radioId}" value="${audio.id}" />
          <label class="form-check-label" for="${radioId}">${audio.name}</label>
        </div>
      `);

      $radio.on("change", (e: Event) => {
        const selectedId = parseInt($(e.target as HTMLElement).val() as string);
        audioController.setAudio(selectedId);
        log(`🎵 Audio changed to: ${audio.name}`);
      });

      $audioOptions.append($radio);
    });

    // Restore configuration
    const selectedAudio = config.getSelectedAudio();
    if (selectedAudio && selectedAudio.startsWith("preset:")) {
      const presetId = parseInt(selectedAudio.split(":")[1]);
      $audioOptions
        .find(`#yuketang-js-audio-${presetId}`)
        .prop("checked", true);
      log(`🎵 Restored preset audio: ${audioData[presetId]?.name}`);
    } else {
      // Default to first option
      $audioOptions.find("input[type='radio']").first().prop("checked", true);
    }
  }

  private _updateStatusDisplay(): void {
    if (!this.$statusText || this.$statusText.length === 0) {
      return;
    }

    // If never active
    if (this.lastActiveTime === null) {
      this.$statusText.text("未监听");
      this.$statusText.removeClass("bg-secondary bg-info");
      this.$statusText.addClass("bg-danger");
      return;
    }

    const now = Date.now();
    const inactiveThreshold = 300 * 1000;
    const timeSinceActive = now - this.lastActiveTime;

    if (timeSinceActive > inactiveThreshold) {
      this.$statusText.text("无活动");
      this.$statusText.removeClass("bg-danger bg-info");
      this.$statusText.addClass("bg-secondary");
    } else {
      this.$statusText.text("已监听");
      this.$statusText.removeClass("bg-danger bg-secondary");
      this.$statusText.addClass("bg-info");
    }
  }

  private _openSettingsModal(): void {
    if (!this.$modal || this.$modal.length === 0) {
      this._createModal();
    }

    // Attach button event listeners
    $("#yuketang-js-test-audio-btn")
      .off("click")
      .on("click", () => {
        audioController.play();
        log("▶️ Test audio playback triggered");
      });

    $("#yuketang-js-stop-audio-btn")
      .off("click")
      .on("click", () => {
        audioController.stop();
        log("⏹️ All audio stopped");
      });

    const modalInstance = new bootstrap.Modal(this.$modal![0]);
    modalInstance.show();
  }
}

export function showBanner(
  message: string,
  type: "info" | "success" | "danger" | "warning" = "info",
): void {
  const containerId = "yuketang-js-banner-container";
  let $container = $(`#${containerId}`);

  if ($container.length === 0) {
    // Make sure we have a container injected into body
    $container = $(
      `<div id="${containerId}" style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 10px; width: 80%; max-width: 600px;"></div>`,
    );
    $("body").append($container);
  }

  const html = `
    <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
      <strong>[Yuketang-JS]</strong>&nbsp;${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  $container.append(html);
}
