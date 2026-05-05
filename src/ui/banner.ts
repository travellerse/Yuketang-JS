import $ from "jquery";
import * as bootstrap from "bootstrap";

const LEVEL_BADGE_CLASS: Record<string, string> = {
  info: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning text-dark",
};

function formatTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function showToast(
  level: "info" | "success" | "danger" | "warning",
  title: string,
  text: string,
  expire_ms: number = 0,
): void {
  const containerId = "yuketang-js-toast-container";
  let $container = $(`#${containerId}`);

  if ($container.length === 0) {
    $container = $(
      `<div id="${containerId}" class="toast-container bottom-0 start-0 p-3" style="z-index: 9999;"></div>`,
    );
    $("body").append($container);
  }

  const badgeClass = LEVEL_BADGE_CLASS[level] ?? "bg-secondary";

  const html = `
    <div class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="false">
      <div class="toast-header">
        <span class="badge ${badgeClass} rounded-pill me-2">&nbsp;</span>
        <strong class="me-auto">[Yuketang-JS] ${title}</strong>
        <small class="text-body-secondary">${formatTime()}</small>
        <button type="button" class="btn-close ms-2" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${text}</div>
    </div>
  `;

  const $toast = $(html);
  $container.append($toast);

  const toastInstance = new bootstrap.Toast($toast[0], {
    autohide: expire_ms > 0,
    delay: expire_ms,
  });
  toastInstance.show();

  $toast.on("hidden.bs.toast", () => {
    $toast.remove();
  });
}
