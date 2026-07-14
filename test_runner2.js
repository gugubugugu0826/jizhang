const WebSocket = globalThis.WebSocket;
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://localhost:9222/devtools/page/8215A807B6547189414D151087B4D891';
const OUT_DIR = process.argv[2] || '.';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function cdpExec(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise((resolve, reject) => {
    const handler = (e) => {
      try {
        const d = JSON.parse(e.data || e);
        if (d.id === id) { ws.removeEventListener('message', handler); resolve(d); }
      } catch {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.removeEventListener('message', handler); reject(new Error('timeout')); }, 15000);
  });
}

async function evalJS(ws, expr) {
  const r = await cdpExec(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value ?? r.result?.result;
}

async function screenshot(ws, filename) {
  await evalJS(ws, `new Promise(r => setTimeout(r, 500))`);
  const r = await cdpExec(ws, 'Page.captureScreenshot', { format: 'png', fromSurface: true });
  if (r.result?.data) {
    const p = path.join(OUT_DIR, filename);
    fs.writeFileSync(p, Buffer.from(r.result.data, 'base64'));
    console.log(`Screenshot: ${p}`);
    return p;
  }
  console.log(`Screenshot failed:`, JSON.stringify(r).slice(0, 200));
}

async function main() {
  const ws = new WebSocket(WS_URL);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  console.log('CDP connected');
  await cdpExec(ws, 'Page.enable');
  await cdpExec(ws, 'Runtime.enable');
  await sleep(500);

  const people = await evalJS(ws, `window.api.getPeople()`);
  console.log('People:', JSON.stringify(people.map(p => ({id:p.id, name:p.name}))));

  // ========== 测试A：updateExpense 不更新 balance_records ==========
  console.log('\n--- 测试A：updateExpense 是否更新 balance_records ---');
  // 先清除所有数据
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  // 添加一个花销
  const exp = await evalJS(ws, `window.api.addExpense({
    currency: 'AUD', category1: 'food', category2: 'dinner',
    date: '2025-06-15', note: '测试update',
    items: [{ personId: ${people[0].id}, amount: 10000, note: '' }]
  })`);
  console.log('Added expense:', exp.id, 'total:', exp.totalAmount);
  const balanceBefore = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('Balance before update:', JSON.stringify(balanceBefore.find(b => b.personId === ' + people[0].id + ')));

  // 修改花销：改变分摊人和金额
  const updated = await evalJS(ws, `window.api.updateExpense(${exp.id}, {
    items: [{ personId: ${people[1].id}, amount: 20000, note: '' }]
  })`);
  console.log('Updated expense:', updated?.id, 'total:', updated?.totalAmount);
  const balanceAfter = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('Balance after update:', JSON.stringify(balanceAfter));
  console.log('Expected: person2=20000, person1=0');
  console.log('Actual balance shows if updateExpense synced balance_records');

  // 截图
  await evalJS(ws, `location.hash = '#/balance'`);
  await sleep(800);
  await screenshot(ws, '13_balance_after_update.png');

  // ========== 测试B：SettlementPage 排序（CNY+AUD混合）==========
  console.log('\n--- 测试B：SettlementPage 混合币种排序问题 ---');
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  // 添加 CNY 100 和 AUD 10（汇率 4.8，AUD 10 ≈ CNY 48）
  await evalJS(ws, `window.api.addExpense({
    currency: 'CNY', category1: 'food', category2: 'lunch',
    date: '2025-06-15', note: 'CNY测试',
    items: [{ personId: ${people[0].id}, amount: 10000, note: '' }]
  })`);
  await evalJS(ws, `window.api.addExpense({
    currency: 'AUD', category1: 'transport', category2: 'taxi',
    date: '2025-06-15', note: 'AUD测试',
    items: [{ personId: ${people[1].id}, amount: 1000, note: '' }]
  })`);
  await evalJS(ws, `location.hash = '#/settlement'`);
  await sleep(800);
  await screenshot(ws, '14_settlement_mixed.png');

  // 检查 settlement 数据
  const settleData = await evalJS(ws, `
    (async () => {
      const [cny, aud] = await Promise.all([
        window.api.getPersonStats({ currency: 'CNY' }),
        window.api.getPersonStats({ currency: 'AUD' })
      ]);
      return { cny, aud };
    })()
  `);
  console.log('Settlement data:', JSON.stringify(settleData));

  // ========== 测试C：deletePerson 后检查孤立数据 ==========
  console.log('\n--- 测试C：deletePerson 后孤立数据检查 ---');
  // 先添加一个临时人员并添加花销
  const tempPerson = await evalJS(ws, `window.api.addPerson('临时人员')`);
  console.log('Temp person:', tempPerson.id);
  const tempExp = await evalJS(ws, `window.api.addExpense({
    currency: 'CNY', category1: 'food', category2: 'lunch',
    date: '2025-06-15', note: '临时人员测试',
    items: [{ personId: ${tempPerson.id}, amount: 5000, note: '' }]
  })`);
  console.log('Temp expense:', tempExp.id);
  // 删除人员
  await evalJS(ws, `window.api.deletePerson(${tempPerson.id})`);
  // 检查是否有孤立的 expense_items
  const allExpenses = await evalJS(ws, `window.api.getExpenses({})`);
  console.log('Expenses after delete person:', JSON.stringify(allExpenses.expenses.map(e => ({
    id: e.id, items: e.items.map(i => ({ personId: i.personId, personName: i.personName }))
  }))));
  // 检查 balance_records
  const allHistory = await evalJS(ws, `window.api.getBalanceHistory({})`);
  const orphaned = allHistory.filter(r => r.personName === '临时人员');
  console.log('Orphaned balance records for deleted person:', orphaned.length);
  console.log('Orphaned records:', JSON.stringify(orphaned.map(r => ({id:r.id, type:r.type, amount:r.amount}))));

  // ========== 测试D：StatisticsPage tooltip 币种符号 ==========
  console.log('\n--- 测试D：StatisticsPage tooltip 币种符号检查 ---');
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  await evalJS(ws, `window.api.addExpense({
    currency: 'AUD', category1: 'shopping', category2: 'daily',
    date: '2025-06-15', note: 'AUD tooltip test',
    items: [{ personId: ${people[0].id}, amount: 5000, note: '' }]
  })`);
  await evalJS(ws, `location.hash = '#/statistics'`);
  await sleep(800);
  await screenshot(ws, '15_statistics_aud_tooltip.png');

  // 检查饼图 tooltip 配置
  const tooltipCheck = await evalJS(ws, `
    (() => {
      const charts = document.querySelectorAll('[data-echarts-instance]');
      return 'charts count: ' + charts.length;
    })()
  `);
  console.log('Tooltip check:', tooltipCheck);

  // ========== 测试E：HomePage 筛选页码不重置 ==========
  console.log('\n--- 测试E：HomePage 页码筛选问题 ---');
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  // 添加大量数据（25条）
  for (let i = 0; i < 25; i++) {
    await evalJS(ws, `window.api.addExpense({
      currency: 'CNY', category1: 'food', category2: 'lunch',
      date: '2025-06-${String(i%30+1).padStart(2,'0')}', note: '测试数据${i}',
      items: [{ personId: ${people[0].id}, amount: 1000, note: '' }]
    })`);
  }
  console.log('Added 25 expenses');
  await evalJS(ws, `location.hash = '#/'`);
  await sleep(800);
  // 模拟翻到第2页
  await evalJS(ws, `
    const btns = document.querySelectorAll('.ant-pagination-item');
    for (const b of btns) { if (b.textContent === '2') { b.click(); break; } }
  `);
  await sleep(500);
  const page2 = await evalJS(ws, `document.querySelector('.ant-pagination-item-active')?.textContent`);
  console.log('Current page before filter:', page2);
  // 切换币种筛选
  await evalJS(ws, `
    const select = document.querySelector('[placeholder=\"币种\"]');
    if (select) { select.click(); }
  `);
  await sleep(300);
  // 截图
  await screenshot(ws, '16_home_pagination.png');

  // ========== 测试F：AddExpenseModal 金额精度问题 ==========
  console.log('\n--- 测试F：quickSplit 精度测试 ---');
  const splitTest = await evalJS(ws, `
    (() => {
      const total = 10000; // 100元 = 10000分
      const n = 3;
      const per = Math.round(total / n); // 3333分
      const totalSplit = per * n; // 9999分
      return { perPerson: per, totalSplit: totalSplit, diff: total - totalSplit, perPersonYuan: per/100 };
    })()
  `);
  console.log('Split precision test:', JSON.stringify(splitTest));

  // ========== 清理 ==========
  console.log('\n--- 清理测试数据 ---');
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  // 清掉所有 balance_records（手动清理）
  await evalJS(ws, `
    (async () => {
      const history = await window.api.getBalanceHistory({});
      for (const r of history) {
        await window.api.deleteBalanceRecord(r.id);
      }
      return 'cleared ' + history.length + ' records';
    })()
  `);

  ws.close();
  console.log('\n=== 扩展测试完成 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
