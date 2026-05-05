import $ from "jquery";
import "bootstrap/dist/css/bootstrap.css";
import * as bootstrap from "bootstrap";
import { log } from "../utils/log.js";
import { settingsModal } from "./settings-modal.js";
import {
  type OnLessonClassroomItem,
  formatOnLessonItem,
  startOnLessonMonitor,
} from "../utils/on-lesson.js";

const FINGERPRINT_OPTIONS = [
  { value: "1", label: "非 APP 扫二维码(1)" },
  { value: "21", label: "APP 扫二维码(21)" },
  { value: "2", label: "课堂暗号(2)" },
  { value: "5", label: "网页端“正在上课”提示(5)" },
  { value: "9", label: "小程序分享(9)" },
  { value: "30", label: "观看直播回放(30)" },
  { value: "25", label: "上课提醒(25)" },
  { value: "80", label: "腾讯会议(80)" },
  { value: "81", label: "答题器(81)" },
  { value: "82", label: "点阵笔(82)" },
  { value: "83", label: "人脸识别(83)" },
  { value: "26", label: "分享链接(26)" },
  { value: "0", label: "其他(0)" },
];

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
      }
    });
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

    $("#yuketang-js-enter-confirm-btn").on("click", () => {
      const source = $("#yuketang-js-fingerprint-select").val() as string;
      const url = `https://www.yuketang.cn/lesson/fullscreen/v3/${item.lessonId}?source=${source}`;
      window.open(url, "_blank");
      modalInstance.hide();
    });

    $modal.on("hidden.bs.modal", () => {
      $modal.remove();
    });

    modalInstance.show();
  }
}
