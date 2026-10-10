# 参与 BlockNotes

先阅读 [AGENTS.md](AGENTS.md) 和 [产品计划书](BlockNotes_项目开发计划书.md)。优先修复数据可靠性、书房交互、中文编辑和无障碍使用；较大的功能或场景改动请先提交 Issue 讨论。

## 本地验证

使用 Windows x64、Node.js 22.22 或以上版本，执行 `npm ci`。开发和资源准备见 [README](README.md)。

每次代码贡献至少运行：

```powershell
npm run audit:source
npm run check
npm test
npm run build
```

涉及界面、保存、恢复、IPC 或打包时，还须在自己的本地资源包环境执行 `npm run test:e2e` 和 Windows 打包回归。测试通过 `BLOCKNOTES_DATA_DIR` 隔离数据；不要使用日常笔记库作为测试夹具。没有完成的检查请在 PR 中说明。

## 提交要求

- PR 说明问题的触发方式、修改后的行为、验证结果和仍存在的限制。
- 对数据操作补充有意义的回归测试，保持旧 JSON 备份兼容；禁止以清库解决问题。
- 新依赖先核查许可证，保留必要的版权声明；生产依赖清单由 `node scripts/collect-licenses.mjs` 更新。
- 不提交原版纹理、模型 JSON、字体、OGG、客户端 JAR、本地资源包或带有个人数据的截图与备份。测试模型使用独立的最小夹具。
- 演示笔记使用原创虚构内容；不要上传个人日常数据库、密钥或日志中的个人信息。
- 当前固定 3D 书房、DOM 编辑器与 SQLite 业务结构继续保留，不引入完整游戏客户端或第二套编辑器。

项目自身代码采用 [MIT](LICENSE)。提交贡献时，请确保你有权按项目许可提供这些内容；第三方内容保留原许可。
