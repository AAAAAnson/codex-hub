# codex-hub

[English](https://github.com/AAAAAnson/codex-hub/blob/main/README.md) · [简体中文](https://github.com/AAAAAnson/codex-hub/blob/main/README.zh.md) · [日本語](README.ja.md) · [한국어](https://github.com/AAAAAnson/codex-hub/blob/main/README.ko.md)

OpenAI Codex CLI 用のステータスライン・プリセット管理ツール。`[tui].status_line` のレイアウトをワンコマンドで切り替えられて、Codex のアップグレードでも設定が消えません。

```text
Context 41% used · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready
```

## 何を解決するのか

Codex は `~/.codex/config.toml` の `[tui].status_line` で TUI のステータス行を構成します。受け取るのは **組み込みの命名アイテム配列** で、Codex がそれを入力欄の下に1行で描画します。動作はしますが、どのアイテムをどの順序で並べるかは自分で文書を読んで判断する必要があります。`npm install -g codex-hub-cli` してすぐ使える既定値があるべきです。

codex-hub がやることは3つ：

1. 視認性を考慮した4つのプリセット（`minimal`、`essential`、`cockpit`、`full`）を提供
2. プリセットの切替・プレビュー・差分編集・一覧用の CLI コマンドを提供
3. postinstall セーフティネット：ユーザーが既に `status_line` をカスタムしていれば触らない

## claude-hud との違い

Codex の `status_line` は **固定の命名アイテム配列** を受け取る設計で、外部コマンドではありません（Claude Code の `statusLine` API は外部コマンドを受けます）。これによる制約：

| | claude-hud（Claude Code） | codex-hub（Codex） |
|---|---|---|
| インターフェース | 外部コマンドを実行し stdout を描画 | 命名アイテム配列を受け取る |
| 複数行レイアウト | ◯ | ✕ 単一行 |
| プログレスバー `████░░` | ◯ | ✕ Codex バイナリにグリフが入っていない |
| Tools/Agents/Todos 行 | ◯（transcript 解析） | ✕ |
| 色 / しきい値カスタマイズ | ◯ | ✕ |

プログレスバーやリッチな描画が必要なら Codex をソースから再ビルドする必要があります。下の [Legacy native HUD](#legacy-native-hud) を参照。それ以外のユーザーには4つのプリセットで十分です。

## インストール

まず [Codex](https://github.com/openai/codex) を入れます：

```bash
npm install -g @openai/codex
```

次に codex-hub：

```bash
npm install -g codex-hub-cli
```

postinstall は `[tui].status_line` が **未設定** の場合にだけ **essential** プリセットを書き込みます。既存のカスタム設定は触りません。

Codex を再起動：

```bash
codex
```

ステータス行が入力欄の下に表示されます。`5h`・`weekly` の枠は Codex が利用枠データを取得した後（セッション内最初のモデル応答後）にだけ描画されます。

## プリセット

各プリセットは上のものを厳密に包含するので、段階的に増やせます。

| プリセット | 描画例 |
|---|---|
| **minimal** | `gpt-5.5 xhigh fast · ~ · Ready` |
| **essential**（既定） | `Context 41% · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · ~ · Ready` |
| **cockpit** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready` |
| **full** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · v0.125.0 · main · ~ · Ready` |

レイアウトの原則：使用量軸（context + tokens + limits）→ アイデンティティ（model）→ 位置（branch + cwd）→ 状態。`fast-mode` は全プリセットから外しています。`model-with-reasoning` が既に末尾に ` fast` を付けているので冗長になるためです。

```bash
codex-hub configure --preset cockpit
codex-hub configure --preset full --force      # 既存のカスタム配置を上書き
codex-hub configure --preset full --dry-run    # 書き込まずプレビュー
codex-hub --list-presets                       # 全プリセットを表示
```

## カスタムレイアウト

プリセットがどれもしっくりこない場合、自分で組めます：

```bash
codex-hub --list-items
# context-used  five-hour-limit  weekly-limit  model-with-reasoning
# current-dir   run-state        git-branch    codex-version
# session-id    fast-mode        used-tokens   total-input-tokens
# total-output-tokens

codex-hub configure --items "context-used,run-state"
codex-hub configure --add git-branch,codex-version    # 既存に追記
codex-hub configure --remove run-state                # 既存から削除
```

既定では codex-hub は空でない `status_line` を上書きしません。上書きしたいときは `--force` を付けます。

## ステータス確認

```bash
codex-hub status
codex-hub status --json
```

現在の `status_line`、どのプリセットに一致するか、legacy launcher が当てられているか、古い codex-hub プロセスが残っていないかを表示します。

## 全コマンド

```
codex-hub configure [--preset NAME] [--items a,b,c] [--add a,b] [--remove c] [--dry-run] [--force]
codex-hub preview [--preset NAME]
codex-hub status [--json]
codex-hub uninstall
codex-hub --list-presets
codex-hub --list-items
```

## ローカル開発

```bash
git clone https://github.com/AAAAAnson/codex-hub
cd codex-hub
CODEX_HUB_SKIP_POSTINSTALL=1 npm install -g .    # 本物の設定を触らない

node ./bin/codex-hub.js configure --preset cockpit --dry-run
npm test
```

## Legacy native HUD

plugin-only モードができる前の codex-hub は、Codex の Rust ソースに patch を当ててカスタム `codex-hud` アイテムを追加し、Codex を再ビルドして npm 同梱バイナリを置き換えていました。このモードは明示的なオプトインとして残っていますが、**macOS の Computer Use を壊します**（ヘルパーは OpenAI 署名の親プロセスを要求するため）。さらに Codex のアップグレードのたびに上書きされます：

```bash
codex-hub install --patch-launcher --codex-source ~/src/codex-source
```

元に戻す：

```bash
codex-hub uninstall                                       # launcher のバックアップを復元
codex-hub uninstall --codex-source ~/src/codex-source     # ソースの patch も巻き戻す
```

## ライセンス

MIT — [LICENSE](LICENSE) を参照。

## プライバシー

codex-hub はテレメトリを送信しません。自分の Codex 設定・auth ファイル・session ログをこの repo にコミットしないでください。

## 注記

- 本パッケージは非公式のコミュニティパッケージで、OpenAI の製品ではありません
- `Codex` と `OpenAI` は OpenAI の商標です
