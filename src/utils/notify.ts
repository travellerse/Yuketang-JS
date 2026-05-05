import { log } from "./log.js";

export function notify(title: string, text: string): void {
  // https://www.tampermonkey.net/documentation.php?locale=en#api:GM_notification
  if (typeof GM_notification === "function") {
    GM_notification({
      text: text,
      title: title,
      image: "https://www.yuketang.cn/static/images/favicon.ico",
      highlight: true,
      timeout: 3600 * 1000,
    });
    log(`🔈 Notification sent: ${title}`);
  } else {
    log("⚠️ Notification not available");
  }
}
