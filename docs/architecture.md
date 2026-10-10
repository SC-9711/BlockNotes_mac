# 架构 · V0.1

2026-10-10 P1 补充：数据库 v2 仅新增恢复来源表，升级前保留 SQLite 快照，笔记格式和 JSON 备份 schemaVersion 1 不变。文件备份导出/恢复在 Worker 中逐条处理；恢复先流式解析到临时 SQLite，再执行一次合并事务。浏览器恢复发送原文件至本机后台，不整体解析大 JSON。领域操作串行，Esc 等待在途操作与可靠保存后关闭，失败保留书页。详见 `p1-fixes-2026-10-10.md`。

2026-10-09。保持原产品形态。当前开发机无 Rust，采用 Electron 替代 Tauri，以减少工具链阻塞并交付 Windows 可运行包。体积代价：包含 Chromium。后续是否迁移 Tauri 由实测体积、性能和维护成本决定，不同时维护两套桌面壳。

- React 19 / TypeScript：DOM 覆盖层、快捷栏、书格与真实编辑器。
- Three.js / react-three-fiber：Java 1.21 JSON 方块模型、nearest 像素材质、raycast、受限相机；不引入游戏客户端。
- Tiptap / ProseMirror：唯一编辑器内核，中文输入、撤销、基础富文本。正文规范格式是 Tiptap JSON；纯文本与 Markdown 为派生数据。JSON 备份可无损恢复，Markdown 用于通用导出。
- Electron 主进程 / Node 内置 SQLite：无原生扩展重编译。sandbox、contextIsolation、窄 IPC、禁止窗口导航与新窗口。
- 浏览器开发预览通过 Vite 的本机中间件复用同一存储层，数据库在 `.local`；桌面数据在系统 userData 下。两个环境明确分开。

## 数据一致性

SQLite migration + foreign keys + WAL + synchronous FULL。Note 保存正文、标题、标签、shelfId、status、revision 和时间。Shelf 与 3D 坐标无关。归档保留原书架，软删除保留前一状态。修改采用 revision 乐观锁，拒绝陈旧写入。前端防抖保存、串行写入，导航前 flush，失败保留草稿并显式重试。本机恢复草稿用于关闭窗口时未完成的编辑，数据库是权威源。

搜索采用正规化后的纯文本 substring 扫描（NFKC、大小写折叠、多个词 AND），完整覆盖中文 1/2/3 字词，V0.1 的小型个人库优先正确性；不用 FTS5 默认分词冒充中文全文检索。

启动保留 SQLite 日备份，手动 JSON 备份含 schemaVersion、所有正文与元数据。恢复前验证全部输入，再在一个事务中合并；同 ID 不同内容另存恢复副本，不覆盖现有内容。损坏数据库中止启动并报告，不静默重建。

## 交付路径

P1/P2：实际创建—编辑—保存—重启—重新打开，书架/讲台/箱子/搜索/标签/恢复/导出。P3：Java 原版视觉参考、房间空间设计、缩放、降级与减少运动。P4：存储与桌面集成验收、Windows 包和客观测试报告。

## 场景与资源

`src/minecraft/layout.ts` 只声明材料、坐标、家具、镜头和交互区域。`Scene.tsx` 合并静态几何、剔除相邻不透明方块内面，保留玻璃旁的木面。`lighting.ts` 用每方块 4×4×4 采样处理实体、半砖、楼梯及梁柱遮挡，分别传播 0–15 级天空光与灯笼光。摄像机前方的视觉剖面在光照网格中封闭，避免漏入额外天空光。顶点读取相邻空气光照与局部遮挡，并保留六方向明暗、AO 和轻微冷暖区别；GUI 纹理与材质不受影响。光照仅在资源载入后计算，笔记操作不重建光照场。原版 JSON 模型保留 UV、父模型继承、局部旋转；复杂游戏的 blockstate / world engine 不进入本项目。相机固定位置，仅平滑改变观察目标；窗口打开后暂停，Canvas 按需渲染。书架区、讲台、箱子分别触发独立领域命令。

`model.ts` 的载入列表来自布局材料及模型引用，主题扩展不需修改笔记数据。六面定义有 PrismarineJS MIT 来源说明。原版资源通过本地提取脚本生成，在 Git 忽略目录中；字体由原版 bitmap provider 转为 DOM 可用的像素字形。资源版本固定 1.21，提取前验 SHA-1。

默认打包排除所有 `dist/minecraft` 内容。显式私人包在 `resources/minecraft` 存独立资源，主进程协议只读该目录。源代码与资源分别管理，避免默认公开包自动带上原版素材。路径经过根目录验证；渲染器无法任意读取用户文件。

书本是一页原版比例的 DOM 视窗；翻页改变显示位置，规范正文仍是完整 ProseMirror 文档。书名、标签、归属及格式工具放在次级界面；旧文档的展示分页随窗口与字体尺寸重新计算。新增空白页以 bookPageBreak 节点保存到同一规范文档，DOM 间隔按页面高度排列；最终页补足视窗高度。空白页与分页边界随 SQLite、草稿、备份保留，搜索仍覆盖全部正文；Markdown 输出显式分页注释。

`sound.ts` 读取独立本地原声清单，使用 Web Audio 缓存解码后的 OGG，按原版变体权重、音高和音量播放。语义音效在窗口或领域操作成功后触发，普通按钮用原版 UI 点击声；翻页避免双重播放。音量保存在既有 settings 表，不改变笔记 schema。音频错误被隔离，不能影响保存流程。


## 暂停菜单与输入

书房按 Esc 打开 Java 风格暂停菜单，提供返回书房、选项、操作指引、保存并退出。容器中 Esc 关闭当前容器；暂停菜单的子界面 Esc / 完成返回菜单，再按 Esc 恢复书房。菜单冻结相机与箱盖动画，模糊 / 暗化背景；场景、快捷栏和新建 / 搜索快捷键暂停响应。选项使用原版按钮与滑块图像。

退出通过已验证来源的窄 IPC `quit` 请求 `BrowserWindow.close()`，先由界面完成 flush，再由既有 prepare-close / close-ready 握手确认；保存失败不关闭窗口。即时物品提示由本机绘制紫色边框、深色背景、像素字体，无浏览器 title 延迟，并限制在窗口内。

## 本地唱片机

唱片机模型、位置与功能区仍在独立场景配置中；点选实体或第七格打开 Jukebox。只读取 1.21 sounds.json 的 music_disc.* 事件，19 张唱片原始文件在忽略的本地资源包中；环境音乐已移除。

单个 HTMLAudioElement 按需读取当前曲目，不把全部长音频解码入内存。既有 SQLite settings 保存 musicVolume / musicTrack；输入范围与唱片资源 ID 在主进程验证，不改变笔记 schema。初始化载入曲目但不自动播放；关闭音乐界面不停止，暂停菜单与子菜单暂停，恢复书房继续。音频错误只显示在唱片机，不阻断笔记保存。

实际 `playing` 事件确认开始播放后，再通知 HUD；菜单自动恢复不重复通知。曲名 / 作者描述从校验过的 1.21 客户端语言定义提取，仍在本地资源包中。提示位于原版 action bar 的底部 68 GUI 像素位置，显示 60 ticks，最后 20 ticks 淡出；时间只在书房可见时计算。音符使用原版 particle/note PNG、唱片机每 20 ticks 生成一枚、六 ticks 生命周期、0.2 向上初速度与 0.66 摩擦；四个音高颜色和位置依据 JukeboxSongPlayer / NoteParticle 参数。暂停菜单冻结粒子，停止播放取消粒子计时器；播放时按 20 Hz 请求绘制，静止首页继续按需渲染。

本地协议按照 [Electron protocol 文档](https://www.electronjs.org/docs/latest/api/protocol) 启用 stream；安全路径验证后，OGG 提供 Content-Length / Accept-Ranges 与 206 分段读取。Chromium 可以读取 Vorbis 尾部时长并拖动进度，HEAD 与错误范围有独立响应。播放与笔记流程通过实际 Electron 测试。
