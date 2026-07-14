# 记账APP — 产品文档

## 项目信息

- **名称**：记账APP
- **版本**：2.0.0
- **平台**：Windows 10/11 + macOS 11+
- **用途**：多人合租/合住场景下的日常消费记账、分账结算、欠款追踪

---

## 技术架构

```
┌─────────────────────────────────────────────┐
│               Electron 33                   │
│  ┌──────────────┐  ┌──────────────────┐    │
│  │  主进程 (Main) │  │  渲染进程 (Renderer)│    │
│  │              │  │                  │    │
│  │  index.ts    │  │  React 19 + TS   │    │
│  │  database.ts │◄─┤  Ant Design 6    │    │
│  │  ai-parser.ts│  │  ECharts 6       │    │
│  │  ipc-handlers│  │  React Router 7  │    │
│  │              │  │                  │    │
│  └──────┬───────┘  └──────────────────┘    │
│         │                                   │
│  ┌──────┴───────┐                           │
│  │  SQLite 数据库 │  ← better-sqlite3       │
│  │  (本地存储)    │                          │
│  └──────────────┘                           │
└─────────────────────────────────────────────┘
```

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 33.4 |
| 前端 | React + TypeScript | 19.2 |
| 构建 | electron-vite + Vite | 7.3 |
| UI | Ant Design | 6.5 |
| 图表 | ECharts | 6.1 |
| 数据库 | better-sqlite3 (SQLite) | 12.11 |
| AI | DeepSeek / OpenAI 可切换 | - |

---

## 项目结构

```
记账APP/
├── CLAUDE.md                    # 产品文档（本文件）
├── README.md                    # 测试人员使用说明
├── package.json                 # 依赖和脚本
├── electron.vite.config.ts      # 构建配置
├── electron-builder.yml         # 打包配置
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             #   窗口管理、应用生命周期
│   │   ├── database.ts          #   SQLite 数据库 CRUD + 统计 + 欠款
│   │   ├── ai-parser.ts         #   DeepSeek/OpenAI API 调用
│   │   └── ipc-handlers.ts      #   IPC 通信桥梁
│   ├── preload/
│   │   └── index.ts             # 安全 API 暴露给渲染进程
│   ├── shared/
│   │   ├── types.ts             # TypeScript 类型定义
│   │   ├── categories.ts        # 系统分类种子数据（10大类48小类）
│   │   └── parser.ts            # 本地正则解析器
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx         # React 入口
│           ├── App.tsx          # 主布局 + 导航路由
│           ├── App.css          # 全局样式
│           ├── pages/           # 8 个页面
│           │   ├── SmartInputPage.tsx     # 智能录入（AI解析）
│           │   ├── HomePage.tsx           # 花销记录列表
│           │   ├── StatisticsPage.tsx     # 统计分析（图表）
│           │   ├── SettlementPage.tsx     # 分账结算
│           │   ├── BalancePage.tsx        # 欠款结余
│           │   ├── HistoryPage.tsx        # 变动记录
│           │   ├── PeopleManagePage.tsx   # 人员管理
│           │   ├── CategoryManagePage.tsx # 分类管理
│           │   └── SettingsPage.tsx       # 设置（汇率/AI）
│           └── components/
│               └── AddExpenseModal.tsx  # 添加花销弹窗
```

---

## 数据库表结构

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `people` | 人员 | id, name |
| `expenses` | 花销总表 | id, currency, total_amount, category1, category2, date, note |
| `expense_items` | 分摊明细 | expense_id, person_id, amount, note |
| `exchange_rates` | 汇率 | from_currency, to_currency, rate |
| `balance_records` | 欠款变动 | person_id, currency, amount, type(expense/manual/settle), note |
| `categories` | 分类 | id, name, icon, parent_id, is_system, sort_order |
| `settings` | 配置 | key, value |

---

## 功能清单

### 智能录入
- 粘贴自然语言记账文字 → DeepSeek/OpenAI AI 解析 → 结构化数据
- 支持本地正则解析作为备选
- 解析结果弹窗预览 + 编辑 + 确认入库
- 弹窗底部显示本次分账统计

### 花销记录
- 花销列表：日期、币种、金额、分类、分摊人、备注
- 筛选：币种、人员、分类、日期范围
- 多选删除 + 一键删除全部
- 表单录入：币种、分类、多人分摊、快捷平分

### 统计分析
- 饼图：支出分类占比 + 人员支出占比
- 柱状图：月度趋势
- 币种筛选 + 汇率参考

### 分账结算
- 选日期范围 → 每人 CNY 和 AUD 分别统计
- 人民币和澳元完全分开，不做换算

### 欠款结余
- 当前每人每种币种的欠款余额
- 花销自动同步更新余额
- 手动记账（借款/欠款）
- 一键清账

### 变动记录
- 所有欠款变动流水
- 按人/币种/类型/日期筛选
- 单条删除

### 人员管理
- 预置4人，可增删改

### 设置
- 澳元→人民币汇率配置
- AI 提供商切换（DeepSeek / OpenAI / 自定义）
- API Key 配置（本地存储，不泄露）

---

## 开发命令

```bash
npm install              # 安装依赖
npx @electron/rebuild    # 编译原生模块（首次）
npm run dev              # 启动开发模式
npm run build            # 构建
npm run package:win      # 打包 Windows 安装包
npm run package:mac      # 打包 macOS 安装包
```

---

## 技术协作规则

**本项目最重要的规则，必须严格遵守：**

用户不懂编程技术。遇到任何技术决策时：
1. 列出 2-3 个方案
2. 用通俗语言解释每个方案的优点和缺点
3. 给出推荐方案并说明理由
4. 等待用户选择后再实施

---

## 版本发布流程

当用户说"发布新版本"、"准备上线"、"打个版本"、"release"、"版本迭代"、"version bump"或提到版本号变更时，自动执行以下标准化发布流程。每步用 `✅ Step X/7` 汇报进度。

### Step 1 — 环境检查
- `git branch --show-current` 确认在主分支
- `git status --short` 确认工作区干净
- `git pull origin $(git branch --show-current)` 同步最新

### Step 2 — 确定版本号
- 用户指定 → 直接用
- 未指定 → 按 SemVer 推断：fix→PATCH, feat→MINOR, breaking→MAJOR

### Step 3 — 更新版本文件
- `package.json` → `npm version <版本号> --no-git-tag-version`

### Step 4 — 生成 Changelog
- `git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"- %s" --reverse`
- 展示给用户确认

### Step 5 — 提交 + Tag
- `git add . && git commit -m "chore(release): v<版本号>"`
- `git tag -a v<版本号> -m "v<版本号> - <摘要>"`

### Step 6 — 推送
- `git push origin $(git branch --show-current)`
- `git push origin v<版本号>`

### Step 7 — GitHub Release
- `gh release create v<版本号> --title "v<版本号>" --notes "<changelog>" --latest`
- 无 gh CLI → 输出手动创建链接

### 安全红线
- 绝不自动 `git push --force` 或 `git reset --hard`
- 危险操作必须二次确认
