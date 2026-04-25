# codex-hub

[English](https://github.com/AAAAAnson/codex-hub/blob/main/README.md) · [简体中文](README.zh.md) · [日本語](https://github.com/AAAAAnson/codex-hub/blob/main/README.ja.md) · [한국어](https://github.com/AAAAAnson/codex-hub/blob/main/README.ko.md)

OpenAI Codex CLI 的状态栏预设管理工具。一行命令切换预设布局，跨 Codex 升级保持不丢配置。

```text
Context 41% used · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready
```

## 这工具解决什么问题

Codex 通过 `~/.codex/config.toml` 里的 `[tui].status_line` 配置 TUI 状态栏 —— 它接受一组**写死的命名 item**，Codex 在输入框下面渲染成单行。原生能用，但选哪些 item、按什么顺序排，需要自己研究文档；对新用户来说 `npm install -g codex-hub-cli` 应该装完就有合理默认。

codex-hub 做三件事：

1. 内置四套预设（`minimal`、`essential`、`cockpit`、`full`），布局按"扫一眼就懂"的原则设计
2. 提供 CLI 子命令来切换 / 预览 / 合并 / 列举 status-line item
3. postinstall 安全网：检测到你已经有自定义 `status_line` 就不动手

## 跟 claude-hud 有什么不同

Codex 的 `status_line` 接受**固定的命名 item 列表**，不是外部命令（Claude Code 的 `statusLine` 接收外部命令的 stdout）。这导致一些硬限制：

| | claude-hud（Claude Code）| codex-hub（Codex）|
|---|---|---|
| 接口形式 | 调用外部命令，渲染其 stdout | 接收命名 item 列表 |
| 多行布局 | ✅ | ❌ 单行 |
| 进度条 `████░░` | ✅ | ❌ Codex 二进制里没编进字符 |
| Tools/Agents/Todos 行 | ✅（解析 transcript）| ❌ |
| 颜色 / 阈值定制 | ✅ | ❌ |

想要进度条这类高级渲染，必须从源码重编 Codex —— 见底部 [Legacy native HUD](#legacy-native-hud)。对绝大多数用户来说，四套预设已经覆盖了实用范围。

## 安装

需要先装 [Codex](https://github.com/openai/codex)：

```bash
npm install -g @openai/codex
```

然后装 codex-hub：

```bash
npm install -g codex-hub-cli
```

postinstall 只在你**没有**已有 `[tui].status_line` 时才写入 **essential** 预设。已经有自定义配置不会被覆盖。

重启 Codex：

```bash
codex
```

状态栏出现在输入框下方。`5h`、`weekly` 这两段需要 Codex 拉到额度数据后才显示，会话内发出第一条消息后就有了。

## 预设

每个预设严格包含上一个，可以渐进升级。

| 预设 | 渲染示例 |
|---|---|
| **minimal** | `gpt-5.5 xhigh fast · ~ · Ready` |
| **essential**（默认） | `Context 41% · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · ~ · Ready` |
| **cockpit** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready` |
| **full** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · v0.125.0 · main · ~ · Ready` |

布局原则：用量轴（context + token + 额度）→ 身份（model）→ 位置（branch + cwd）→ 状态。所有预设都不带 `fast-mode`，因为 `model-with-reasoning` 已经在尾部带上 ` fast` 后缀，重复展示反而冗余。

```bash
codex-hub configure --preset cockpit
codex-hub configure --preset full --force      # 覆盖已有自定义布局
codex-hub configure --preset full --dry-run    # 预览不写盘
codex-hub --list-presets                       # 列出所有预设
```

## 自定义布局

如果四套预设都不合心意，可以自己拼：

```bash
codex-hub --list-items
# context-used  five-hour-limit  weekly-limit  model-with-reasoning
# current-dir   run-state        git-branch    codex-version
# session-id    fast-mode        used-tokens   total-input-tokens
# total-output-tokens

codex-hub configure --items "context-used,run-state"
codex-hub configure --add git-branch,codex-version    # 在现有列表后追加
codex-hub configure --remove run-state                # 从现有列表移除
```

默认情况下 codex-hub 不会覆盖非空的 `status_line`，要覆盖请加 `--force`。

## 查看状态

```bash
codex-hub status
codex-hub status --json
```

输出当前 `status_line`、是否匹配某个预设、是否走了 legacy launcher、有没有残留的 codex-hub 进程。

## 全部命令

```
codex-hub configure [--preset NAME] [--items a,b,c] [--add a,b] [--remove c] [--dry-run] [--force]
codex-hub preview [--preset NAME]
codex-hub status [--json]
codex-hub uninstall
codex-hub --list-presets
codex-hub --list-items
```

## 本地开发

```bash
git clone https://github.com/AAAAAnson/codex-hub
cd codex-hub
CODEX_HUB_SKIP_POSTINSTALL=1 npm install -g .    # 别动你真实的配置

node ./bin/codex-hub.js configure --preset cockpit --dry-run
npm test
```

## Legacy native HUD

plugin-only 模式之前，codex-hub 的玩法是 patch Codex 的 Rust 源码，加一个自定义 `codex-hud` item，然后重编 Codex 替换 npm 自带的二进制。这条路还在，但**会让 macOS Computer Use 失效**（Helper 要求父进程必须是 OpenAI 签名的二进制），且每次 Codex 升级都会被覆盖：

```bash
codex-hub install --patch-launcher --codex-source ~/src/codex-source
```

撤销：

```bash
codex-hub uninstall                                       # 恢复 launcher 备份
codex-hub uninstall --codex-source ~/src/codex-source     # 同时回滚源码 patch
```

## 协议

MIT，详见 [LICENSE](LICENSE)。

## 隐私

codex-hub 不带任何 telemetry。不要把你自己的 Codex 配置、auth 文件、session 日志提交到这个 repo。

## 说明

- 这是非官方社区包，不是 OpenAI 的项目
- `Codex`、`OpenAI` 是 OpenAI 的商标
