# Yuketang-JS

A Browser Script to Enhance Yuketang Experience  
一个用于提升雨课堂使用体验的浏览器脚本

## 简介 <sub>Introduction</sub>

本项目旨在通过浏览器脚本的形式，提升雨课堂（Yuketang）网页的使用体验。当前版本主要实现了以下功能：

1. **发题提醒和自动答题：**  
   在教师发送题目（或延长题目时间）时，可以通过系统通知的方式提醒用户。在配置了大模型 API 的情况下，可以自动回答单选题、多选题和填空题。
2. **自定义签到指纹：**
   有教室正在上课时，可以在进入课堂之前自定义签到指纹。该功能会在主页“我听的课”页面的底部显示。

更新日志请查阅 [CHANGELOG](CHANGELOG.md)。

## 使用方法 <sub>Usage</sub>

1. 在浏览器中安装 Tampermonkey 扩展程序；
2. 在浏览器的扩展程序设置中打开“开发者模式”；
3. 在 Tampermonkey 中导入脚本文件 [dist/yuketang-js.user.js](dist/yuketang-js.user.js)。

## 开发 <sub>Development</sub>

### 开发（热重载）

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

## 许可证 <sub>Licensing</sub>

本项目基于 MIT 协议，详见 [License](https://github.com/isHarryh/Yuketang-JS/blob/main/LICENSE) 文件。
