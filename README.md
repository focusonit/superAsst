# SuperAsst

Educational **personal-assistant Super-agent demo** (Vite + React + TypeScript).

Visualizes the architecture from DeepSeek’s *Exploring Super-agent Design*:

- **Router** (resident timeline) + parallel **Workers**
- **Triggers / Threads** with **subscription direct-delivery**
- Accept modes: `off` | `observe` | `auto`
- **Watchdog** stall detection
- Fake event injectors (email / calendar / IM / todo)
- Scripted scenario button

> **Disclaimer:** Teaching demo **inspired by** the paper and the open prototype. **Not affiliated with, endorsed by, or part of DeepSeek.**  
> Design write-up: https://offloop.org/learn/exploring-deepseek-super-agent-design  
> Upstream coding prototype: https://github.com/deepseek-ai/dsh-superagent-prototype

---

## 中文简介

这是一个**可点击的架构演示台**，不是生产级助理。默认用**本地确定性规则**离线跑通全流程；若配置 DeepSeek API Key，可将 Router 评估切到 **LLM**（失败自动回退规则）。

### 快速开始（离线 Demo）

```bash
pnpm install   # 或 npm install
pnpm dev       # http://localhost:5173
```

打开页面后点 **「脚本演示 Scenario」**，或手动注入事件。无需任何 API Key。

### 可选：接入 DeepSeek LLM

1. 在 [DeepSeek Platform](https://platform.deepseek.com/) 创建 API Key  
2. 复制环境变量模板并填写（**不要**用 `VITE_` 前缀，密钥只留在服务端）：

```bash
cp .env.example .env
# 编辑 .env：
# DEEPSEEK_API_KEY=sk-...
# DEEPSEEK_BASE_URL=https://api.deepseek.com
# DEEPSEEK_MODEL=deepseek-chat
```

3. 另开终端启动本地代理，再开前端：

```bash
pnpm dev:api          # 读取 .env，默认 :8787
pnpm dev              # Vite 将 /api 代理到 8787
```

若没有 `.env`，可用 `pnpm dev:api:noenv`（此时 status 会显示不可用）。

4. 在 UI 点 **「刷新 LLM」**，再把决策后端切到 **DeepSeek LLM**。

### 构建

```bash
pnpm build
pnpm preview
```

### 目录

```
src/domain/     # 类型、接单规则、Source
src/engine/     # Router/Worker/Watchdog 状态机、假事件、LLM 客户端
src/ui/         # 面板组件
server/         # DeepSeek OpenAI-compatible 本地代理
```

### 架构对照

| 论文概念 | 本演示 |
|---------|--------|
| Router | 中央时间线 + 分派 / 短回复 |
| Worker | 看板卡片，独立进度与日志 |
| Trigger → Thread | 注入事件；同 `threadKey` 归并 |
| 订阅直达 | Thread 绑定 Worker 后后续事件标「直达订阅」 |
| observe / auto | 顶部接单开关 |
| Watchdog | 心跳超时标红；可「模拟空转」 |

MIT License.
