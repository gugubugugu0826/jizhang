---
name: security-audit
description: 安全审查 — 检查代码中的敏感信息泄露、SQL注入漏洞、配置文件安全隐患等
---

# 安全审查技能

你是记账APP项目的安全审查员。你的任务是：全面检查项目代码的安全隐患，输出安全报告，写入通行证标记文件。

**核心原则**：安全问题是一票否决的红线。发现任何安全问题，必须阻止提交。

---

## 检查维度

### 维度 1：硬编码敏感信息 ⛔ 红线

检查所有源文件中是否存在以下硬编码的敏感信息：

| 类型 | 检查模式 | 风险等级 |
|------|---------|---------|
| API Key | 包含 `key`、`token`、`secret`、`password` 等关键字的字符串赋值 | 🔴 严重 |
| GitHub Token | `ghp_`、`gho_`、`ghu_`、`ghs_`、`ghr_` 前缀的字符串 | 🔴 严重 |
| 私钥 | `-----BEGIN.*PRIVATE KEY-----` | 🔴 严重 |
| 数据库密码 | 包含 `password` 的数据库连接字符串 | 🔴 严重 |
| JWT Secret | `jwt.*secret` 或硬编码的签名密钥 | 🔴 严重 |
| 内网地址 | 包含内网 IP（10.x, 172.16-31.x, 192.168.x）的硬编码 | 🟡 注意 |
| 个人邮箱/手机号 | 非公开的个人联系方式 | 🟡 注意 |

**检查方法**：
1. 使用 Grep 搜索以下模式：
   - `ghp_` — GitHub 个人访问令牌
   - `sk-` — OpenAI/DeepSeek API Key
   - `Bearer` — 后跟硬编码 token
   - `password.*=` — 密码赋值
   - `secret.*=` — 密钥赋值
   - `-----BEGIN` — 私钥
   - `\d{11}` — 手机号（中国格式）
2. 扫描以下文件中的敏感信息：
   - `settings.json`、`settings.local.json`
   - `.env`、`.env.local`
   - `*.config.ts`、`*.config.js`
   - 所有 `.ts`、`.tsx` 源文件

**特殊例外**：
- `settings.local.json` 中的 `permissions.allow` 配置不是敏感信息
- 代码注释中的示例 API Key（如 `your-api-key-here`）不是真实泄露
- `.env` 文件中的占位符值不是泄露

### 维度 2：SQL 注入漏洞 ⛔ 红线

检查所有数据库操作代码中的 SQL 注入风险：

**高危模式**：
- 字符串拼接构造 SQL：`"SELECT * FROM users WHERE name = '" + input + "'"`
- 模板字符串直接嵌入用户输入：`` `SELECT * FROM x WHERE y = '${input}'` ``
- 未使用参数化查询的任何 SQL 执行

**安全模式**（放行）：
- `better-sqlite3` 的参数化查询：`db.prepare('SELECT * FROM x WHERE y = ?').get(input)`
- 使用 `?` 占位符或命名参数 `@name`

**检查对象**：
- `src/main/database.ts` — 所有 SQL 语句
- 任何使用 `db.prepare()`、`db.exec()`、`db.run()` 的地方

### 维度 3：配置文件安全 🟡 注意

检查配置文件是否包含明文敏感信息：

- `package.json` — 检查是否包含 token、密码
- `.claude/settings.json` — 检查 hooks 和 permissions 是否有安全风险
- `.claude/settings.local.json` — 检查是否暴露了真实的 API Key
- `.gitignore` — 检查是否忽略了敏感文件（`.env`、`*.db`、`settings.local.json` 等）

### 维度 4：其他安全隐患 🟡 注意

| 检查项 | 说明 |
|--------|------|
| HTTPS 使用 | `ai-parser.ts` 中的 API 调用是否使用 HTTPS |
| 输入验证 | 用户输入是否有基本的验证/清洗 |
| IPC 安全 | preload 暴露的 API 是否有权限控制 |
| 依赖安全 | `package.json` 中是否有已知漏洞的依赖版本 |
| 文件路径遍历 | 文件操作是否防止 `../` 路径遍历攻击 |
| 随机数安全 | 是否使用 `crypto.randomUUID()` 而非 `Math.random()` 生成 ID |

---

## 执行步骤

### Step 1 — 敏感信息扫描

对 `src/`、`.claude/`、项目根目录执行关键词搜索。使用 Grep 工具搜索上述所有模式。

### Step 2 — SQL 注入检查

阅读 `src/main/database.ts`，逐条检查每个 SQL 语句的构造方式。

### Step 3 — 配置文件审查

阅读所有配置类文件，检查是否有明文敏感信息。

### Step 4 — 其他安全检查

逐一检查维度 4 中列出的项目。

### Step 5 — 汇总并写入通行证

#### 无任何安全问题 → 写入 `.claude/pass/security-pass.txt`

```
PASS
timestamp: <当前 ISO 时间>
check_type: security
hardcoded_secrets: 0
sql_injection_risks: 0
config_issues: 0
other_issues: 0

details: 安全审查通过，未发现安全隐患
```

#### 只有 🟡 注意级别问题 → 写入 `.claude/pass/security-pass.txt`（带提醒）

```
PASS_WITH_NOTES
timestamp: <当前 ISO 时间>
check_type: security
hardcoded_secrets: 0
sql_injection_risks: 0
config_issues: <N>
other_issues: <N>

notes:
  - <问题描述>

details: 未发现严重安全问题，有 <N> 个建议改进项
```

#### 有 🔴 严重问题 → 写入 `.claude/pass/security-fail.txt`（阻止提交！）

```
FAIL
timestamp: <当前 ISO 时间>
check_type: security
severity: CRITICAL
hardcoded_secrets: <N>
sql_injection_risks: <N>
config_issues: <N>
other_issues: <N>

findings:
  - [严重] <文件名>:<行号> — <问题描述> — <修复建议>

suggestion: 必须修复以上安全问题后才能提交！
```

---

## 安全红线

以下情况**必须**阻止提交：
- 发现任何真实 API Key / Token 硬编码
- 发现 SQL 注入漏洞
- 发现私钥泄露

以下情况**不阻止**但提醒：
- 内网地址暴露
- 注释中的示例密钥（需人工确认是示例）
- 配置文件优化建议
