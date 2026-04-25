# codex-hub

[English](https://github.com/AAAAAnson/codex-hub/blob/main/README.md) · [简体中文](https://github.com/AAAAAnson/codex-hub/blob/main/README.zh.md) · [日本語](https://github.com/AAAAAnson/codex-hub/blob/main/README.ja.md) · [한국어](README.ko.md)

OpenAI Codex CLI용 상태 줄(status line) 프리셋 관리 도구. `[tui].status_line` 레이아웃을 한 명령으로 전환하고, Codex 업그레이드에도 설정이 보존됩니다.

```text
Context 41% used · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready
```

## 무엇을 해결하나

Codex는 `~/.codex/config.toml`의 `[tui].status_line`에서 TUI 상태 줄을 구성합니다. 이 키는 **고정된 이름의 내장 아이템 목록**을 받고, Codex가 입력창 아래에 한 줄로 렌더링합니다. 동작은 하지만 어떤 아이템을 어떤 순서로 둘지는 직접 알아내야 하고, `npm install -g codex-hub-cli`만 하면 합리적인 기본값이 잡혀야 합니다.

codex-hub가 하는 세 가지:

1. 한눈에 스캔할 수 있도록 설계된 네 개 프리셋(`minimal`, `essential`, `cockpit`, `full`)을 제공
2. status-line 아이템을 전환·미리보기·병합·나열하는 CLI 명령을 제공
3. postinstall 안전장치: 사용자가 이미 `status_line`을 커스터마이징해 두었다면 건드리지 않음

## claude-hud와 무엇이 다른가

Codex의 `status_line`은 **이름 붙은 아이템 목록**을 받는 설계로, 외부 명령을 받는 게 아닙니다 (Claude Code의 `statusLine` API는 외부 명령을 받습니다). 이로 인한 강한 제약:

| | claude-hud (Claude Code) | codex-hub (Codex) |
|---|---|---|
| 인터페이스 | 외부 명령을 실행하고 stdout을 렌더링 | 이름 아이템 목록을 받음 |
| 멀티 라인 레이아웃 | ✅ | ❌ 한 줄 |
| 진행률 막대 `████░░` | ✅ | ❌ Codex 바이너리에 글리프가 없음 |
| Tools/Agents/Todos 라인 | ✅ (transcript 파싱) | ❌ |
| 색상/임계값 커스터마이징 | ✅ | ❌ |

진행률 막대 같은 풍부한 렌더링이 필요하면 Codex를 소스에서 다시 빌드해야 합니다. 아래 [Legacy native HUD](#legacy-native-hud) 참고. 대부분 사용자에게는 네 개 프리셋으로 충분합니다.

## 설치

먼저 [Codex](https://github.com/openai/codex)가 필요합니다:

```bash
npm install -g @openai/codex
```

그 다음 codex-hub:

```bash
npm install -g codex-hub-cli
```

postinstall은 `[tui].status_line`이 **없을 때만** **essential** 프리셋을 적용합니다. 이미 있는 커스텀 레이아웃은 그대로 둡니다.

Codex를 재시작:

```bash
codex
```

상태 줄이 입력창 아래에 나타납니다. `5h`, `weekly` 구간은 Codex가 사용량 데이터를 가져온 뒤(세션의 첫 모델 응답 이후)에만 렌더링됩니다.

## 프리셋

각 프리셋은 위 것을 엄격히 포함하므로, 점진적으로 더 많은 정보를 띄울 수 있습니다.

| 프리셋 | 렌더링 예시 |
|---|---|
| **minimal** | `gpt-5.5 xhigh fast · ~ · Ready` |
| **essential** *(기본)* | `Context 41% · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · ~ · Ready` |
| **cockpit** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · main · ~ · Ready` |
| **full** | `Context 41% · 27.2M in · 83K out · 5h 79% · weekly 38% · gpt-5.5 xhigh fast · v0.125.0 · main · ~ · Ready` |

레이아웃 원칙: 사용량 축(context + tokens + limits) → 정체성(model) → 위치(branch + cwd) → 상태. `fast-mode`는 모든 프리셋에서 의도적으로 제외했습니다. `model-with-reasoning`이 이미 말미에 ` fast` 접미사를 붙이므로 중복이 되기 때문입니다.

```bash
codex-hub configure --preset cockpit
codex-hub configure --preset full --force      # 기존 커스텀 레이아웃을 덮어쓰기
codex-hub configure --preset full --dry-run    # 쓰지 않고 미리보기
codex-hub --list-presets                       # 모든 프리셋 출력
```

## 커스텀 레이아웃

프리셋이 맞지 않으면 직접 조합:

```bash
codex-hub --list-items
# context-used  five-hour-limit  weekly-limit  model-with-reasoning
# current-dir   run-state        git-branch    codex-version
# session-id    fast-mode        used-tokens   total-input-tokens
# total-output-tokens

codex-hub configure --items "context-used,run-state"
codex-hub configure --add git-branch,codex-version    # 기존에 추가
codex-hub configure --remove run-state                # 기존에서 제거
```

기본적으로 codex-hub는 비어 있지 않은 `status_line`을 덮어쓰지 않습니다. 덮어쓰려면 `--force`를 붙이세요.

## 상태 확인

```bash
codex-hub status
codex-hub status --json
```

현재 `status_line`, 어느 프리셋과 일치하는지, legacy launcher가 패치돼 있는지, 잔여 codex-hub 프로세스가 남아 있는지를 보고합니다.

## 전체 명령

```
codex-hub configure [--preset NAME] [--items a,b,c] [--add a,b] [--remove c] [--dry-run] [--force]
codex-hub preview [--preset NAME]
codex-hub status [--json]
codex-hub uninstall
codex-hub --list-presets
codex-hub --list-items
```

## 로컬 개발

```bash
git clone https://github.com/AAAAAnson/codex-hub
cd codex-hub
CODEX_HUB_SKIP_POSTINSTALL=1 npm install -g .    # 실제 설정을 건드리지 않기

node ./bin/codex-hub.js configure --preset cockpit --dry-run
npm test
```

## Legacy native HUD

plugin-only 모드 이전의 codex-hub는 Codex의 Rust 소스에 patch를 적용해 커스텀 `codex-hud` 아이템을 추가하고, Codex를 재빌드해서 npm 번들 바이너리를 교체했습니다. 이 모드는 명시적 옵트인으로 남아 있지만 **macOS Computer Use를 망가뜨립니다** (헬퍼가 OpenAI 서명된 부모 프로세스를 요구하기 때문). 또 Codex 업그레이드마다 덮어써집니다:

```bash
codex-hub install --patch-launcher --codex-source ~/src/codex-source
```

되돌리기:

```bash
codex-hub uninstall                                       # launcher 백업 복원
codex-hub uninstall --codex-source ~/src/codex-source     # 소스 patch도 되돌리기
```

## 라이선스

MIT — [LICENSE](LICENSE) 참고.

## 개인정보

codex-hub는 텔레메트리를 추가하지 않습니다. 본인의 Codex 설정·auth 파일·session 로그를 이 repo에 커밋하지 마세요.

## 참고

- 비공식 커뮤니티 패키지로, OpenAI 제품이 아닙니다
- `Codex`와 `OpenAI`는 OpenAI의 상표입니다
