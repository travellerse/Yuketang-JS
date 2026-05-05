import $ from "jquery";

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
