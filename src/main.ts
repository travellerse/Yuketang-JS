import "./style.css";
import { R_HELLO, R_UNLOCK_PROBLEM, R_EXTEND_TIME } from "./enum.js";
import { log, notify, wsMitm, audioController } from "./utils.js";
import { LessonHeaderUI, showBanner } from "./ui.js";
import { XHRSpy } from "./xhr-spy.js";
import { problemSolver } from "./problem-solver.js";
import { config } from "./config.js";

(function (): void {
  "use strict";

  // Set up XHR interceptor
  XHRSpy.add(/\/lesson\/presentation\/fetch/, (json: any) => {
    if (json && json.data && Array.isArray(json.data.slides)) {
      let count = 0;
      for (const slide of json.data.slides) {
        if (slide.problem) {
          const p = slide.problem;
          const extracted = {
            problemId: p.problemId,
            problemType: p.problemType,
            body: p.body,
            hasAutoAnswered: false,
            options: p.options,
            blanks: p.blanks,
          };
          problemSolver.addProblem(p.problemId, extracted);
          count++;
        }
      }
      log(`📄 Extracted ${count} problems from presentation fetch`);
      showBanner(
        `当前课堂总计的题目数量是 ${problemSolver.getProblemCount()} 道`,
        "info",
      );
    }
  });

  const headerUI = new LessonHeaderUI();

  const scheduleAutoAnswer = (problemId: string, limit: string | number) => {
    const aaConfig = config.getAutoAnswerConfig();
    const problem = problemSolver.getProblem(problemId);

    if (aaConfig.enabled && problem && !problem.hasAutoAnswered) {
      const numLimit = typeof limit === "string" ? parseInt(limit, 10) : limit;
      let delayMs = 0;
      if (isNaN(numLimit) || numLimit <= 0) {
        // Not timed
        delayMs = aaConfig.timeAfterSend * 1000;
      } else {
        delayMs = Math.max(0, numLimit - aaConfig.timeLeftThreshold) * 1000;
      }
      log(`🕒 Will run auto answer for ${problemId} in ${delayMs}ms`);

      if (delayMs > 0) {
        showBanner(`将在 ${delayMs / 1000} 秒后准备自动答题`, "info");
      } else {
        showBanner("将立即开始准备自动答题", "info");
      }

      setTimeout(() => {
        const p = problemSolver.getProblem(problemId);
        if (p && !p.hasAutoAnswered) {
          log(`🤖 Auto answering ${problemId}...`);
          problemSolver.handleProblem(problemId).catch(console.error);
        }
      }, delayMs);
    }
  };

  wsMitm.startMitm(".*wsapp.*");

  wsMitm.onReceiveCallback = function (url: string, data: string): void {
    log(`⬇️ Received data from ${url}: ${data}`);
    try {
      const json = JSON.parse(data) as {
        op?: string;
        problem?: { limit?: number; extend?: number; prob?: string };
      };
      if (json && json.op) {
        headerUI.setActive();
        if (json.op === R_HELLO) {
          log("✅ WebSocket MITM is functioning correctly");
        } else if (json.op === R_UNLOCK_PROBLEM) {
          const limit = json.problem ? json.problem.limit || "N/A" : "N/A";
          const problemId = json.problem ? json.problem.prob : undefined;

          notify(
            "⏰ 新的题目",
            `【👉点我消除通知】新的题目已解锁！限时 ${limit} 秒。（Yuketang-JS）`,
          );
          audioController.play();

          log(`🔓 Problem ID is ${problemId}`);
          if (problemId) {
            scheduleAutoAnswer(problemId, limit);
          }
        } else if (json.op === R_EXTEND_TIME) {
          const extend = json.problem ? json.problem.extend || "N/A" : "N/A";
          const problemId = json.problem ? json.problem.prob : undefined;

          notify(
            "⏰ 题目延时",
            `【👉点我消除通知】题目时间已延长 ${extend} 秒。（Yuketang-JS）`,
          );
          audioController.play();

          log(`🔓 Problem ID is ${problemId}`);
          if (problemId) {
            scheduleAutoAnswer(problemId, extend);
          }
        }
      }
    } catch (error) {
      log(`⚠️ Failed to parse WebSocket message: ${error}`);
    }
  };

  wsMitm.onUploadCallback = function (url: string, data: string): void {
    log(`⬆️ Sent data to ${url}: ${data}`);
  };

  log("🚀 Yuketang-JS script successfully loaded!");

  setInterval(function (): void {
    headerUI.update();
  }, 1000);
})();
