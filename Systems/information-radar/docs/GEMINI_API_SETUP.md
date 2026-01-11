# Gemini API Setup Guide

本指南帮助你配置 Google Gemini API 用于 Information Radar 的中文摘要功能。

## 获取 API Key

### 1. 访问 Google AI Studio

打开 [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. 创建 API Key

1. 点击 **Create API key**
2. 选择项目（或创建新项目）
3. 复制生成的 API key

### 3. API Key 格式

API key 格式类似：`AIza...` (约 40 个字符)

## 配置到 Cloudflare Workers

### 方式 1: 使用 wrangler secret (推荐)

```bash
cd systems/information-radar
npx wrangler secret put GEMINI_API_KEY
# 粘贴你的 API key
```

### 方式 2: 本地开发用 .dev.vars

创建 `.dev.vars` 文件（不要提交到 git）:

```
GEMINI_API_KEY=your_api_key_here
PUSHPLUS_TOKEN=your_pushplus_token
PH_ACCESS_TOKEN=your_ph_token
```

## Gemini API 配额

### 免费额度 (Free tier)

| 模型 | RPM (请求/分钟) | TPM (Token/分钟) | RPD (请求/天) |
|------|-----------------|------------------|---------------|
| Gemini 2.0 Flash | 15 | 1,000,000 | 1,500 |
| Gemini 1.5 Flash | 15 | 1,000,000 | 1,500 |
| Gemini 1.5 Pro | 2 | 32,000 | 50 |

### Information Radar 使用预估

- 每分钟轮询 1 次
- 平均每次 0-5 个新 item
- 每个 item 约 500 tokens
- **日均**: 500-1000 请求 (远低于 1,500 限制)

## 模型选择

Information Radar 默认使用 `gemini-2.0-flash`：
- 速度快
- 成本低
- 免费额度大
- 中文摘要效果好

如需更改模型，修改 `src/config.ts`:

```typescript
gemini: {
  model: "gemini-1.5-pro",  // 或其他模型
  apiUrl: "https://generativelanguage.googleapis.com/v1beta/models",
},
```

## 测试 API

```bash
# 测试 API 是否正常工作
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts":[{"text": "Say hello in Chinese"}]
    }]
  }'
```

预期响应:

```json
{
  "candidates": [{
    "content": {
      "parts": [{"text": "你好！(Nǐ hǎo!)"}]
    }
  }]
}
```

## 常见问题

### API_KEY_INVALID

- 检查 key 是否复制完整
- 确认 key 没有多余空格
- 尝试重新生成 key

### QUOTA_EXCEEDED

- 检查是否超过 RPM 限制
- 等待 1 分钟后重试
- 考虑升级到付费版

### PERMISSION_DENIED

- 确认 API 已启用 Generative Language API
- 检查项目配额设置

## 付费升级

如需更高配额:

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 启用 Generative Language API 的付费版
3. 设置 billing account

**定价** (2024-12):
- Gemini 2.0 Flash: $0.075 / 100万 input tokens
- Gemini 1.5 Pro: $3.50 / 100万 input tokens

对于 Information Radar，免费额度通常足够。

---

**Version**: 0.1.0
**Last Updated**: 2026-01-09
