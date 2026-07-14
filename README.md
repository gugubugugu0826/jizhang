# 记账APP

一款运行在 Windows / Mac 上的桌面记账应用，面向多人合租/合住场景。

## 功能特性

- **多币种**：人民币(CNY) 和澳元(AUD) 独立记录，互不换算
- **多人分摊**：一笔消费分配给多个人，快捷平分或自定义金额
- **AI 智能录入**：粘贴自然语言消费记录，DeepSeek/OpenAI 自动解析成结构化账目
- **分账结算**：选日期范围，统计每人 CNY 和 AUD 各应付多少
- **欠款追踪**：花销自动同步欠款，支持手动记账、一键清账
- **统计分析**：饼图（分类+人员）和柱状图（月度趋势）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端 | React 19 + TypeScript |
| 构建 | electron-vite + Vite 7 |
| UI 组件 | Ant Design 6 |
| 图表 | ECharts 6 |
| 数据库 | SQLite (better-sqlite3) |
| AI | DeepSeek / OpenAI 可切换 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 编译原生模块（首次必须）
npx @electron/rebuild

# 3. 启动开发模式
npm run dev

# 4. 打包安装包
npm run package:win   # Windows
npm run package:mac   # macOS
```

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             #   窗口管理
│   ├── database.ts          #   SQLite CRUD + 统计
│   ├── ai-parser.ts         #   AI API 调用
│   └── ipc-handlers.ts      #   IPC 通信层
├── preload/index.ts         # 安全 API 桥接
├── shared/
│   ├── types.ts             # 类型定义
│   ├── categories.ts        # 10大类48小类
│   └── parser.ts            # 本地正则解析器
└── renderer/src/
    ├── App.tsx              # 主布局 + 路由
    ├── pages/
    │   ├── SmartInputPage   # 智能录入（AI 解析）
    │   ├── HomePage         # 花销记录
    │   ├── StatisticsPage   # 统计分析
    │   ├── SettlementPage   # 分账结算
    │   ├── BalancePage      # 欠款结余
    │   ├── HistoryPage      # 变动记录
    │   ├── PeopleManagePage # 人员管理
    │   └── SettingsPage     # 设置
    └── components/
        └── AddExpenseModal  # 添加花销弹窗
```

## 数据库表

| 表 | 用途 |
|----|------|
| people | 人员信息 |
| expenses | 花销总表（币种、总金额、分类、日期） |
| expense_items | 分摊明细（每人该付多少） |
| exchange_rates | 汇率（AUD↔CNY） |
| balance_records | 欠款变动流水 |
| settings | 键值配置（API Key 等） |

## 数据安全

所有数据（花销记录、API Key）仅存储在本地 SQLite 数据库中，不联网不上传。数据库文件位置：`%APPDATA%/jizhang/jizhang.db`
