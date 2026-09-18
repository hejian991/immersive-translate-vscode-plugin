# VSCode Immersive Translate Plugin

Translate code or text in VS Code / Cursor — inline (Immersive) or side panel (Slide), with concurrent multi-line translation.

**Repository:** [hejian991/immersive-translate-vscode-plugin](https://github.com/hejian991/immersive-translate-vscode-plugin)  
**License:** MIT · **Version:** 0.0.9 · **Publisher:** `hejian991`  
**Extension ID:** `hejian991.vscode-immersive-translate-plugin` (Marketplace / Open VSX)

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

## Concurrent translation

Immersive and Slide translate in batches of `concurrency`:

- **LLM** (OpenAI / DeepSeek): numbered `[N]` batch request first; on failure, `Promise.all` singles
- **Free providers:** `Promise.all` per batch
- Slide batches use a flat work list (`chunkArray`), so blank lines do not break concurrency

Ideas ported from [immersive-translate-code](https://github.com/hejian991/immersive-translate-code).

## Install

### From Open VSX / Cursor Extensions panel

Cursor’s extension search uses **Open VSX** (not VS Marketplace by default). Search for:

- `vscode-immersive-translate-plugin`, or  
- `VSCode Immersive Translate Plugin`, or  
- full ID `hejian991.vscode-immersive-translate-plugin`

> Do **not** search by the GitHub repo name `immersive-translate-vscode-plugin` alone — that is the **repository** name. The Marketplace/`package.json` **`name`** (extension ID suffix) is `vscode-immersive-translate-plugin` and must stay stable once published.

### From VSIX

1. Download a `.vsix` from [Releases](https://github.com/hejian991/immersive-translate-vscode-plugin/releases) (or build locally).
2. Extensions → `...` → **Install from VSIX...**, or:

```bash
cursor --install-extension vscode-immersive-translate-plugin-0.0.9.vsix
# or: code --install-extension path/to/vscode-immersive-translate-plugin-0.0.9.vsix
```

3. Run **Developer: Reload Window**.

### Build & package locally

```bash
npm install
npm run compile
npm run package   # → vscode-immersive-translate-plugin-0.0.9.vsix
```

### Publish

```bash
# Open VSX (what Cursor searches)
npx ovsx publish vscode-immersive-translate-plugin-0.0.9.vsix -p "$OVSX_PAT"

# VS Marketplace (needs Azure DevOps Marketplace PAT + vsce login)
vsce publish
# or: vsce publish --packagePath vscode-immersive-translate-plugin-0.0.9.vsix
```

## Troubleshooting

If Command Palette lists Immersive Translate commands but running them says `command ... not found`, the extension did not activate. **v0.0.3+** packages `axios` into the VSIX and sets explicit `activationEvents`. Reload the window after install.

If publish says the extension **already exists**, you are usually:

1. republishing an **existing version** (bump `version` in `package.json`), or  
2. accidentally creating a **new** `publisher.name` by renaming `package.json` `name` — keep `name` as `vscode-immersive-translate-plugin` and only bump the version.  
3. On Open VSX, a version can be **published but inactive** (not searchable). Bump the version and publish again; or wait for namespace/version activation.

## Changelog (highlights)

| Version | Changes |
|---------|---------|
| **0.0.9** | Updated extension icon (pink 文/A) |
| **0.0.8** | Stable ID docs; Open VSX publish of 0.0.8 stayed inactive — superseded by 0.0.9 |
| **0.0.7** | Refresh README and publish metadata |
| **0.0.6** | Per-file Translation panels (`Translation: <filename>`); MIT license; GitHub repo `immersive-translate-vscode-plugin` |
| **0.0.5** | Slide line-number gutter; `Ctrl+Cmd+T` / `Ctrl+Alt+T` shortcut |
| **0.0.4** | Fix Slide concurrency when documents contain blank lines |
| **0.0.3** | Package `axios`; fix activation / “command not found” |
| **0.0.2** | Concurrent multi-line translation + `concurrency` setting |

## License

[MIT](./LICENSE)
