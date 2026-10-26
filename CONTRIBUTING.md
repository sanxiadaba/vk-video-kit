# 贡献

## 环境

Node.js ≥ 20、npm。第一次：

```bash
npm ci
npm run build      # 生成 _site/、dist/、vk/、types/ 与 metadata
npm run dev        # http://127.0.0.1:8099，服务 _site/
```

## 结构

| 目录 | 作用 |
|---|---|
| `src/` | 运行时与 CSS 层，唯一真源 |
| `cli/` | 随包发布的 `vk build` / `vk serve` |
| `tools/` | 生成器与门禁，仅开发 |
| `site/` | 展示站手写外壳 |
| `frames/` | 8 个作者帧；构建只读 |
| `code/` | 示例真实文件 |
| `docs/` | 手写文档；`reference.md` 是生成物 |
| `_site/` | 构建产物，不进 git |

## 改什么

- 组件 API：改 `src/registry.mjs`；类型、属性表、组件页会跟着重新生成。
- 组件行为：改 `src/runtime/*`；CSS 改 `src/{tokens,elements,layout,components,compositions}/*.css`。
- 新场景 / 帧：改 `src/scenes/scenes.mjs` 或 `frames/*.html`。
- **不要手改** `_site/`、`dist/`、`vk/`、`types/`、`docs/reference.md`、`custom-elements.json`、`icons.json`——它们都由 `npm run build` 生成。

## 提交前

```bash
npm run lint
npm run test:fast   # verify + links + pack + 单测
npm test            # 全量：build + 契约 + 渲染门禁 + 浏览器回归
```

- 视觉改动请附一张 `_site/shots/` 里的截图或帧链接。
- 不新增一次性 CSS；不能靠补样式让某个示例过关。
- 生成物不提交。`npm run build` 后 `git status` 应该是干净的。

## 提交

一条提交做一件事，标题写“做了什么”，正文写“为什么”。不要提交 `.tmp/`、日志、截图中间产物。

## 许可

提交即同意以 MIT 许可发布；第三方资产需在 `THIRD-PARTY-NOTICES.md` 登记。
