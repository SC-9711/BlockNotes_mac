# Java 1.21 原始音效映射

2026-10-09 用户 Steer：直接使用游戏原声，不自行绘制或合成音效。

## 来源与实现

- 官方 1.21 资源索引：`00551f206ccb65cb965fd0aebc14d22cda282db7`，官方 [asset index 17](https://piston-meta.mojang.com/v1/packages/00551f206ccb65cb965fd0aebc14d22cda282db7/17.json)。
- 官方 sounds.json：`09eab141cce7550f9a74c65db0e9abbb342cf50f`，来自 [Mojang resource object](https://resources.download.minecraft.net/09/09eab141cce7550f9a74c65db0e9abbb342cf50f)。
- 本地只选 7 个事件、17 个原始 OGG 文件，共 201,097 字节；按官方 SHA-1 校验。未转码、剪辑、均衡或合成替代音效。
- 唱片机另选 music_disc.* 的 19 张原声唱片，共 54,525,225 字节；全部逐文件 SHA-1 校验。最新 Steer 限定只留唱片音乐，60 首环境 BGM 已从本地包删除。曲目清单在忽略的 sounds/music-manifest.json；下载与清理由 setup-local-music.mjs 复现。
- 原版声音文件、事件变体、权重、volume 与 pitch 在忽略的 `public/minecraft/sounds/` 中；声音与纹理适用相同的本地资源包隔离规则。
- `scripts/setup-local-sounds.ps1` 可复现下载与清单；主资源初始化脚本调用它。运行时只从本地包读取，Web Audio 一次解码、按交互播放；不依赖网络。

## 操作对应

| 软件操作 | 原版事件 | 原始声音 |
| --- | --- | --- |
| 点击箱子 / 进入归档箱 | block.chest.open | block/chest/open.ogg |
| 关闭归档箱 / Esc 返回 | block.chest.close | block/chest/close1–3.ogg |
| 打开书本 / 讲台阅读 / 点击翻页箭头 | item.book.page_turn | item/book/open_flip1–3.ogg |
| 完成编辑、放回书本 | item.book.put | item/book/close_put1–2.ogg |
| 打开书架取书 | block.chiseled_bookshelf.pickup | block/chiseled_bookshelf/pickup1–3.ogg |
| 移动书架 / 从归档恢复到书架 | block.chiseled_bookshelf.insert | block/chiseled_bookshelf/insert1–4.ogg |
| 普通界面按钮 | ui.button.click | random/click_stereo.ogg |

原版普通书架没有打开容器的声音事件；本软件的分类书架以雕纹书架的取放书声对应实际的收纳动作。讲台没有独立的 `lectern.open` 声音事件，读取书本采用原版翻页声，未虚构或合成新事件。界面点击与语义操作分开处理，翻页不叠加按钮点击声；自动保存和键入正文不产生音效。

使用原版事件的音高变体与抽样权重；箱子有 0.9–1.0 的音高变化。UI 点击基准音量 0.25，翻页按 sounds.json 的 volume 2.0 得到 0.5；取放书保留声音定义中的 0.8 与音高变体。全局音效音量默认 100%，设置为 0 静音，并持久化于现有 settings 表。

## 验证与边界

Electron 集成测试检查全部 OGG 文件的官方 SHA-1，独立解码原声生成 PCM 指纹；实际操作后检查 AudioBufferSourceNode.start 使用的 PCM、音量和音高。覆盖箱子开合、翻页、按钮、书架取放、静音及重启设置保持。

运行时使用 Web Audio 输出，而不是游戏的 OpenAL 声音引擎；当前没有模拟游戏的完整空间衰减或 HRTF 混音，也未进行声卡录音对照。原始声音文件是同一份，不能因此宣称整个声音引擎逐样本输出完全一致。音效缺失、解码或设备不可用都不会阻断编辑、保存或恢复数据。

唱片与短音效分开：HTMLAudioElement 流式播放，音乐音量独立。测试核对 19 个原始文件校验和、真实播放时间推进、有限时长、进度拖动、切曲、暂停与菜单恢复、重启选曲 / 音量记忆；听音乐时编辑中文笔记并保存重开。没有让所有曲目同时解码，也没有替换为外部流媒体或翻录。
