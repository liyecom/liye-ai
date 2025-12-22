require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs');
const pathConfig = require('./.paths.config.json');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function analyzeNotionContent() {
  console.log('📊 开始分析 Notion 内容结构...\n');

  try {
    // 1. 获取所有页面
    const search = await notion.search({
      page_size: 100,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });

    console.log(`找到 ${search.results.length} 个页面\n`);

    // 2. 分析和分类
    const analysis = {
      categories: {},
      all_pages: []
    };

    for (const page of search.results) {
      if (page.object !== 'page') continue;

      // 提取页面信息
      const title = extractTitle(page);
      const category = categorizeByTitle(title);

      const pageInfo = {
        id: page.id,
        title: title,
        category: category,
        url: page.url,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        icon: page.icon,
        cover: page.cover
      };

      // 按分类统计
      if (!analysis.categories[category]) {
        analysis.categories[category] = [];
      }
      analysis.categories[category].push(pageInfo);
      analysis.all_pages.push(pageInfo);

      // 获取页面内容（前几个块）
      try {
        const blocks = await notion.blocks.children.list({
          block_id: page.id,
          page_size: 5
        });
        pageInfo.preview_blocks = blocks.results.length;
        pageInfo.has_content = blocks.results.length > 0;
      } catch (error) {
        pageInfo.preview_blocks = 0;
        pageInfo.has_content = false;
      }

      // 延迟避免API限流
      await sleep(100);
    }

    // 3. 生成分析报告
    const report = generateReport(analysis);

    // 4. 保存结果
    fs.writeFileSync(
      pathConfig.analysisFile,
      JSON.stringify(analysis, null, 2)
    );

    fs.writeFileSync(
      pathConfig.reportFile,
      report
    );

    console.log('\n✅ 分析完成！');
    console.log('📄 详细数据: notion-analysis.json');
    console.log('📊 分析报告: notion-analysis-report.md\n');

    // 打印摘要
    console.log('=== 分类摘要 ===\n');
    Object.keys(analysis.categories).sort().forEach(cat => {
      console.log(`${cat}: ${analysis.categories[cat].length} 个页面`);
    });

  } catch (error) {
    console.error('❌ 分析失败:', error.message);
  }
}

function extractTitle(page) {
  // 尝试多种方式提取标题
  if (page.properties?.title?.title?.[0]?.plain_text) {
    return page.properties.title.title[0].plain_text;
  }
  if (page.properties?.Name?.title?.[0]?.plain_text) {
    return page.properties.Name.title[0].plain_text;
  }
  if (page.properties?.['名称']?.title?.[0]?.plain_text) {
    return page.properties['名称'].title[0].plain_text;
  }
  return '(无标题)';
}

function categorizeByTitle(title) {
  // 智能分类
  if (title.includes('(无标题)')) return '未分类';

  // 跨境电商相关
  if (title.match(/amazon|亚马逊|tiktok|跨境|电商|运营|店铺/i)) {
    return '跨境电商';
  }

  // AI工具相关
  if (title.match(/ai|智能体|prompt|提示词|midjourney|cursor|claude|gpt/i)) {
    return 'AI工具';
  }

  // 创业想法
  if (title.match(/想法|idea|产品/i)) {
    return '创业想法';
  }

  // 技术学习
  if (title.match(/github|代码|技术|开发|网站|api/i)) {
    return '技术学习';
  }

  // 个人成长
  if (title.match(/成长|学习|交流|会议|记录|日记|journal/i)) {
    return '个人成长';
  }

  // 医疗健康
  if (title.match(/健康|医疗|暖言/i)) {
    return '医疗健康';
  }

  // 星座命理
  if (title.match(/星座|命理|心理|测试/i)) {
    return '星座命理';
  }

  // 工具整合
  if (title.match(/integration|genspark/i)) {
    return '工具整合';
  }

  return '其他';
}

function generateReport(analysis) {
  let report = `# Notion 内容分析报告

**生成时间**: ${new Date().toLocaleString('zh-CN')}
**总页面数**: ${analysis.all_pages.length}

---

## 📊 分类统计

`;

  // 分类统计
  const categories = Object.keys(analysis.categories).sort();
  categories.forEach(cat => {
    const pages = analysis.categories[cat];
    report += `### ${cat} (${pages.length} 个)\n\n`;

    pages.forEach((page, idx) => {
      const hasContent = page.has_content ? '📝' : '📄';
      report += `${idx + 1}. ${hasContent} **${page.title}**\n`;
      report += `   - 最后编辑: ${page.last_edited_time.split('T')[0]}\n`;
      report += `   - 链接: ${page.url}\n`;
      report += `\n`;
    });

    report += `\n`;
  });

  // 融合建议
  report += `---

## 💡 与本地系统融合建议

### 建议1: PARA 映射

根据分析，建议将 Notion 页面映射到你的 PARA 结构：

#### 20 Areas/ (领域索引)
- **跨境电商.md** ← 索引 "${analysis.categories['跨境电商']?.length || 0} 个跨境电商页面"
- **AI工具使用.md** ← 索引 "${analysis.categories['AI工具']?.length || 0} 个 AI 工具页面"
- **技术能力.md** ← 索引 "${analysis.categories['技术学习']?.length || 0} 个技术学习页面"
- **个人成长.md** ← 索引 "${analysis.categories['个人成长']?.length || 0} 个个人成长页面"
- **健康医疗.md** ← 索引 "${analysis.categories['医疗健康']?.length || 0} 个医疗健康页面"

#### 10 Projects/ (项目)
- **创业孵化.md** ← 索引 "${analysis.categories['创业想法']?.length || 0} 个创业想法"

#### 30 Resources/ (资源)
- **Notion知识库.md** ← 统一的 Notion 资源索引

### 建议2: 自动同步策略

**每小时检查更新的页面**：
\`\`\`javascript
// 监控最近1小时编辑的页面
// 发送通知或更新本地索引
\`\`\`

**手动触发深度同步**：
\`\`\`bash
# 每周执行一次，更新 PARA 索引文件
/notion-sync
\`\`\`

### 建议3: 精华提炼流程

**Notion (在线)**
  ↓ 内容成熟
**提炼到本地**
  ↓ 结构化
**整合到 Skills 或 LiYe OS**

---

## 🎯 下一步行动

1. [ ] 在 \`20 Areas/\` 创建/更新领域索引文件
2. [ ] 创建每小时轮询脚本
3. [ ] 配置通知机制（页面更新时提醒）
4. [ ] 设置每周深度同步流程

`;

  return report;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

analyzeNotionContent();
