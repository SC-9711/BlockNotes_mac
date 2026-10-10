# 安全与数据问题

BlockNotes 的数据库和备份保存在本机，默认数据库位于 `%APPDATA%\blocknotes\`。数据库和导出的 JSON 未加密，请自行保护文件访问权限。

公开 Issue 适合报告一般缺陷；不要附上真实笔记库、完整个人备份、认证令牌或包含个人路径的日志。请用虚构笔记构造最小复现，并标明应用版本、Windows 版本、触发步骤和实际结果。

涉及数据损坏时，先保留原数据库、WAL/SHM 文件和已有备份；不要删除数据目录，不要在唯一副本上尝试修复。应用关闭后再制作完整副本。

仓库已启用 GitHub Private vulnerability reporting：请通过 [私密漏洞报告](https://github.com/tonniescj-hub/BlockNotes/security/advisories/new) 提交可利用的安全缺陷，不要在公开 Issue 披露利用细节。项目不承诺固定响应时限。
