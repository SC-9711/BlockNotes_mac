# 开源预检查记录

这是首次资源自动准备开发前的阶段性记录。后续实现及发布验证见 [GitHub 首次发布验收记录](github-release-2026-10-10.md)，以下“未上传”描述仅指当时阶段。

日期：2026-10-10。Windows x64，Node 22.22.1，npm 10.9.4。所有新测试使用隔离目录，没有读取或改写日常笔记库。原有书房、编辑器、数据库和场景布局未修改。

## 实际结果

| 检查 | 结果 |
| --- | --- |
| GitHub 连接 | 已登录 tonniescj-hub；原项目无 remote，本轮没有创建仓库或上传 |
| 当前源码模式审查 | 未命中禁止资源、用户数据库、常见令牌/私钥模式；不代表完整秘密审计 |
| 历史扫描 | 扫描 217 个历史 blob；1 项个人路径提示，当前文档已脱敏，旧历史未重写 |
| 无资源源码快照 | 独立目录复制待公开文件，没有原 .git、node_modules、dist、缓存或 Minecraft 素材；建立仅用于本地验证的 Git 初始提交 |
| 全新依赖安装 | 在该源码目录执行 npm ci 成功，新增 428 个包 |
| 类型与生产构建 | npm run check、npm run build 通过，无资源也能编译 |
| 自动化测试 | 40/40 通过；37 项既有测试及 3 项公开源码防泄漏测试 |
| Electron 回归 | 源码构建上的 13/13 通过，使用开发机本地游戏资源，覆盖独立讲台、书架删除、备份、保存、Esc、原声及唱片 |
| Windows 默认打包 | 成功生成 release/open-source-prep-public/win-unpacked，没有使用 pack:local |
| 公共包审查 | 17 个代码/声明文件与源码一致；ASAR 与外围目录检查通过，原版资源未打包 |
| Windows 公共包启动 | 实际启动成功；缺资源时显示资源加载失败，完整书房不能使用。这是当前发行阻塞项 |
| 第三方声明 | 重新收集 63 个生产依赖许可；保留 PrismarineJS 移植代码声明、Electron/Chromium 的运行时许可 |
| 生产依赖漏洞检查 | npm audit --omit=dev：0 项已知漏洞 |
| 全部依赖漏洞检查 | npm audit：8 项 moderate、0 项 high/critical；涉及构建与下载/日志工具链，尚未修复 |

源码审查的 3 个新测试验证：忽略本地资源和数据库；强制提交后又删除的游戏资源仍在历史中被拦截；已删除的历史令牌仍被拦截且不回显令牌值。

Windows 公共包 ASAR SHA-256：

```text
0a596ca89ced16e9f080f88f5858a3d570e03995fb1d50f4af58eb5e16ab24f9
```

这是程序内部 app.asar 的哈希，不是已经发布的下载文件校验值。

## 本地证据

以下目录均由 Git 忽略，不会随源码上传：

- `.local/open-source-prep/source-audit.json`：当前文件与原开发历史的模式审查。
- `.local/open-source-prep/logs/clean-install.log`、`clean-source-audit.log`、`clean-check.log`、`clean-unit.log`、`clean-build.log`：无资源独立源码验证。
- `.local/open-source-prep/logs/check.log`、`build.log`、`e2e.log`：当前源码上的完整 Electron 回归。
- `.local/open-source-prep/logs/public-pack.log`、`public-package-audit.json`、`public-smoke.log`：Windows 默认包、资源排除和真实启动检查。
- `.local/open-source-prep/logs/dependency-audit.json`：完整依赖漏洞审查原始 JSON。
- `.local/open-source-prep/public-without-assets.png`：默认公共包缺资源时的实际画面。
- `artifacts/delivery/BlockNotes_开源准备源码_2026-10-10.zip`：待公开源码快照，不包含 .git、个人数据、依赖缓存、游戏资源或程序包；用于审核，尚未上传。

## 尚未完成

1. 用户本地游戏资源导入、资源缺失时的首次启动说明、用户可写资源目录查找。
2. 真正干净 Windows 机器上的下载安装与资源导入验收。独立源码目录验证不等同于干净系统验证。
3. 开发工具链 moderate 漏洞的兼容升级及 Windows 打包回归。
4. 公开源码快照的人工最终审阅、独立的完整秘密扫描、品牌图标与宣传截图使用边界复核。
5. GitHub 远程 CI、私密漏洞报告渠道、正式 Release、公开下载校验和与可选代码签名。

本轮准备支持下一步发布工作，不将当前程序包称为已完成的普通用户发行版。具体顺序见 [开源计划](open-source-plan-2026-10-10.md)。
