# VSCode Immersive Translate Plugin

A VS Code extension for code/text translation with both slide view and immersive inline view.

## Features

- Multiple providers:
  - `google-free` (default)
  - `bing-free`
  - `google` (paid API)
  - `bing` (paid API)
  - `openai`
  - `gemini`
  - `deepseek`
- Source/target language configuration (default: `en` -> `zh-CN`)
- Three translation views:
  - Side-by-side slide view (interleaved original/translation, progressive line-by-line)
  - Side-by-side slide view (Only Target, full translated text only)
  - Immersive inline view in editor

### Feature Overview
**command list**
![command list](./images/commands.png)

**translate in-line**
![view inline](./images/inline.png)

**translate in slide**
![view in slide](./images/slide.png)

**translate in slide only target**
![view in slide only target](./images/slide-only-target.png)

**configuration**
![configuration](./images/config.png)

## Commands

Open Command Palette and run:

- `Immersive Translate: View Translate to the Slide`
- `Immersive Translate: View Translate to the Slide (Only Target)`
- `Immersive Translate: View Translate Immersive`
- `Immersive Translate: Close Translate Immersive`

## Settings

Search in VS Code settings:

- `vscode-immersive-translate-plugin.apiProvider`
- `vscode-immersive-translate-plugin.apiKey`
- `vscode-immersive-translate-plugin.sourceLanguage`
- `vscode-immersive-translate-plugin.targetLanguage`

### Notes on API Key

- `google-free` and `bing-free` can be used without API key.
- `openai`, `gemini`, and `deepseek` require API key.
- Paid `google`/`bing` modes require valid cloud API configuration.

## Usage

1. Open a file in VS Code.
2. Set provider/language in Settings.
3. Run one of the translation commands.

## Build

```bash
npm install
npm run compile
```

## Package

```bash
npx @vscode/vsce package
```


## Concurrent translation (v0.0.2+)

Immersive and Slide modes translate multiple lines concurrently:

- Setting: `vscode-immersive-translate-plugin.concurrency` (default `5`)
- LLM providers (OpenAI / DeepSeek): numbered `[N]` batch request, fallback to `Promise.all`
- Free providers: concurrent `Promise.all` per batch

Ported from [immersive-translate-code](https://github.com/hejian991/immersive-translate-code) orchestrator ideas.

## Install from VSIX (GitHub Release)

1. Download the `.vsix` from [Releases](https://github.com/hejian991/vscode-immersive-translate-plugin/releases)
2. In VS Code / Cursor: Extensions → `...` → **Install from VSIX...**
3. Or CLI:

```bash
cursor --install-extension vscode-immersive-translate-plugin-0.0.2.vsix
# or: code --install-extension vscode-immersive-translate-plugin-0.0.2.vsix
```

## Package locally

```bash
npm install
npm run compile
npm run package
```

## Troubleshooting

If Command Palette shows Immersive Translate commands but running them says `command ... not found`, the extension failed to activate. v0.0.3+ packages `axios` into the VSIX and sets explicit `activationEvents`. Reload the window after install (`Developer: Reload Window`).

## Keyboard shortcut

- **macOS**: `Ctrl+Cmd+T` — `Immersive Translate: View Translate to the Slide`
- **Windows/Linux**: `Ctrl+Alt+T`

Requires editor focus (`editorTextFocus`).
