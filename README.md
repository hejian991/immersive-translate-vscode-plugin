# VSCode Immersive Translate Plugin

Translate code or text in VS Code / Cursor — inline (Immersive) or side panel (Slide), with concurrent multi-line translation.

## Features

- **Providers:** `google-free` (default), `bing-free`, `google`, `bing`, `openai`, `gemini`, `deepseek`
- **Languages:** configurable source / target (default `en` → `zh-CN`)
- **Concurrent multi-line translation** (`concurrency`, default `5`) for Immersive and Slide
- **Three views:**
  - **Slide** — interleaved original + translation (with line-number gutter); opens beside the editor
  - **Slide (Only Target)** — full translated text only
  - **Immersive** — green italic inline decorations in the editor (`#6A9955`)
- **Per-file Translation panels** — each source file gets its own tab (`Translation: <filename>`); translating another file does not overwrite previous results
- **Shortcut** for Slide: macOS `Ctrl+Cmd+T` · Windows/Linux `Ctrl+Alt+T` (requires editor focus)

### Screenshots

**Commands**

![command list](./images/commands.png)

**Immersive (inline)**

![view inline](./images/inline.png)

**Slide (interleaved)**

![view in slide](./images/slide.png)

**Slide (only target)**

![view in slide only target](./images/slide-only-target.png)

**Configuration**

![configuration](./images/config.png)

## Commands

Command Palette:

| Command | Description |
|---------|-------------|
| `Immersive Translate: View Translate to the Slide` | Interleaved Slide panel beside the editor |
| `Immersive Translate: View Translate to the Slide (Only Target)` | Translation-only panel |
| `Immersive Translate: View Translate Immersive` | Inline decorations (up to 50 lines) |
| `Immersive Translate: Close Translate Immersive` | Clear inline decorations |

## Settings

| Setting | Default | Notes |
|---------|---------|--------|
| `vscode-immersive-translate-plugin.apiProvider` | `google-free` | See provider list above |
| `vscode-immersive-translate-plugin.apiKey` | `""` | Required for OpenAI / Gemini / DeepSeek / paid Google & Bing |
| `vscode-immersive-translate-plugin.sourceLanguage` | `en` | e.g. `en`, `auto` |
| `vscode-immersive-translate-plugin.targetLanguage` | `zh-CN` | e.g. `zh-CN`, `en` |
| `vscode-immersive-translate-plugin.concurrency` | `5` | Lines per concurrent batch (1–20) |

### API key notes

- `google-free` / `bing-free`: no API key
- `openai` / `gemini` / `deepseek`: API key required
- Paid `google` / `bing`: valid cloud credentials required

## Usage

1. Open a file in VS Code or Cursor.
2. Configure provider / languages / concurrency in Settings.
3. Run a translation command (or use the Slide shortcut).
4. For multiple files: each Slide run keeps a separate `Translation: <file>` tab; re-translating the same file updates that tab only.

## Install

### VS Marketplace / VS Code

Search: `immersive-translate-vscode-plugin` or `Immersive Translate for VS Code`
ID: `hejian991.immersive-translate-vscode-plugin`

### Open VSX / Cursor

Cursor’s panel often uses Open VSX. Search the same name / ID after it is published there.

### From VSIX

```bash
cursor --install-extension immersive-translate-vscode-plugin-0.1.2.vsix
# or: code --install-extension path/to/immersive-translate-vscode-plugin-0.1.2.vsix
```

Then **Developer: Reload Window**.

### Build & package locally

```bash
npm install
npm run compile
npm run package
```

## License

[MIT](./LICENSE)
