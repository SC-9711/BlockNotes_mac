# 开始使用

## Windows 用户

前往 [Releases](https://github.com/tonniescj-hub/BlockNotes/releases)，选择实际已发布的 Windows x64 下载包。若没有下载文件，说明当前仅发布源码，请使用下方开发步骤，不要把 GitHub 的 Source code ZIP 当成安装包。

1. 解压整个 Windows 程序 ZIP 到自己的目录，保留 EXE、DLL、locales 与 resources 等相邻文件。
2. 双击 BlockNotes.exe。首次启动会自动准备 Java 1.21 的原版方块、GUI、字体、交互音效及 19 张唱片，并显示进度。
3. 需要网络和足够磁盘空间；已验证的下载缓存可复用。失败时点击“重试”，也可以取消并退出。安装资源不改写笔记正文。
4. 全部资源校验通过后自动进入书房。第二次启动直接读取本地资源，正常记笔记不需要网络。

应用不要求普通用户安装 Node、npm 或 Java 运行时，不要求开启游戏。原版资源的来源和权利独立于源码许可，见 [COPYRIGHT](../COPYRIGHT.md)。

程序未签名，Windows 可能显示来源提示。应核对仓库账号、版本和提供的 SHA-256；不要通过关闭系统保护来解决来源不明文件的问题。

![书房首页](screenshots/room.png)

## 数据与更新

笔记默认在 `%APPDATA%\blocknotes\blocknotes.sqlite`；资源单独保存在同一应用数据目录下的 `resource-packs/`。实际数据位置可通过 Esc → 选项查看。

更新时从 Esc 菜单“保存并退出”，再替换程序文件夹。不要删除数据目录。建议更新前导出 JSON 备份；普通程序升级不需要迁移或清空日常笔记。

## 源码开发

Windows x64，Node.js 22.22 或以上版本：

```powershell
git clone https://github.com/tonniescj-hub/BlockNotes.git
cd BlockNotes
npm ci
powershell -NoProfile -File scripts/setup-local-resources.ps1
npm run desktop
```

现有开发脚本从官方端点初始化被 Git 忽略的本地资源。首次启动自动资源准备在打包版及 `npm run build` 后的 `npm start` 中工作；浏览器开发模式仍须事先准备 public/minecraft。

```powershell
npm run audit:source
npm run check
npm test
npm run build
npm run test:e2e
npm run pack
node scripts/verify-package.mjs release/win-unpacked --public
```

`pack` 是公开包路径，首次运行会在用户本机准备资源。`pack:local` 仅用于个人验证，不用于公共 Release。
