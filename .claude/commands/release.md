---
name: release
description: 版本发布自动化 — 标准化发布流程。当用户说"发布新版本"、"准备上线"、"打个版本"、"release"、"版本迭代"、"version bump"或指定版本号变更时激活。
---

# 版本发布自动化

你是用户的版本发布助手。自动执行标准化发布流程。

## 核心原则

- 每步执行后用 `✅ Step X/7: [名称]` 汇报进度
- 危险操作（`--force`、`--hard`、删 tag）必须二次确认
- 发布完成后输出 `🎉 发布完成！` 汇总

---

## 发布流程（7 步）

### Step 1 — 环境检查

```bash
git branch --show-current
git status --short
```

- 不在 `main`/`master` → 提示用户先切换
- 有未提交修改 → 询问用户：提交、stash、还是放弃？
- 都 OK → 拉取最新：`git pull origin $(git branch --show-current)`

### Step 2 — 确定版本号

**用户指定了版本号** → 直接用  
**用户未指定** → 根据变更类型自动推断：

| 用户描述 | 版本变化 | 示例 |
|---------|---------|------|
| 修复/bugfix/小更新/补丁 | PATCH +1 | 1.0.0 → 1.0.1 |
| 新功能/特性/功能更新 | MINOR +1, PATCH=0 | 1.0.0 → 1.1.0 |
| 大改版/重构/不兼容/breaking | MAJOR +1, 其余=0 | 1.0.0 → 2.0.0 |

不确定时，展示推断结果并向用户确认。

### Step 3 — 更新版本文件

检查项目中存在哪个版本文件：
- `package.json` → `npm version <版本号> --no-git-tag-version`
- 其他格式（pyproject.toml, VERSION 等）→ 手动编辑
- 都没有 → 跳过

### Step 4 — 生成 Changelog

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10")..HEAD --pretty=format:"- %s" --reverse
```

整理为结构化 changelog，展示给用户确认。

### Step 5 — 提交 & 打 Tag

```bash
git add .
git commit -m "chore(release): bump version to v<版本号>"
git tag -a v<版本号> -m "v<版本号> - <changelog 摘要>"
```

### Step 6 — 推送到远程

```bash
git push origin $(git branch --show-current)
git push origin v<版本号>
```

push 被拒 → `git pull --rebase` 后再试。tag 已存在 → 询问是否覆盖。

### Step 7 — 创建 GitHub Release

优先用 `gh release create`，如未安装 gh CLI 则输出手动创建链接。

---

## 发布完成汇总

```markdown
🎉 发布完成！
   版本: v<版本号>
   分支: <分支名>
   Tag: v<版本号>
   GitHub Release: <链接>
```

## 异常处理速查

| 场景 | 处理 |
|------|------|
| 远程已有同名 tag | 询问是否覆盖 `--force` |
| push 被拒绝 | `git pull --rebase` |
| 未配置 git user | 提示配置 |
| 未安装 gh CLI | 输出手动创建链接 |
| 用户中途取消 | `git tag -d` + `git reset --soft HEAD~1`（如已 commit） |
| 找不到上一个 tag | 用 `HEAD~10` 兜底 |

## 安全红线

- 绝不自动 `git push --force`
- 绝不自动 `git reset --hard`
- 删除 tag 或修改历史前必须二次确认
