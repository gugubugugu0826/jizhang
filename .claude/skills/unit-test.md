---
name: unit-test
description: 单元测试 — 为项目代码自动生成并执行单元测试，输出测试报告和通行证标记文件
---

# 单元测试技能

你是记账APP项目的单元测试执行器。你的任务是：为项目源代码自动生成单元测试、执行测试、输出报告、写入通行证标记文件。

---

## 执行步骤

### Step 1 — 环境准备

检查并安装 vitest：

```bash
npx vitest --version 2>/dev/null || npm install -D vitest
```

如果 `vitest.config.ts` 不存在，创建一个：

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/preload/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

### Step 2 — 发现测试目标

扫描 `src/` 下所有 `.ts` 和 `.tsx` 文件，排除：
- `node_modules/`, `out/`, `dist/`
- `*.d.ts` 类型声明文件
- `src/preload/index.ts`（纯 Electron 桥接，无业务逻辑可测）

重点关注这些文件：
- `src/shared/parser.ts` — 纯函数，核心测试目标
- `src/shared/categories.ts` — 纯数据，验证结构
- `src/shared/types.ts` — 类型定义，验证导出
- `src/main/database.ts` — 数据库操作
- `src/main/ai-parser.ts` — AI 解析逻辑
- `src/renderer/src/pages/*.tsx` — 页面组件

### Step 3 — 生成测试用例

对每个发现的源文件，在 `tests/` 目录下生成对应的 `*.test.ts` 文件。

测试要求：
- **覆盖率目标**：每个导出函数至少 1 个正常路径 + 1 个边界条件测试
- **parser.ts**：测试中文/英文金额解析、币种识别、人员识别、分摊逻辑、日期提取、异常输入
- **categories.ts**：测试系统分类数量、父子关系、isSystem 标记
- **database.ts**：使用 `better-sqlite3` 内存数据库(`:memory:`)进行测试，每个测试前创建新表，测试后关闭
- **ai-parser.ts**：测试 `buildSystemPrompt` 函数的输入输出（不实际调用 API）
- **页面组件**：测试关键渲染逻辑

测试文件模板示例：

```typescript
// tests/parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseText } from '../src/shared/parser'

describe('parseText', () => {
  it('应正确解析人民币金额', () => {
    const result = parseText('今天吃饭花了50元', { people: [], categories: [] })
    expect(result).toBeDefined()
  })

  it('应正确识别澳元金额', () => {
    const result = parseText('打车30刀', { people: [], categories: [] })
    expect(result).toBeDefined()
  })

  it('空输入应返回空结果', () => {
    const result = parseText('', { people: [], categories: [] })
    expect(result).toBeDefined()
  })
})
```

### Step 4 — 执行测试

```bash
npx vitest run --reporter=verbose 2>&1
```

收集结果：
- 测试总数、通过数、失败数
- 每个失败用例的文件、行号、错误信息

### Step 5 — 生成报告并写入通行证

#### 全部通过时 → 写入 `.claude/pass/test-pass.txt`

```
PASS
timestamp: <当前 ISO 时间>
tests_total: <总数>
tests_passed: <通过数>
tests_failed: 0
coverage: <覆盖率百分比>
details: 所有单元测试通过
```

#### 有失败时 → 写入 `.claude/pass/test-fail.txt`

```
FAIL
timestamp: <当前 ISO 时间>
tests_total: <总数>
tests_passed: <通过数>
tests_failed: <失败数>
failures:
  - <文件名>:<行号> — <错误描述>
suggestion: 请修复以上失败测试后重新提交
```

#### 如果完全没有测试文件 → 写入 `.claude/pass/test-pass.txt`

```
PASS
timestamp: <当前 ISO 时间>
tests_total: 0
tests_passed: 0
tests_failed: 0
coverage: N/A
details: 项目暂无测试文件，跳过单元测试检查
```

**重要**：写入通行证文件前，确保 `.claude/pass/` 目录存在，如果不存在则先创建。

---

## 输出格式

完成所有步骤后，向调用者输出以下格式的报告：

```
📋 单元测试报告
================
✅ 通过: <N> / 总计: <N>
❌ 失败: <N>
📊 覆盖率: <百分比>

<如果有失败，列出每个失败详情>

结论: <PASS 或 FAIL>
```
