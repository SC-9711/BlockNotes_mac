# BlockNotes 图标

2026-10-10 用户从三款概念稿中选定 A「书与笔」：棕色皮革书、浅色纸页、白色羽毛笔，无文字、透明背景。使用内置 imagegen 生成原创概念稿，并保留选定原稿；不是从游戏资源包导出的道具图。

- 原稿：`assets/branding/book-and-quill-master.png`（1254×1254 RGBA）。
- 应用 PNG：`public/branding/blocknotes.png`（512×512）。
- Windows ICO：`public/branding/blocknotes.ico`，含 16、24、32、48、64、128、256 七种独立 PNG 帧。
- 浏览器图标：`public/branding/favicon.png`（32×32）。

仅使用最近邻缩放与文件格式转换，保留用户选定的构图、颜色和透明通道。BrowserWindow 使用 ICO；Windows 打包启用资源编辑以嵌入图标与产品信息，`signExecutable: false` 保留不签名的本地构建策略。图标资产与原版 Minecraft 本地资源包独立。

生成提示词（选定稿，内置 imagegen）：

> A Windows desktop application icon for BlockNotes, an offline note-taking app set in a Minecraft Java Edition 1.21 study. ONE square icon; no text, wordmark, letters or watermark. Rigid cuboid geometry, crisp low-resolution pixel textures, discrete highlights, clear dark stepped silhouette and restrained six-face lighting. Large centered subject on a transparent background, readable at 32 px. A recognizable Book and Quill: one thick closed brown leather book, ivory pixelated page edges, warm russet square cover and darker spine, in three-quarter isometric inventory view. One white/light-gray stepped feather with a dark nib rests diagonally across the cover. The book is the largest form. No ribbon, sparkles, base block or badge. No smooth voxel toy, rounded clay, realistic render, glossy mobile icon, blur, bloom, gradients or cinematic lighting.
