import { problemsDict } from "./main.js";
import { config } from "./config.js";
import { log } from "./utils.js";
import { showBanner } from "./ui.js";
import OpenAI from "openai";

export async function handleProblem(problemId: string): Promise<void> {
  const problem = problemsDict.get(problemId);
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
    showBanner(`大模型返回的结果是：${result.join(", ")}`, "success");
  } catch (err: any) {
    log(`❌ LLM Error: ${err.message}`);
    showBanner(`大模型调用出错: ${err.message}`, "danger");
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
    log(`✅ Answer submitted. Response: ${JSON.stringify(data)}`);
    showBanner(`已成功发送自动答题`, "success");
    problem.hasAutoAnswered = true;
  } catch (err: any) {
    log(`❌ Failed to submit answer: ${err.message}`);
    showBanner(`未能成功发送自动答题: ${err.message}`, "warning");
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
