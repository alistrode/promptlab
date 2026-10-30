---
name: promptlab
description: 运行、调试与维护 PromptLab 本地提示词调优工作台时使用；覆盖自包含包启动、健康检查、Ollama 模型依赖、调优轮次与采纳门槛排障。
---

# PromptLab

## 何时使用

- 需要在本机启动、重启或停止 PromptLab（默认 http://127.0.0.1:5181）。
- 提示词调优任务起不来、模型列表为空、采纳按钮被锁住、回归门槛不通过。
- 需要从源码构建，或重新生成自包含免安装分发包。

## 关键事实

| 项 | 值 |
|---|---|
| 监听地址 | `http://127.0.0.1:5181`（硬编码，仅回环） |
| 运行时 | Windows x64；分发包自带 .NET 10.0.12，无需安装 .NET |
| 外部依赖 | 本机 Ollama（默认 `http://127.0.0.1:11434`），建议 `qwen3-vl:4b` |
| 环境变量 | `PROMPTLAB_OLLAMA_URL`，只接受 `127.0.0.1` 或 `localhost` |
| 调优记录 | `%LOCALAPPDATA%\PromptLab\runs` |
| 上限 | 最多 12 条用例，每次 1–3 轮调优 |

## 常用命令与等效文件索引

| 用途 | 命令 | 等效代码 / 脚本 |
|---|---|---|
| 启动（自动选用分发包） | `.\scripts\start.ps1` | `scripts/start.ps1` → `scripts/launch.ps1` |
| 健康检查 | `Invoke-RestMethod http://127.0.0.1:5181/api/health` | `src/Program.cs` 的 `/api/health` 端点 |
| 查看服务与模型状态 | `Invoke-RestMethod http://127.0.0.1:5181/api/status` | `src/Program.cs` 的 `/api/status` 端点 |
| 列出调优记录 | `Invoke-RestMethod http://127.0.0.1:5181/api/runs` | `src/Program.cs` → `RunStore.List` |
| 从源码运行 | `dotnet run --project src\PromptLab.csproj -c Release` | `src/PromptLab.csproj` |
| 重新生成自包含包 | `dotnet publish src\PromptLab.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish` | `src/PromptLab.csproj` |
| 查看调优记录文件 | `Get-ChildItem "$env:LOCALAPPDATA\PromptLab\runs"` | `src/Program.cs` → `RunStore` |
| 停止进程 | `Get-Process PromptLab -ErrorAction SilentlyContinue \| Stop-Process -Force` | — |

## 排障顺序

1. `launch.ps1` 先探测 `/api/health`，返回 `product=PromptLab` 就复用已运行实例。
2. 报 `PromptLab executable not found` 说明 `publish\PromptLab.exe` 缺失——解压 Release 的 `promptlab-v*-win-x64.zip` 覆盖。
3. 采纳按钮锁住是设计行为：候选整体分必须严格高于原版，且独立回归集不低于原版，同分不算提升。
4. 模型列表为空 → 先 `ollama pull qwen3-vl:4b` 或改 `PROMPTLAB_OLLAMA_URL` 指向已装模型的本机实例。

## 目录说明

- `src/` — 全部源码（`Program.cs`、`PromptLab.csproj`、`wwwroot/`、`assets/`）
- `scripts/` — 启动脚本
- `README.md` — 产品说明
- Release 附件 `promptlab-v*-win-x64.zip` — 自包含免安装分发包
