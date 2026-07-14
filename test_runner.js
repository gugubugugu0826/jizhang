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
  // 先等页面渲染稳定
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

  // ========== 测试准备：清除数据 ==========
  console.log('\n--- 清除所有数据 ---');
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  console.log('Expenses cleared');

  // 获取人员列表
  const people = await evalJS(ws, `window.api.getPeople()`);
  console.log('People:', JSON.stringify(people));

  // ========== 测试1：添加花销并验证联动 ==========
  console.log('\n--- 测试1：添加 AUD 花销 ---');
  const expense1 = await evalJS(ws, `
    window.api.addExpense({
      currency: 'AUD',
      category1: 'food',
      category2: 'dinner',
      date: '2025-06-15',
      note: '测试晚餐',
      items: [
        { personId: ${people[0]?.id || 1}, amount: 5000, note: '' },
        { personId: ${people[1]?.id || 2}, amount: 5000, note: '' }
      ]
    })
  `);
  console.log('Added expense:', JSON.stringify(expense1));

  const balancesBefore = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('AUD balances after expense:', JSON.stringify(balancesBefore));

  // 截图花销记录页面
  await screenshot(ws, '01_home_after_add.png');

  // 导航到欠款结余页面
  await evalJS(ws, `location.hash = '#/balance'`);
  await sleep(800);
  await screenshot(ws, '02_balance_after_add.png');

  // ========== 测试2：删除花销，验证欠款是否同步删除 ==========
  console.log('\n--- 测试2：删除花销后检查欠款 ---');
  await evalJS(ws, `window.api.deleteExpense(${expense1?.id || 1})`);
  console.log('Expense deleted');

  // 导航回欠款页面检查
  await evalJS(ws, `location.hash = '#/balance'`);
  await sleep(800);
  const balancesAfterDelete = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('AUD balances after delete:', JSON.stringify(balancesAfterDelete));
  await screenshot(ws, '03_balance_after_delete_expense.png');

  // 检查变动记录
  await evalJS(ws, `location.hash = '#/history'`);
  await sleep(800);
  const historyAfterDelete = await evalJS(ws, `window.api.getBalanceHistory({currency:'AUD'})`);
  console.log('History after delete:', JSON.stringify(historyAfterDelete));
  await screenshot(ws, '04_history_after_delete.png');

  // ========== 测试3：添加CNY花销，测试分账结算 ==========
  console.log('\n--- 测试3：添加 CNY 花销 ---');
  await evalJS(ws, `location.hash = '#/'`);
  await sleep(500);
  const expense2 = await evalJS(ws, `
    window.api.addExpense({
      currency: 'CNY',
      category1: 'transport',
      category2: 'taxi',
      date: '2025-06-16',
      note: '测试打车',
      items: [
        { personId: ${people[2]?.id || 3}, amount: 3000, note: '' },
        { personId: ${people[3]?.id || 4}, amount: 3000, note: '' }
      ]
    })
  `);
  console.log('Added CNY expense:', JSON.stringify(expense2));

  // 截图统计分析页面
  await evalJS(ws, `location.hash = '#/statistics'`);
  await sleep(800);
  await screenshot(ws, '05_statistics.png');

  // ========== 测试4：测试一键删除所有 ==========
  console.log('\n--- 测试4：一键删除所有花销 ---');
  await evalJS(ws, `location.hash = '#/'`);
  await sleep(500);
  await evalJS(ws, `window.api.deleteAllExpenses()`);
  console.log('All expenses deleted');

  const balancesAfterDeleteAll = await evalJS(ws, `window.api.getBalances('CNY')`);
  console.log('CNY balances after deleteAll:', JSON.stringify(balancesAfterDeleteAll));
  const balancesAfterDeleteAllAUD = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('AUD balances after deleteAll:', JSON.stringify(balancesAfterDeleteAllAUD));

  await evalJS(ws, `location.hash = '#/balance'`);
  await sleep(800);
  await screenshot(ws, '06_balance_after_delete_all.png');

  // ========== 测试5：测试手动记账和清账 ==========
  console.log('\n--- 测试5：手动记账和清账 ---');
  await evalJS(ws, `window.api.addManualBalance(${people[0]?.id || 1}, 'AUD', 10000, '测试借款')`);
  const balancesManual = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('AUD balances after manual:', JSON.stringify(balancesManual));

  await evalJS(ws, `window.api.settlePerson(${people[0]?.id || 1}, 'AUD')`);
  const balancesSettled = await evalJS(ws, `window.api.getBalances('AUD')`);
  console.log('AUD balances after settle:', JSON.stringify(balancesSettled));

  // ========== 测试6：测试人员管理 ==========
  console.log('\n--- 测试6：添加并删除人员 ---');
  const newPerson = await evalJS(ws, `window.api.addPerson('测试人员')`);
  console.log('New person:', JSON.stringify(newPerson));

  // 尝试删除人员
  await evalJS(ws, `window.api.deletePerson(${newPerson?.id})`);
  console.log('Person deleted');

  // 检查是否有孤立数据
  const allPeople = await evalJS(ws, `window.api.getPeople()`);
  console.log('All people:', JSON.stringify(allPeople));

  // ========== 测试7：测试 quickSplit 精度 ==========
  console.log('\n--- 测试7：quickSplit 精度测试 (通过JS模拟) ---');
  // 模拟 quickSplit: Math.round((100 * 100) / 3) = 3333
  const splitTest = await evalJS(ws, `
    const total = 10000;
    const n = 3;
    const per = Math.round(total / n);
    { per, total: per * n, diff: total - per * n }
  `);
  console.log('Split test:', JSON.stringify(splitTest));

  // ========== 测试8：测试统计页面的币种显示 ==========
  console.log('\n--- 测试8：添加 AUD 数据测试统计页面 ---');
  await evalJS(ws, `
    window.api.addExpense({
      currency: 'AUD',
      category1: 'shopping',
      category2: 'daily',
      date: '2025-06-17',
      note: '测试超市',
      items: [{ personId: ${people[0]?.id || 1}, amount: 5000, note: '' }]
    })
  `);
  await evalJS(ws, `location.hash = '#/statistics'`);
  await sleep(800);
  await screenshot(ws, '07_statistics_aud.png');

  // ========== 测试9：测试设置页面 ==========
  console.log('\n--- 测试9：设置页面 ---');
  await evalJS(ws, `location.hash = '#/settings'`);
  await sleep(800);
  await screenshot(ws, '08_settings.png');

  // ========== 测试10：智能录入页面 ==========
  console.log('\n--- 测试10：智能录入页面 ---');
  await evalJS(ws, `location.hash = '#/smart-input'`);
  await sleep(800);
  await screenshot(ws, '09_smart_input.png');

  // ========== 测试11：人员管理页面 ==========
  console.log('\n--- 测试11：人员管理页面 ---');
  await evalJS(ws, `location.hash = '#/people'`);
  await sleep(800);
  await screenshot(ws, '10_people.png');

  // ========== 测试12：变动记录页面 ==========
  console.log('\n--- 测试12：变动记录页面 ---');
  await evalJS(ws, `location.hash = '#/history'`);
  await sleep(800);
  await screenshot(ws, '11_history.png');

  // ========== 测试13：分账结算页面 ==========
  console.log('\n--- 测试13：分账结算页面 ---');
  await evalJS(ws, `location.hash = '#/settlement'`);
  await sleep(800);
  await screenshot(ws, '12_settlement.png');

  ws.close();
  console.log('\n=== 所有测试完成 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
