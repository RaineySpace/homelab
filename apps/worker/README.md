# Worker

首期不启动。

当出现定时食谱、大文件解析、批量导入、长 AI 任务、导出或备份校验时，再在本目录实现 Worker。Worker 必须与 SQLite 位于同一主机，通过 Application Command 改变家庭事实，而不是另开一套写路径。
