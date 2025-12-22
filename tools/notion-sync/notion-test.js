require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function testConnection() {
  console.log('正在测试 Notion 连接...\n');

  try {
    // 测试1: 获取当前用户信息
    console.log('📍 测试1: 获取用户信息');
    const user = await notion.users.me();
    console.log('✅ 连接成功！');
    console.log(`   用户类型: ${user.type}`);
    console.log(`   Bot ID: ${user.id}\n`);

    // 测试2: 搜索所有可访问的内容
    console.log('📍 测试2: 搜索可访问的页面和数据库');
    const search = await notion.search({
      page_size: 50
    });

    // 分类结果
    const databases = search.results.filter(item => item.object === 'database');
    const pages = search.results.filter(item => item.object === 'page');

    console.log(`✅ 找到 ${databases.length} 个数据库, ${pages.length} 个页面\n`);

    if (databases.length > 0) {
      console.log('可访问的数据库列表:');
      databases.forEach((db, index) => {
        const title = db.title?.[0]?.plain_text || '(无标题)';
        console.log(`   ${index + 1}. ${title}`);
        console.log(`      ID: ${db.id}`);
        console.log(`      最后编辑: ${db.last_edited_time}\n`);
      });
    }

    if (pages.length > 0) {
      console.log('可访问的页面列表:');
      pages.forEach((page, index) => {
        const title = page.properties?.title?.title?.[0]?.plain_text ||
                     page.properties?.Name?.title?.[0]?.plain_text ||
                     '(无标题)';
        console.log(`   ${index + 1}. ${title}`);
        console.log(`      ID: ${page.id}`);
        console.log(`      最后编辑: ${page.last_edited_time}\n`);
      });
    }

    if (databases.length === 0 && pages.length === 0) {
      console.log('⚠️  警告: 没有找到可访问的页面或数据库');
      console.log('   请确保已将 integration 添加到你想同步的页面/数据库中');
      console.log('   操作步骤: 打开页面 → 点击右上角 "..." → "Add connections" → 选择你的 integration\n');
    }

    console.log('========================================');
    console.log('✅ 连接测试完成！Integration 工作正常。');
    if (databases.length === 0 && pages.length === 0) {
      console.log('\n💡 提示: 请记得将 integration 添加到你要同步的页面中。');
    }

  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('\n错误详情:', error);

    if (error.code === 'unauthorized') {
      console.error('\n可能的原因:');
      console.error('1. Token 不正确');
      console.error('2. Integration 已被删除或禁用');
    }
  }
}

testConnection();
