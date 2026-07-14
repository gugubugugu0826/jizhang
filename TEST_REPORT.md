# 记账APP v2.0.0 功能测试报告

**测试日期：** 2025-07-13  
**测试环境：** Windows 11 + Electron 33 + Node.js 24.15.0  
**测试方法：** 代码审查 + CDP 自动化测试 + 截图验证  
**测试人员：** 软件测试工程师

---

## 测试范围

本次测试覆盖了记账APP的全部 8 个页面和核心功能模块：

| 页面 | 覆盖场景 |
|------|---------|
| 智能录入 | 本地解析、AI解析、解析结果弹窗 |
| 花销记录 | 添加/删除/批量删除/筛选/分页 |
| 统计分析 | 饼图/柱状图/币种筛选/日期筛选 |
| 分账结算 | 日期范围筛选/每人明细/合计 |
| 欠款结余 | 自动同步/手动记账/一键清账 |
| 变动记录 | 筛选/删除/历史流水 |
| 人员管理 | 增删改/预置人员 |
| 设置 | 汇率配置/关于信息 |

---

## 问题汇总（按严重程度排序）

### 🔴 严重问题

#### BUG-1：删除单条花销后，关联欠款记录不删除（数据不一致）

| 项目 | 内容 |
|------|------|
| **严重程度** | 严重 |
| **影响模块** | 花销记录、欠款结余、变动记录 |
| **代码位置** | `src/main/database.ts:299-302` |

**复现步骤：**
1. 添加一条 AUD 100.00 的花销，分摊给廖泽平和黄柏清各 50.00
2. 查看"欠款结余"页面，确认两人各欠 50.00 AUD
3. 在"花销记录"页面删除该条花销
4. 再次查看"欠款结余"页面

**预期行为：** 廖泽平和黄柏清的 AUD 欠款应归零（因为对应花销已删除）

**实际行为：** 两人的 AUD 欠款仍为 50.00，欠款记录没有被同步删除

**根因分析：**
`deleteExpense` 函数只执行了 `DELETE FROM expenses WHERE id = ?`，但 `balance_records` 表中关联的 `expense` 类型记录没有被删除。数据库外键约束中 `balance_records` 的 `expense_id` 没有 `ON DELETE CASCADE`。

**截图证据：**

![删除花销后欠款未更新](test_results/03_balance_after_delete_expense.png)

> 截图显示：删除花销后，廖泽平仍"欠我 $100.00"，黄柏清仍"欠我 $100.00"。注意图中余额是之前测试数据+新数据的叠加，但核心问题是删除操作没有同步清理 balance_records。

---

#### BUG-2：一键删除所有花销后，欠款记录未清理（数据污染）

| 项目 | 内容 |
|------|------|
| **严重程度** | 严重 |
| **影响模块** | 花销记录、欠款结余 |
| **代码位置** | `src/main/database.ts:311-315` |

**复现步骤：**
1. 添加多条花销记录
2. 点击"一键删除所有"确认删除
3. 查看"欠款结余"页面

**预期行为：** 所有欠款余额归零（因为所有花销已删除，无分摊基础）

**实际行为：** 欠款余额仍然存在，所有 `balance_records` 的 `expense` 类型记录未被删除

**根因分析：**
`deleteAllExpenses` 函数只执行了 `DELETE FROM expenses`，没有清理 `balance_records` 表。

**测试数据：**
```
一键删除所有后：
- CNY balances: 张先澍 3000分, 刘承洲 3000分（应全部为0）
- AUD balances: 廖泽平 10000分, 黄柏清 10000分（应全部为0）
```

**截图证据：**

![一键删除后欠款未清理](test_results/06_balance_after_delete_all.png)

---

#### BUG-3：修改花销分摊人后，欠款记录不同步更新（数据不一致）

| 项目 | 内容 |
|------|------|
| **严重程度** | 严重 |
| **影响模块** | 花销记录、欠款结余 |
| **代码位置** | `src/main/database.ts:265-297` |

**复现步骤：**
1. 添加一条 AUD 100.00 的花销，分摊给廖泽平
2. 修改该花销，将分摊人改为黄柏清，金额改为 200.00
3. 查看"欠款结余"页面

**预期行为：** 廖泽平欠款归零，黄柏清欠款增加 200.00

**实际行为：** 廖泽平原欠款仍然存在，黄柏清的欠款没有增加

**根因分析：**
`updateExpense` 函数更新了 `expenses` 和 `expense_items`，但完全没有更新 `balance_records`。这导致旧的分摊记录仍然有效，新的分摊记录没有被生成。

**截图证据：**

![updateExpense后欠款未同步](test_results/13_balance_after_update.png)

> 截图显示：廖泽平 AUD 余额 $150.00，黄柏清 $100.00。修改花销后，两人的欠款余额均没有正确反映最新的分摊状态。

---

#### BUG-4：删除人员后，产生孤立数据（数据完整性破坏）

| 项目 | 内容 |
|------|------|
| **严重程度** | 严重 |
| **影响模块** | 人员管理、花销记录、欠款结余、变动记录 |
| **代码位置** | `src/main/database.ts:157-160` |

**复现步骤：**
1. 添加一个临时人员"测试人员"
2. 添加一条花销，分摊给该人员
3. 在"人员管理"页面删除该人员
4. 查看"花销记录"和"变动记录"页面

**预期行为：** 与该人员相关的所有数据（expense_items、balance_records）应被清理或级联删除

**实际行为：**
- `expense_items` 中仍存在 `personId=6`（已删除人员）的记录
- `balance_records` 中仍有 1 条孤立记录，关联到已删除人员

**测试数据：**
```
删除"临时人员"后：
- expense_items 中 personId=6 的记录仍然存在
- balance_records 中仍有 1 条孤立记录（id:106, type:expense, amount:5000）
```

**根因分析：**
`deletePerson` 只执行 `DELETE FROM people WHERE id = ?`，但 `expense_items` 表的 `person_id` 外键没有 `ON DELETE CASCADE`，`balance_records` 表的 `person_id` 外键也没有 `ON DELETE CASCADE` 或 `SET NULL`。

---

#### BUG-5：添加花销弹窗中 onSubmit 未被 await，失败时仍显示成功

| 项目 | 内容 |
|------|------|
| **严重程度** | 严重 |
| **影响模块** | 添加花销弹窗 |
| **代码位置** | `src/renderer/src/components/AddExpenseModal.tsx:104` |

**复现步骤：**
1. 打开"添加花销"弹窗
2. 填写所有必填项，点击"确认添加"
3. 如果底层数据库操作失败（如磁盘已满、表损坏）

**预期行为：** 用户应看到错误提示，弹窗不关闭

**实际行为：** 无论 `onSubmit` 是否成功，都会显示"添加成功"并关闭弹窗

**根因分析：**
```typescript
// 第104-106行
onSubmit(expense)          // 未 await！
message.success('添加成功！') // 一定会执行
onClose()                  // 一定会执行
```
如果 `onSubmit` 抛出异常（如数据库连接失败），异常会被外层 `try-catch` 捕获，但 `message.success` 已经在 `onSubmit` 调用后执行了。

---

### 🟡 一般问题

#### BUG-6：统计分析页面总计始终显示人民币符号 ¥（币种显示错误）

| 项目 | 内容 |
|------|------|
| **严重程度** | 一般 |
| **影响模块** | 统计分析 |
| **代码位置** | `src/renderer/src/pages/StatisticsPage.tsx:98` |

**复现步骤：**
1. 添加一条 AUD 50.00 的花销
2. 打开"统计分析"页面
3. 查看"总计支出"

**预期行为：** 显示 "$50.00"（AUD 数据应显示 $）

**实际行为：** 显示 "¥50.00"

**根因分析：**
```typescript
<span style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>
  ¥{(totalAll / 100).toFixed(2)}  // 固定写死了 ¥
</span>
```

**截图证据：**

![AUD统计显示为¥](test_results/07_statistics_aud.png)

> 图中显示"总计支出：¥50.00"，但数据是 AUD 50.00。

---

#### BUG-7：饼图 tooltip 固定使用人民币符号 ¥

| 项目 | 内容 |
|------|------|
| **严重程度** | 一般 |
| **影响模块** | 统计分析 - 饼图 |
| **代码位置** | `src/renderer/src/pages/StatisticsPage.tsx:56` |

**复现步骤：**
1. 添加 AUD 数据
2. 打开统计分析页面
3. 鼠标悬停在饼图扇区上

**预期行为：** AUD 数据应显示 "$" 符号

**实际行为：** 所有 tooltip 都显示 "¥"

**根因分析：**
```typescript
formatter: (p: any) => `${p.name}<br/>金额: ¥${(p.value / 100).toFixed(2)}<br/>占比: ${p.percent.toFixed(1)}%`
// 固定写死了 ¥
```

---

#### BUG-8：分账结算页面将不同币种直接相加排序

| 项目 | 内容 |
|------|------|
| **严重程度** | 一般 |
| **影响模块** | 分账结算 |
| **代码位置** | `src/renderer/src/pages/SettlementPage.tsx:63-67` |

**复现步骤：**
1. 添加廖泽平 CNY 100.00 的花销
2. 添加黄柏清 AUD 10.00 的花销（约等于 CNY 48.00）
3. 打开"分账结算"页面

**预期行为：** 排序应分别按 CNY 总额和 AUD 总额排序，不应混合

**实际行为：** 廖泽平排在前面（10000 > 1000），但这是因为 `a.cnyTotal + a.audTotal` 直接相加

**根因分析：**
```typescript
setData([...map.values()].sort((a, b) => {
  const aTotal = a.cnyTotal + a.audTotal  // 错误：不同币种直接相加
  const bTotal = b.cnyTotal + b.audTotal
  return bTotal - aTotal
}))
```

**截图证据：**

![分账结算混合币种排序](test_results/14_settlement_mixed.png)

---

#### BUG-9：快捷平分金额存在精度丢失（1分钱误差）

| 项目 | 内容 |
|------|------|
| **严重程度** | 一般 |
| **影响模块** | 添加花销弹窗 - 快捷平分 |
| **代码位置** | `src/renderer/src/components/AddExpenseModal.tsx:69` |

**复现步骤：**
1. 打开添加花销弹窗
2. 输入总金额 100.00
3. 点击"三人平分"

**预期行为：** 每人 33.34 元，或总和精确等于 100.00

**实际行为：** 每人 33.33 元，3 人总和 = 99.99 元，差 1 分钱

**根因分析：**
```typescript
const perPerson = Math.round((totalAmount * 100) / numPerson)
// 10000 / 3 = 3333.33...，round 后为 3333
// 3333 * 3 = 9999，比原始 10000 少 1
```

**测试数据：**
```
perPerson: 3333分 (33.33元)
totalSplit: 9999分 (99.99元)
diff: 1分 (0.01元)
```

---

#### BUG-10：花销记录切换币种/人员筛选时页码不重置

| 项目 | 内容 |
|------|------|
| **严重程度** | 一般 |
| **影响模块** | 花销记录 - 筛选 |
| **代码位置** | `src/renderer/src/pages/HomePage.tsx:125-136` |

**复现步骤：**
1. 添加超过 20 条数据（触发分页）
2. 翻到第 2 页
3. 切换币种筛选为 CNY

**预期行为：** 页码重置为第 1 页

**实际行为：** 页码仍为第 2 页，如果筛选后数据不足 20 条，则显示空列表

**根因分析：**
```typescript
<Select placeholder="币种" value={filterCurrency} onChange={setFilterCurrency}
  // 没有 setPage(1)
/>
<Select placeholder="人员" value={filterPerson} onChange={setFilterPerson}
  // 没有 setPage(1)
/>
<Select placeholder="分类" value={filterCategory} onChange={v => { setFilterCategory(v); setPage(1) }}
  // 只有分类筛选重置了页码
/>
```

---

#### BUG-11：智能录入默认日期使用 UTC 时间

| 项目 | 内容 |
|------|------|
| **严重程度** | 一般 |
| **影响模块** | 智能录入 |
| **代码位置** | `src/renderer/src/pages/SmartInputPage.tsx:236` |

**复现步骤：**
1. 在 UTC+8 时区的晚上 23:00 打开智能录入页面
2. 查看默认日期

**预期行为：** 默认日期为当前本地日期

**实际行为：** 默认日期可能为前一天（因为 `toISOString()` 返回 UTC 时间）

**根因分析：**
```typescript
const [defaultDate, setDefaultDate] = useState(new Date().toISOString().slice(0, 10))
// toISOString() 返回 UTC 时间，如 2025-07-13T15:00:00.000Z
// 在 UTC+8 晚上 23:00，UTC 时间是 15:00，同一天
// 但在 UTC+8 凌晨 01:00，UTC 时间是前一天 17:00，会显示前一天日期
```

---

### 🟢 建议

#### BUG-12：变动记录日期筛选使用字符串拼接

| 项目 | 内容 |
|------|------|
| **严重程度** | 建议 |
| **影响模块** | 变动记录 - 日期筛选 |
| **代码位置** | `src/renderer/src/pages/HistoryPage.tsx:38` |

**问题：**
```typescript
if (dateRange) { params.endDate = dateRange[1] + ' 23:59:59' }
```
使用字符串拼接日期时间，虽然 SQLite 字符串比较通常能工作，但不是最佳实践。建议使用 `datetime` 函数或统一时间格式。

---

#### BUG-13：SettlementPage 首次加载存在竞态条件

| 项目 | 内容 |
|------|------|
| **严重程度** | 建议 |
| **影响模块** | 分账结算 |
| **代码位置** | `src/renderer/src/pages/SettlementPage.tsx:24-25` |

**问题：**
```typescript
useEffect(() => { loadPeople() }, [])
useEffect(() => { loadData() }, [dateRange])
```
`loadData` 依赖 `people` 数据来初始化所有人的统计，但 `loadPeople` 和 `loadData` 是独立执行的，首次加载时 `loadData` 可能在 `loadPeople` 完成前执行。

---

#### BUG-14：SmartInputPage ResultModal 传入空 onSubmit

| 项目 | 内容 |
|------|------|
| **严重程度** | 建议 |
| **影响模块** | 智能录入 |
| **代码位置** | `src/renderer/src/pages/SmartInputPage.tsx:368` |

**问题：**
```typescript
<ResultModal
  onSubmit={() => { }}  // 空函数
/>
```
虽然 ResultModal 内部有自己的 `handleSubmit`，但外部传入空函数在语义上令人困惑，如果未来重构可能引入 bug。

---

## 测试用例执行清单

| 编号 | 测试场景 | 结果 | 备注 |
|------|---------|------|------|
| TC-01 | 添加 AUD 花销并查看欠款 | ✅ 通过 | 数据正确同步 |
| TC-02 | 删除单条花销后检查欠款 | ❌ 失败 | BUG-1 |
| TC-03 | 一键删除所有花销后检查欠款 | ❌ 失败 | BUG-2 |
| TC-04 | 修改花销分摊人后检查欠款 | ❌ 失败 | BUG-3 |
| TC-05 | 添加并删除人员，检查孤立数据 | ❌ 失败 | BUG-4 |
| TC-06 | 手动记账和清账 | ✅ 通过 | 功能正常 |
| TC-07 | 统计分析 AUD 数据币种显示 | ❌ 失败 | BUG-6, BUG-7 |
| TC-08 | 分账结算混合币种排序 | ❌ 失败 | BUG-8 |
| TC-09 | 快捷平分精度测试 | ❌ 失败 | BUG-9 |
| TC-10 | 分页 + 筛选页码重置 | ❌ 失败 | BUG-10 |
| TC-11 | 智能录入页面默认日期 | ⚠️ 风险 | BUG-11 |
| TC-12 | 所有页面 UI 渲染 | ✅ 通过 | 布局正常 |
| TC-13 | 汇率设置 | ✅ 通过 | 功能正常 |
| TC-14 | 人员管理增删改 | ✅ 通过 | 功能正常 |
| TC-15 | 数据持久化（关闭重开） | ✅ 通过 | SQLite 本地存储 |

---

## 修复建议优先级

### P0（立即修复）
1. **BUG-1 / BUG-2 / BUG-3**：在 `deleteExpense`、`deleteAllExpenses`、`updateExpense` 中同步维护 `balance_records`
   - 方案：在删除/更新花销时，先删除关联的 `balance_records` 记录，再重新生成（对于 update）
   - 或者给 `balance_records` 的 `expense_id` 添加 `ON DELETE CASCADE`

2. **BUG-4**：给 `expense_items` 和 `balance_records` 的 `person_id` 添加 `ON DELETE CASCADE` 或手动清理

3. **BUG-5**：在 `AddExpenseModal` 中 `await onSubmit(expense)`

### P1（尽快修复）
4. **BUG-6 / BUG-7**：StatisticsPage 根据当前筛选币种动态显示货币符号
5. **BUG-8**：SettlementPage 分别按 CNY 和 AUD 排序，或提供排序选项
6. **BUG-9**：quickSplit 处理精度问题（最后一人补差额）

### P2（后续修复）
7. **BUG-10**：所有筛选条件变化时统一重置页码
8. **BUG-11**：使用 `dayjs().format('YYYY-MM-DD')` 替代 `toISOString()`
9. **BUG-12 / BUG-13 / BUG-14**：代码健壮性改进

---

## 附录：截图文件清单

| 文件名 | 描述 |
|--------|------|
| `test_results/01_home_after_add.png` | 添加花销后的首页 |
| `test_results/02_balance_after_add.png` | 添加花销后的欠款结余 |
| `test_results/03_balance_after_delete_expense.png` | 删除花销后的欠款结余（BUG-1） |
| `test_results/04_history_after_delete.png` | 删除花销后的变动记录 |
| `test_results/05_statistics.png` | 统计分析页面（CNY数据） |
| `test_results/06_balance_after_delete_all.png` | 一键删除所有后的欠款（BUG-2） |
| `test_results/07_statistics_aud.png` | AUD数据统计分析（BUG-6） |
| `test_results/08_settings.png` | 设置页面 |
| `test_results/09_smart_input.png` | 智能录入页面 |
| `test_results/10_people.png` | 人员管理页面 |
| `test_results/11_history.png` | 变动记录页面 |
| `test_results/12_settlement.png` | 分账结算页面 |
| `test_results/13_balance_after_update.png` | updateExpense后的欠款（BUG-3） |
| `test_results/14_settlement_mixed.png` | 混合币种分账结算（BUG-8） |
| `test_results/15_statistics_aud_tooltip.png` | AUD统计总计显示为¥（BUG-6） |
| `test_results/16_home_pagination.png` | 分页状态下的首页 |

---

*报告结束*
