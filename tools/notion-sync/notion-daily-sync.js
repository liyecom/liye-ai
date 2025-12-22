require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs');
const pathConfig = require('./.paths.config.json');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const STATE_FILE = pathConfig.stateFile;
const LOG_FILE = pathConfig.logFile;

async function dailySync() {
  const now = new Date();
  console.log(`\n[${ now.toLocaleString('zh-CN')}] 🔍 开始检查 Notion 更新...`);

  try {
    // 读取上次同步时间
    const lastSync = loadLastSyncTime();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const checkTime = lastSync || oneDayAgo;

    console.log(`   上次检查: ${lastSync ? new Date(lastSync).toLocaleString('zh-CN') : '首次运行'}`);

    // 搜索所有页面，按最后编辑时间排序
    const search = await notion.search({
      page_size: 100,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });

    // 过滤出最近1小时更新的页面
    const recentUpdates = search.results.filter(page => {
      return page.object === 'page' && page.last_edited_time > checkTime;
    });

    if (recentUpdates.length > 0) {
      console.log(`\n✨ 发现 ${recentUpdates.length} 个页面有更新：\n`);

      const updates = [];
      for (const page of recentUpdates) {
        const title = extractTitle(page);
        const category = categorizeByTitle(title);

        console.log(`   📝 ${title}`);
        console.log(`      分类: ${category}`);
        console.log(`      更新: ${new Date(page.last_edited_time).toLocaleString('zh-CN')}`);
        console.log(`      链接: ${page.url}\n`);

        updates.push({
          title,
          category,
          url: page.url,
          last_edited: page.last_edited_time
        });
      }

      // 保存更新日志
      appendLog({
        sync_time: now.toISOString(),
        updates_count: recentUpdates.length,
        pages: updates
      });

      console.log(`📄 更新已记录到: ${LOG_FILE}`);
    } else {
      console.log('\n✅ 没有新的更新');
    }

    // 保存本次检查时间
    saveLastSyncTime(now.toISOString());

    const nextCheck = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log(`\n⏰ 下次检查: ${nextCheck.toLocaleString('zh-CN')}`);

  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    if (error.code) {
      console.error(`   错误码: ${error.code}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

function loadLastSyncTime() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data).lastSyncTime;
  } catch {
    return null;
  }
}

function saveLastSyncTime(time) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    lastSyncTime: time,
    lastSyncTimeReadable: new Date(time).toLocaleString('zh-CN')
  }, null, 2));
}

function appendLog(log) {
  const entry = `
${'='.repeat(80)}
同步时间: ${new Date(log.sync_time).toLocaleString('zh-CN')}
发现更新: ${log.updates_count} 个页面
${'='.repeat(80)}

${log.pages.map((p, i) => `${i + 1}. ${p.title}
   分类: ${p.category}
   更新: ${new Date(p.last_edited).toLocaleString('zh-CN')}
   链接: ${p.url}
`).join('\n')}
`;

  fs.appendFileSync(LOG_FILE, entry);
}

function extractTitle(page) {
  if (page.properties?.title?.title?.[0]?.plain_text) {
    return page.properties.title.title[0].plain_text;
  }
  if (page.properties?.Name?.title?.[0]?.plain_text) {
    return page.properties.Name.title[0].plain_text;
  }
  return '(无标题)';
}

function categorizeByTitle(title) {
  if (title.includes('(无标题)')) return '未分类';
  if (title.match(/amazon|亚马逊|tiktok|跨境|电商|运营|店铺/i)) return '跨境电商';
  if (title.match(/ai|智能体|prompt|提示词|midjourney|cursor|claude|gpt/i)) return 'AI工具';
  if (title.match(/想法|idea|产品/i)) return '创业想法';
  if (title.match(/github|代码|技术|开发|网站|api/i)) return '技术学习';
  if (title.match(/成长|学习|交流|会议|记录|日记|journal/i)) return '个人成长';
  if (title.match(/健康|医疗|暖言/i)) return '医疗健康';
  if (title.match(/星座|命理|心理|测试/i)) return '星座命理';
  if (title.match(/integration|genspark/i)) return '工具整合';
  return '其他';
}

// 主程序
console.log('🚀 Notion 每日同步脚本启动');
console.log(`📂 工作目录: ${process.cwd()}`);
console.log(`📄 状态文件: ${STATE_FILE}`);
console.log(`📝 日志文件: ${LOG_FILE}`);
console.log('⏰ 检查频率: 每天一次 (每24小时)');
console.log('');

// 立即执行一次
dailySync();

// 每24小时执行一次 (86400000 毫秒 = 24小时)
setInterval(dailySync, 24 * 60 * 60 * 1000);
