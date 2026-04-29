import { config } from "./config.js";
import { log } from "./utils.js";
import { showBanner } from "./ui.js";
import OpenAI from "openai";

export interface ExtractedProblem {
  problemId: string;
  problemType: number;
  body: string;
  options?: { key: string; value: string }[];
  blanks?: { num: number }[];
  hasAutoAnswered?: boolean;
}

export class ProblemSolver {
  private problemsDict: Map<string, ExtractedProblem>;

  constructor() {
    this.problemsDict = new Map<string, ExtractedProblem>();
  }

  addProblem(problemId: string, problem: ExtractedProblem) {
    this.problemsDict.set(problemId, problem);
  }

  getProblem(problemId: string): ExtractedProblem | undefined {
    return this.problemsDict.get(problemId);
  }

  getProblemCount(): number {
    return this.problemsDict.size;
  }

  async handleProblem(problemId: string): Promise<void> {
    const problem = this.getProblem(problemId);
    if (!problem) {
      log(`❌ Problem ${problemId} not found in memory`);
      return;
    }

    const llmConfig = config.getLlmConfig();
    if (!llmConfig.baseUrl || !llmConfig.apiKey || !llmConfig.model) {
      log(`❌ LLM configuration is missing. Please set it in the settings.`);
      return;
    }

    const openai = new OpenAI({
      baseURL: llmConfig.baseUrl,
      apiKey: llmConfig.apiKey,
      dangerouslyAllowBrowser: true,
    });

    const prompt = `
You are an expert answering a quiz question.
Please analyze the following question and its options/blanks, and provide the correct answers.

Note:
- Return ONLY valid JSON in the format ["Answer1", "Answer2"].
${problem.blanks ? `- Use the language the question used to answer.` : ""}

Problem Type: ${getProblemTypeName(problem.problemType)} (Type ID: ${problem.problemType})
Body: ${problem.body}
${problem.options ? `Options:\n${problem.options.map((o) => `${o.key}: ${o.value}`).join("\n")}` : ""}
${problem.blanks ? `Blanks: ${problem.blanks.length} blanks to fill.` : ""}
`;

    log(`🧠 Sending problem ${problemId} to LLM...`);

    let result: string[] = [];

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: llmConfig.model,
        thinking: { type: "enabled" },
        reasoning_effort: llmConfig.reasoningEffort,
        stream: false,
      } as any);

      const reply = completion.choices[0]?.message?.content || "[]";
      // Try to extract JSON array
      const match = reply.match(/\[.*\]/s);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        log(`⚠️ Could not parse JSON from LLM: ${reply}`);
        showBanner(`大模型返回的结果无法解析，请手动答题`, "danger");
        return;
      }

      log(`✅ LLM answered: ${JSON.stringify(result)}`);
      showBanner(`大模型返回的答案是：${result.join(", ")}`, "success");
    } catch (err: any) {
      log(`❌ LLM Error: ${err.message}`);
      showBanner(
        `大模型调用出错，请手动答题，错误原因是 ${err.message}`,
        "danger",
      );
      return;
    }

    log(`📤 Submitting answer for ${problemId}...`);
    try {
      const payload = {
        problemId: problem.problemId,
        problemType: problem.problemType,
        dt: Date.now(),
        result: result,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Check global authorization
      const auth = (window as any).Authorization;
      if (auth) {
        headers["Authorization"] = `Bearer ${auth}`;
      }

      const response = await fetch(
        "https://www.yuketang.cn/api/v3/lesson/problem/answer",
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        },
      );

      const setAuth = response.headers.get("Set-Auth");
      if (setAuth) {
        (window as any).Authorization = setAuth;
        log(`🔄 Updated window.Authorization from response`);
      }

      const data = await response.json();
      if (data.code === 0) {
        log(`✅ Answer for problem ${problemId} accepted by server.`);
        showBanner(`自动答题发送成功`, "success");
      } else {
        log(
          `⚠️ Answer for problem ${problemId} submitted but rejected by server. Response: ${JSON.stringify(data)}`,
        );
        showBanner(`自动答题被拒绝接收，因为 ${data.msg}`, "warning");
      }
      problem.hasAutoAnswered = true;
    } catch (err: any) {
      log(
        `❌ Failed to submit answer for problem ${problemId}: ${err.message}`,
      );
      showBanner(`自动答题发送失败，因为 ${err.message}`, "danger");
    }
  }
}

function getProblemTypeName(type: number): string {
  switch (type) {
    case 1:
      return "Single Choice";
    case 2:
      return "Multiple Choice";
    case 4:
      return "Fill in the blank";
    default:
      return "Unknown";
  }
}

export const problemSolver = new ProblemSolver();
