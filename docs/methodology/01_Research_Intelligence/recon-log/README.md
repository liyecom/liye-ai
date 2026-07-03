# recon-log — 进化情报侦察归档

「研究一个**已知** GitHub 项目，判断对 LiYe Systems 进化有没有可借鉴之处」的定型报告归档。

## 定位（跟邻居的区别）

| 步骤 | 工具 | 干什么 |
|------|------|--------|
| **侦察判断**（本目录） | evolution recon（研究 subagent + 模板） | 已知 repo → 读懂 → 判断对 LiYe 有没有用（verdict） |
| 发现 | [`github-scout`](../github-scout/) | 未知 → 搜候选 + license 卡关（advisory） |
| 受控 intake | `tools/source-intake/` | 确定要拉进来 → pin + 审计 → 治理 artifact |

recon 站在 scout / source-intake 的**上游**：它回答「这东西值不值得我们上心」。它**只读、clean-room、绝不 vendor**——任何复用要走 harvest-ADR / Reference Declaration（SYSTEMS.md Fork 纪律）。

## 报告契约

每条 recon 是一份 `YYYY-MM-DD-<repo-slug>.md`，带 frontmatter（`repo/url/date/verdict/layer_relevance/license/evidence/watch_trigger`）+ 6 段定型正文：
1. 是什么（定位 + 成熟度信号）
2. 核心思想（3–5 点，概念级）
3. 对 LiYe 哪一层有关
4. 可借鉴 pattern（每条标注「思想借鉴 / 非代码复用」）
5. **Verdict**：`ignore` | `watch` | `harvest-adr-candidate`
6. 下一步

结尾附**证据强度声明**（哪些源码确认、哪些是架构推断）。

## 索引

| 日期 | Repo | Verdict | LiYe 层 | 一句话 |
|------|------|---------|---------|--------|
| 2026-07-01 | [openhuman](./2026-07-01-openhuman.md) | 🟡 watch | L0(主), L1 | agentic 桌面助手；turn-origin 信任标签/taint/fail-closed 闸门/verdict 契约 是 LiYe 治理教义的生产级平行实现；⚠️ **GPL-3.0** 只可概念参照 |
| 2026-07-01 | [redash](./2026-07-01-redash.md) | 🟡 watch | L2(主, AGE), L0 | 开源 BI 平台；连接器契约 + 内容寻址结果快照/freshness 门 + tri-state fail-safe 告警 直指 AGE 多源接入/指标层；BSD-2，模式参考库 |
| 2026-07-01 | [agency-agents](./2026-07-01-agency-agents.md) | 🟡 watch | L0(主), L1 | 232-agent 人格 prompt 目录 + 多宿主 shell 适配；`tools.json` 分发契约/反换皮门禁/soul-hands 切分与 liye_os 同构，但无 runtime/治理语义 |

**Verdict 图例**：🔴 ignore · 🟡 watch · 🟢 harvest-adr-candidate
