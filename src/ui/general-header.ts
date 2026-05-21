import $ from "jquery";
import "bootstrap/dist/css/bootstrap.css";
import * as bootstrap from "bootstrap";
import { log } from "../utils/log.js";
import { settingsModal } from "./settings-modal.js";
import { showToast } from "./banner.js";
import { config } from "../config.js";
import { FINGERPRINT_OPTIONS } from "../constants.js";
import {
  type OnLessonClassroomItem,
  formatOnLessonItem,
  startOnLessonMonitor,
} from "../utils/on-lesson.js";

const CHECKED_LESSONS_KEY = "yuketang-js-checked-lessons";

function getCheckedLessons(): string[] {
  return GM_getValue<string[]>(CHECKED_LESSONS_KEY, []);
}

function addCheckedLesson(lessonId: string): void {
  const lessons = getCheckedLessons();
  if (!lessons.includes(lessonId)) {
    lessons.push(lessonId);
    GM_setValue(CHECKED_LESSONS_KEY, lessons);
  }
}

export class GeneralHeaderUI {
  private $settingsBtn: JQuery | null;
  private injected: boolean;
  private checkingLessons: string[];

  constructor() {
    this.$settingsBtn = null;
    this.injected = false;
    this.checkingLessons = [];
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

    this._startOnLessonList();
  }

  private _startOnLessonList(): void {
    const html = `
      <div id="yuketang-js-on-lesson-panel" class="card position-fixed bottom-0 start-50 translate-middle-x border-0" style="
        z-index: 9998; width: 680px; max-width: 95vw;
        border-radius: 12px 12px 0 0;
        box-shadow: 0 -2px 16px rgba(0,0,0,0.12);
      ">
        <div class="card-header d-flex justify-content-between align-items-center py-2 cursor-pointer bg-body-secondary"
             style="border-radius: 12px 12px 0 0;"
             data-bs-toggle="collapse" data-bs-target="#yuketang-js-on-lesson-body">
          <span class="fw-semibold" style="font-size: 0.9rem;">
            Yuketang-JS 上课教室列表（实时刷新）
            <span id="yuketang-js-on-lesson-count" class="badge bg-primary ms-2" style="font-size: 0.75rem;">0</span>
          </span>
          <span id="yuketang-js-on-lesson-chevron" class="bi bi-chevron-up" style="font-size: 0.8rem; transition: transform 0.2s;"></span>
        </div>
        <div id="yuketang-js-on-lesson-body" class="collapse show">
          <div id="yuketang-js-on-lesson-list" class="card-body d-flex flex-column gap-2 py-3 overflow-auto"
               style="max-height: 300px;">
          </div>
        </div>
      </div>
    `;

    $("body").append(html);

    const $count = $("#yuketang-js-on-lesson-count");
    const $list = $("#yuketang-js-on-lesson-list");
    const $chevron = $("#yuketang-js-on-lesson-chevron");
    const $body = $("#yuketang-js-on-lesson-body");

    $body.on("show.bs.collapse", () => {
      $chevron.css("transform", "rotate(0deg)");
    });
    $body.on("hide.bs.collapse", () => {
      $chevron.css("transform", "rotate(180deg)");
    });

    startOnLessonMonitor(10000, (items) => {
      $count.text(items.length);
      $list.empty();

      if (items.length === 0) {
        $list.append(
          '<div class="text-muted text-center py-2" style="font-size: 0.9rem;">当前没有正在上课的教室</div>',
        );
        return;
      }

      const checkinConf = config.getCheckinConfig();
      const checkedLessons = getCheckedLessons();

      // For each on-lesson item
      for (const item of items) {
        const $row = $(`
          <div class="d-flex justify-content-between align-items-center rounded px-3 py-2"
               style="background: #f0f4ff; font-size: 0.95rem;">
            <span>${formatOnLessonItem(item)}</span>
          </div>
        `);
        const $btn = $(
          '<button class="btn btn-sm btn-primary">签到并进入</button>',
        );
        $btn.on("click", () => this._showEnterClassroomModal(item));
        $row.append($btn);
        $list.append($row);

        // Auto check-in for new lessons
        if (
          checkinConf.autoCheckinEnabled &&
          !this.checkingLessons.includes(item.lessonId) &&
          !checkedLessons.includes(item.lessonId) &&
          (checkinConf.autoCheckinAudit || item.role === 5)
        ) {
          const delaySec = checkinConf.autoCheckinDelay;
          const source = checkinConf.defaultFingerprint;

          // Mark as 'checking' to avoid duplicate scheduling
          this.checkingLessons.push(item.lessonId);
          log(
            `🔄 Auto check-in scheduled for ${item.lessonId} in ${delaySec}s`,
          );
          showToast(
            "info",
            "自动签到",
            `将在 ${delaySec} 秒后自动签到「${item.courseName}」`,
            0,
          );

          setTimeout(() => {
            const url = `https://www.yuketang.cn/lesson/fullscreen/v3/${item.lessonId}?source=${source}`;
            window.open(url, "_blank");

            // Mark as 'checked' in persistent storage to avoid cross-tab duplication
            addCheckedLesson(item.lessonId);
            log(`✅ Auto check-in executed for ${item.lessonId}`);
            showToast(
              "success",
              "自动签到",
              `已请求打开新页面用于进入「${item.courseName}」`,
              0,
            );
          }, delaySec * 1000);
        }
      }
    });

    // Homepage auto-refresh
    const checkinConf = config.getCheckinConfig();
    if (checkinConf.autoCheckinEnabled) {
      showToast(
        "info",
        "自动签到",
        `已开启自动签到，将在检测到开课后 ${checkinConf.autoCheckinDelay} 秒自动进入课堂`,
        0,
      );
    } else {
      showToast(
        "info",
        "自动签到",
        `未开启自动签到，如需开启请调整脚本设置`,
        0,
      );
    }
    if (
      checkinConf.autoRefreshEnabled &&
      window.location.href.includes("index")
    ) {
      const intervalMin = checkinConf.autoRefreshInterval;
      log(
        `🔄 Homepage auto-refresh enabled, will reload in ${intervalMin} min`,
      );
      showToast(
        "info",
        "自动签到",
        `已开启主页自动刷新，当前页面将每隔 ${intervalMin} 分钟自动刷新`,
        0,
      );
      const expectedTime = Date.now() + intervalMin * 60 * 1000;
      setTimeout(
        () => {
          const driftSec = (Date.now() - expectedTime) / 1000;
          log(`🔄 Homepage auto-refresh fired, drift: ${driftSec.toFixed(3)}s`);
          if (driftSec > 60) {
            log("⚠️ Detected significant delay in auto-refresh");
            showToast(
              "warning",
              "自动签到",
              "检测到页面可能进入过睡眠状态，可能原因：①页面被浏览器的标签页节能策略限制、②计算机进入过睡眠状态，建议您：①添加雨课堂域名到浏览器的节能白名单、②关闭计算机的自动睡眠功能",
              0,
            );
          } else {
            location.reload();
          }
        },
        intervalMin * 60 * 1000,
      );
    }
  }

  private _showEnterClassroomModal(item: OnLessonClassroomItem): void {
    const modalId = "yuketang-js-enter-classroom-modal";
    $(`#${modalId}`).remove();

    const optionsHtml = FINGERPRINT_OPTIONS.map(
      (opt) => `<option value="${opt.value}">${opt.label}</option>`,
    ).join("");

    const html = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Yuketang-JS 签到并进入教室</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <p class="mb-1">您将要进入的教室是：</p>
                <div class="rounded px-3 py-2 mb-2" style="background: #f0f4ff; font-size: 0.95rem;">
                  <div>课程名称 ${item.courseName} (${item.courseId})</div>
                  <div>教室名称 ${item.classroomName} (${item.classroomId})</div>
                  <div>本次课堂 ID ${item.lessonId}</div>
                </div>
              </div>
              <div class="mb-3">
                <label for="yuketang-js-fingerprint-select" class="form-label">请选择签到指纹：</label>
                <select class="form-select" id="yuketang-js-fingerprint-select">
                  ${optionsHtml}
                </select>
              </div>
              <small class="text-muted">签到指纹仅在您首次进入课堂时会被记录。</small>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
              <button type="button" class="btn btn-primary" id="yuketang-js-enter-confirm-btn">确定</button>
            </div>
          </div>
        </div>
      </div>
    `;

    $("body").append(html);
    const $modal = $(`#${modalId}`);
    const modalInstance = new bootstrap.Modal($modal[0]);

    // Set default fingerprint from config
    const checkinConfig = config.getCheckinConfig();
    $(`#yuketang-js-fingerprint-select`).val(checkinConfig.defaultFingerprint);

    $("#yuketang-js-enter-confirm-btn").on("click", () => {
      const source = $("#yuketang-js-fingerprint-select").val() as string;
      const url = `https://www.yuketang.cn/lesson/fullscreen/v3/${item.lessonId}?source=${source}`;
      window.open(url, "_blank");
      addCheckedLesson(item.lessonId);
      modalInstance.hide();
    });

    $modal.on("hidden.bs.modal", () => {
      $modal.remove();
    });

    modalInstance.show();
  }
}
