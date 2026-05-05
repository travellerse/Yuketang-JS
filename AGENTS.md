# AGENTS.md - Yuketang-JS

此文件是给 AI 编码智能体提供的说明文档，描述了对本项目进行编码工作时的要求和指引。

## 编码要求

### 文件自更新

每次修改功能后，如果此文件所陈述的内容已过期，**务必**更新当前文件的对应内容。

此文件的内容会被智能体用来理解项目结构、功能和开发流程，保持其准确性对于智能体正确执行编码任务至关重要。

但不宜将此文件的内容写得过于冗杂，建议只保留关键的内容、信息差最大的内容，以及对智能体执行编码任务有直接帮助的内容。

### 工作流规范

使用用户和你对话的语言来回答用户的问题。使用英文来撰写代码中的注释、日志文本。使用中文来撰写 UI 中的文本内容。

允许运行 `pnpm build` 来构建项目，但禁止运行 `pnpm dev`。

## 项目简介

Yuketang-JS 是一个 Tampermonkey 用户脚本，运行在雨课堂（yuketang.cn）页面上。主要功能：

- 拦截 WebSocket 消息，监听课堂中的题目解锁、延时等事件
- 拦截 XHR 响应，提取题目数据
- 通过大模型（LLM）自动答题
- 桌面通知 + 音频提醒
- 提供设置界面，支持多标签页配置同步检测

技术栈：TypeScript + Vite + vite-plugin-monkey + jQuery + Bootstrap + OpenAI SDK。

## 代码结构

```
src/
├── main.ts                     入口文件，串联所有模块
├── config.ts                   配置管理（GM 存储读写、哈希校验、跨标签页监测）
├── enum.ts                     WebSocket 协议常量（op 字段值）
├── data.ts                     内嵌的 base64 音频数据
├── problem-solver.ts           LLM 自动答题引擎
├── vite-env.d.ts               TypeScript 环境类型声明
│
├── ui/
│   ├── banner.ts               页面顶部 toast 通知横幅
│   ├── header.ts               课堂页面头部 UI（状态徽章 + 通知测试 + 设置按钮）
│   ├── general-header.ts       通用页面头部 UI（仅设置按钮，适配 .headerButtonGroup）
│   └── settings-modal.ts       设置模态框（音频/LLM/自动答题三个 tab）+ 配置过期警告
│
└── utils/
    ├── log.ts                  控制台日志（带 [Yuketang-JS] 前缀，无依赖）
    ├── notify.ts               桌面通知（GM_notification 封装）
    ├── audio-controller.ts     音频播放控制器（单例）
    ├── ws-mitm.ts              WebSocket 中间人拦截器（单例）
    └── xhr-spy.ts              XHR 响应拦截器（静态类）
```

### 依赖关系图

```
enum.ts, data.ts          (叶子节点，无依赖)
     │
utils/log.ts              (叶子节点，无依赖)
     │
     ├── utils/notify.ts
     ├── utils/ws-mitm.ts
     └── utils/audio-controller.ts  ──┐
                                      │
config.ts ────────────────────────────┘
     │
     └── ui/settings-modal.ts
              │
              ├── ui/header.ts
              └── ui/general-header.ts
                      │
ui/banner.ts          │
     │                │
     └── problem-solver.ts
               │
main.ts ───────┘  (顶层编排)
```

无循环依赖。`config.ts` 导入 `settings-modal.ts`（仅用于默认 onChange 回调），`settings-modal.ts` 导入 `config.ts`（用于读写配置），但这不会造成运行时问题，因为所有导入都延迟在函数体内使用。

## 工作逻辑

### 脚本启动流程（main.ts）

1. **XHR 拦截注册**：`XHRSpy` 监听 `/lesson/presentation/fetch` 响应，从返回的 slides 中提取题目信息，存入 `problemSolver`
2. **UI 初始化**：创建 `LessonHeaderUI` 和 `GeneralHeaderUI` 实例（各自按需注入 DOM）
3. **WebSocket MITM 启动**：`wsMitm.startMitm(".*wsapp.*")` 替换全局 WebSocket，开始拦截
4. **注册消息回调**：
   - `R_HELLO`：记录连接成功
   - `R_UNLOCK_PROBLEM`：发送桌面通知 + 播放音频 + 调度自动答题
   - `R_EXTEND_TIME`：发送延时通知 + 播放音频 + 重新调度自动答题
5. **启动配置监测**：`config.startConfigChangeMonitor()` 每 10 秒检查一次跨标签页配置变更
6. **定时 UI 刷新**：每秒调用 `headerUI.update()` 和 `generalHeaderUI.update()`

### 自动答题逻辑

```
题目解锁 → scheduleAutoAnswer(problemId, limit)
  ├── 限时题目：delay = max(0, limit - timeLeftThreshold) 秒
  └── 不限时题目：delay = timeAfterSend 秒
        │
        └── setTimeout → problemSolver.handleProblem(problemId)
              ├── 调用 LLM（OpenAI 兼容接口）获取答案
              ├── 解析 JSON 数组格式的答案
              └── POST 到 /api/v3/lesson/problem/answer 提交
```

### 多标签页配置同步

配置存储在 Tampermonkey 的 GM_setValue 中，所有标签页共享同一份数据。

**问题**：标签页 A 修改了配置，标签页 B 的内存中仍是旧值。

**解决方案**：

1. 每次保存配置时，计算配置内容的 DJB2 哈希值，一并存入 GM 存储的 `hash` 字段
2. 脚本启动后，`config.startConfigChangeMonitor()` 每 10 秒执行一次：
   - 从 GM 存储重新读取配置
   - 计算其哈希值
   - 与内存中的哈希值比较
3. 若不一致，弹出警告模态框：
   - **忽略**：关闭警告，继续使用旧配置
   - **刷新**：调用 `config.reloadFromStorage()` 从 GM 重新加载，然后 `location.reload()`
4. 默认 `fastStop = true`：检测到一次变更后停止监测，避免重复弹窗

**时序**：

```
标签页 A                   标识页 B
   │                         │
   ├── 修改配置 ──→ GM 存储 ──┤
   │   (hash: "abc")         │
   │                         ├── 10s 定时器触发
   │                         ├── 读取 GM 存储 (hash: "abc")
   │                         ├── 比较内存 hash ("xyz") ≠ "abc"
   │                         ├── 停止监测 (fastStop)
   │                         └── 弹出警告模态框
```

### 两种页面适配

脚本匹配 `https://*.yuketang.cn/*`，可能运行在不同类型的页面上：

- **课堂页面**（有 `.lesson__header`）：`LessonHeaderUI` 注入状态徽章 + 测试通知按钮 + 设置按钮
- **其他页面**（有 `.headerButtonGroup`）：`GeneralHeaderUI` 仅注入设置按钮

两个 UI 类都通过 `setInterval` 每秒调用 `update()`，各自检查目标 DOM 元素是否存在，不存在则跳过（自适应注入）。
