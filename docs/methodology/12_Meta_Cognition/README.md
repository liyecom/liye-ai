# 12 Meta Cognition

Thinking about thinking - cognitive optimization skills.

## Domain

Skills in this domain enable agents to:
- Analyze thinking patterns
- Identify cognitive biases
- Optimize decision-making processes
- Improve mental models
- **Design simplified architectures**

## Skills

| Skill | Description | Status |
|-------|-------------|--------|
| `plugin-architecture-design` | 从第一性原理设计轻量核心+按需加载架构 | **Active** |
| `bias-detection` | Identify cognitive biases in reasoning | Planned |
| `mental-model-building` | Create and refine mental models | Planned |
| `reflection-analysis` | Structured self-reflection | Planned |
| `decision-review` | Post-decision analysis and learning | Planned |

## Active Skills

### plugin-architecture-design

**用途**：将"臃肿的完整集成"转化为"轻量核心 + 按需加载"的架构

**核心方法**：
1. 第一性原理分析（用户真正需要什么？）
2. 两轮审议法（功能完整 → 简化）
3. 过度工程化检测（这是给谁用的？）
4. 用户无感知原则

**实战案例**：LiYe OS 技能扩展生态（从 4 周方案简化为 1 周方案）

详见：[skill_definition.md](plugin-architecture-design/skill_definition.md)

## Usage

```yaml
# In agent definition
skills:
  atomic:
    - meta_cognition/plugin_architecture_design
    - meta_cognition/bias_detection
```

## Related Domains

- `09_Learning_Growth` - For learning optimization
- `02_Analysis_Strategy` - For strategic thinking
- `06_Technical_Development` - For implementation patterns
