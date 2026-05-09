import $ from "jquery";
import "bootstrap/dist/css/bootstrap.css";
import * as bootstrap from "bootstrap";
import { log } from "../utils/log.js";
import { audioController } from "../utils/audio-controller.js";
import { config } from "../config.js";
import OpenAI from "openai";

export function showStaleConfigWarning(): void {
  const modalId = "yuketang-js-stale-config-modal";
  $(`#${modalId}`).remove();

  const html = `
    <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">配置已过期</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>脚本设置已在其他地方被修改，请刷新当前页面以确保配置是最新的。</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="yuketang-js-stale-ignore-btn">忽略</button>
            <button type="button" class="btn btn-primary" id="yuketang-js-stale-refresh-btn">刷新</button>
          </div>
        </div>
      </div>
    </div>
  `;

  $("body").append(html);
  const $modal = $(`#${modalId}`);
  const modalInstance = new bootstrap.Modal($modal[0]);

  $("#yuketang-js-stale-ignore-btn").on("click", () => {
    modalInstance.hide();
  });

  $("#yuketang-js-stale-refresh-btn").on("click", () => {
    config.reloadFromStorage();
    location.reload();
  });

  $modal.on("hidden.bs.modal", () => {
    $modal.remove();
  });

  modalInstance.show();
}

class SettingsModal {
  private $modal: JQuery | null;

  constructor() {
    this.$modal = null;
  }

  open(): void {
    this._showSettings();
  }

  private _showSettings(): void {
    if (!this.$modal || this.$modal.length === 0) {
      this._create();
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

  private _create(): void {
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
                  <button class="nav-link active" id="yuketang-js-classroom-tab" data-bs-toggle="tab" data-bs-target="#yuketang-js-classroom" type="button" role="tab" aria-controls="yuketang-js-classroom" aria-selected="true">
                    课堂
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="yuketang-js-llm-settings-tab" data-bs-toggle="tab" data-bs-target="#yuketang-js-llm-settings" type="button" role="tab" aria-controls="yuketang-js-llm-settings" aria-selected="false">
                    大模型
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="yuketang-js-audio-tab" data-bs-toggle="tab" data-bs-target="#yuketang-js-audio" type="button" role="tab" aria-controls="yuketang-js-audio" aria-selected="false">
                    通知音频
                  </button>
                </li>
              </ul>
              <div class="tab-content" id="yuketang-js-settings-tabs-content">
                <div class="tab-pane fade show active" id="yuketang-js-classroom" role="tabpanel" aria-labelledby="yuketang-js-classroom-tab">
                  <div class="mt-3">
                    <h5>事件监听</h5>
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="checkbox" id="yuketang-js-el-unlock">
                      <label class="form-check-label" for="yuketang-js-el-unlock">发布题目</label>
                    </div>
                    <div class="form-check mb-2">
                      <input class="form-check-input" type="checkbox" id="yuketang-js-el-extend">
                      <label class="form-check-label" for="yuketang-js-el-extend">延时题目</label>
                    </div>
                    <div class="form-check mb-4">
                      <input class="form-check-input" type="checkbox" id="yuketang-js-el-random">
                      <label class="form-check-label" for="yuketang-js-el-random">随机点名</label>
                    </div>

                    <h5>自动答题</h5>
                    <div class="form-check form-switch mb-3">
                      <input class="form-check-input" type="checkbox" role="switch" id="yuketang-js-aa-enabled">
                      <label class="form-check-label" for="yuketang-js-aa-enabled">启用自动答题（需要配置正确的大模型设置）</label>
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-aa-time-left" class="form-label">限时题目在截止前多少秒启动自动答题</label>
                      <input type="number" class="form-control" id="yuketang-js-aa-time-left" value="30">
                    </div>
                    <div class="mb-3">
                      <label for="yuketang-js-aa-time-after" class="form-label">不限时题目在收到题目后多少秒启动自动答题</label>
                      <input type="number" class="form-control" id="yuketang-js-aa-time-after" value="15">
                    </div>
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
                      <div class="input-group">
                        <input type="password" class="form-control" id="yuketang-js-llm-apikey" placeholder="sk-xxxxxx">
                        <button class="btn" type="button" id="yuketang-js-llm-apikey-toggle">显示/隐藏</button>
                      </div>
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
                <div class="tab-pane fade" id="yuketang-js-audio" role="tabpanel" aria-labelledby="yuketang-js-audio-tab">
                  <div class="mt-3">
                    <div class="d-flex gap-2 mb-3">
                      <button id="yuketang-js-test-audio-btn" class="btn btn-sm btn-warning">测试音频播放</button>
                      <button id="yuketang-js-stop-audio-btn" class="btn btn-sm btn-warning">停止所有音频</button>
                    </div>
                    <h5>选择音频</h5>
                    <div id="yuketang-js-audio-options"></div>
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

    this._populateEventListenersOptions();
    this._populateAutoAnswerOptions();
    this._populateLlmOptions();
    this._populateAudioOptions();
  }

  private _populateEventListenersOptions(): void {
    const elConfig = config.getEventListenersConfig();
    const $unlock = $("#yuketang-js-el-unlock");
    const $extend = $("#yuketang-js-el-extend");
    const $random = $("#yuketang-js-el-random");

    $unlock.prop("checked", elConfig.unlockProblem);
    $extend.prop("checked", elConfig.extendTime);
    $random.prop("checked", elConfig.randomPick);

    const updateConfig = () => {
      config.setEventListenersConfig({
        unlockProblem: Boolean($unlock.prop("checked")),
        extendTime: Boolean($extend.prop("checked")),
        randomPick: Boolean($random.prop("checked")),
      });
    };

    $unlock.on("change", updateConfig);
    $extend.on("change", updateConfig);
    $random.on("change", updateConfig);
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

    $("#yuketang-js-llm-apikey-toggle").on("click", () => {
      const type = $apiKey.attr("type") === "password" ? "text" : "password";
      $apiKey.attr("type", type);
    });

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
        alert(`测试完成。大模型的回复是：\n${reply}`);
      } catch (e: any) {
        alert(`测试失败，原因：\n${e.message}`);
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
}

export const settingsModal = new SettingsModal();
