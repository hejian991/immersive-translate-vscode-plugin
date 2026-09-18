import * as vscode from 'vscode';
import { getConfig, validateConfig, TranslateConfig } from './config';
import { createTranslationService, TranslationService } from './translationService';
import { chunkArray } from './batch';

/** One Translation panel per source document URI — different files keep separate results. */
const translateSlidePanels = new Map<string, vscode.WebviewPanel>();
let immersiveDecorationType: vscode.TextEditorDecorationType | undefined;
let immersiveDecorations: vscode.DecorationOptions[] = [];

function slidePanelKey(document: vscode.TextDocument): string {
    return document.uri.toString();
}

function slidePanelTitle(document: vscode.TextDocument): string {
    const name = document.uri.scheme === 'untitled'
        ? (document.fileName || 'Untitled')
        : document.uri.path.split('/').pop() || document.fileName;
    return `Translation: ${name}`;
}

/**
 * Get or create a Slide webview for this source document.
 * Same file reuses/updates its panel; another file opens a new tab.
 */
function getOrCreateSlidePanel(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
): vscode.WebviewPanel {
    const key = slidePanelKey(document);
    const column = vscode.window.activeTextEditor
        ? vscode.ViewColumn.Beside
        : vscode.ViewColumn.One;

    const existing = translateSlidePanels.get(key);
    if (existing) {
        existing.title = slidePanelTitle(document);
        existing.reveal(column);
        return existing;
    }

    const panel = vscode.window.createWebviewPanel(
        'translateSlide',
        slidePanelTitle(document),
        column,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    translateSlidePanels.set(key, panel);
    panel.onDidDispose(
        () => {
            if (translateSlidePanels.get(key) === panel) {
                translateSlidePanels.delete(key);
            }
        },
        null,
        context.subscriptions
    );

    return panel;
}

export function activate(context: vscode.ExtensionContext) {
    try {
    // Initialize decoration type for immersive translation
    immersiveDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            color: '#6A9955',
            fontStyle: 'italic',
            margin: '0 0 0 2em'
        }
    });

    // Register Translate to Slide command
    const translateToSlideCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.translateToSlide',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found.');
                return;
            }

            const text = editor.document.getText();

            if (!text.trim()) {
                vscode.window.showWarningMessage('Current file is empty.');
                return;
            }

            const config = getConfig();
            const validation = validateConfig(config);
            if (!validation.valid) {
                vscode.window.showErrorMessage(validation.message || 'Invalid configuration');
                return;
            }

            await showTranslateSlidePanel(context, editor.document, text, config);
        }
    );

    const translateToSlideOnlyTargetCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.translateToSlideOnlyTarget',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found.');
                return;
            }

            const text = editor.document.getText();

            if (!text.trim()) {
                vscode.window.showWarningMessage('Current file is empty.');
                return;
            }

            const config = getConfig();
            const validation = validateConfig(config);
            if (!validation.valid) {
                vscode.window.showErrorMessage(validation.message || 'Invalid configuration');
                return;
            }

            await showTranslateSlidePanelOnlyTarget(context, editor.document, text, config);
        }
    );

    // Register Translate Immersive command
    const translateImmersiveCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.translateImmersive',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found.');
                return;
            }

            const config = getConfig();
            const validation = validateConfig(config);
            if (!validation.valid) {
                vscode.window.showErrorMessage(validation.message || 'Invalid configuration');
                return;
            }

            await translateImmersive(editor, config);
        }
    );

    // Register Close Translate Immersive command
    const closeTranslateImmersiveCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.closeTranslateImmersive',
        () => {
            clearImmersiveDecorations();
            vscode.window.showInformationMessage('Immersive translation closed.');
        }
    );

    context.subscriptions.push(
        translateToSlideCommand,
        translateToSlideOnlyTargetCommand,
        translateImmersiveCommand,
        closeTranslateImmersiveCommand,
        immersiveDecorationType
    );
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Immersive Translate failed to activate: ${msg}`);
        console.error('[vscode-immersive-translate-plugin] activate failed', err);
        throw err;
    }
}


/**
 * Translate many lines concurrently (ported from immersive-translate-code):
 * - LLM providers: prefer one numbered-batch request; fallback Promise.all singles
 * - Free providers: concurrent singles via Promise.all in chunks of `concurrency`
 */
async function translateLinesConcurrently(
    service: TranslationService,
    texts: string[],
    config: TranslateConfig,
    onBatchDone?: (completedCount: number, total: number) => void,
    token?: vscode.CancellationToken
): Promise<string[]> {
    const results = new Array<string>(texts.length).fill('');
    if (texts.length === 0) {
        return results;
    }

    const indices = texts.map((_, i) => i);
    const batches = chunkArray(indices, config.concurrency);
    let completed = 0;

    for (const batchIdx of batches) {
        if (token?.isCancellationRequested) {
            break;
        }

        const batchTexts = batchIdx.map((i) => texts[i]);

        let batchResults: string[];
        if (service.translateBatch && batchTexts.length > 0) {
            try {
                batchResults = await service.translateBatch(batchTexts, config);
            } catch {
                batchResults = await Promise.all(
                    batchTexts.map(async (t) => {
                        try {
                            return (await service.translate(t, config)).text;
                        } catch {
                            return '';
                        }
                    })
                );
            }
        } else {
            batchResults = await Promise.all(
                batchTexts.map(async (t) => {
                    if (!t.trim()) {
                        return '';
                    }
                    try {
                        return (await service.translate(t, config)).text;
                    } catch {
                        return '[Translation failed]';
                    }
                })
            );
        }

        batchIdx.forEach((lineIdx, j) => {
            results[lineIdx] = batchResults[j] ?? '';
        });
        completed += batchIdx.length;
        onBatchDone?.(completed, texts.length);
    }

    return results;
}

async function showTranslateSlidePanel(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    text: string,
    config: TranslateConfig
): Promise<void> {
    const panel = getOrCreateSlidePanel(context, document);
    const panelKey = slidePanelKey(document);

    const originalLines = text.split(/\r?\n/);
    const translatedLines = new Array<string>(originalLines.length).fill('');
    panel.webview.html = getTranslationResultHtml(originalLines, translatedLines, true);

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Translating ${slidePanelTitle(document).replace(/^Translation: /, '')}...`,
                cancellable: true
            },
            async (progress, token) => {
                const service = createTranslationService(config.apiProvider);
                // Collect non-empty lines as a flat work list. Do NOT use
                // groupConsecutive(lineIndex): blank lines make indices
                // non-adjacent, which collapsed every batch to size 1 and
                // made `concurrency` look ineffective for Slide mode.
                const work: { lineIdx: number; text: string }[] = [];
                for (let i = 0; i < originalLines.length; i++) {
                    const lineText = originalLines[i];
                    if (lineText.trim()) {
                        work.push({ lineIdx: i, text: lineText });
                    }
                }

                const batches = chunkArray(work, config.concurrency);
                let done = 0;

                for (const batch of batches) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    const batchTexts = batch.map((item) => item.text);
                    // Translate this chunk directly (size === concurrency).
                    // Avoid nested translateLinesConcurrently re-chunking.
                    let batchResults: string[];
                    if (service.translateBatch && batchTexts.length > 0) {
                        try {
                            batchResults = await service.translateBatch(batchTexts, config);
                        } catch {
                            batchResults = await Promise.all(
                                batchTexts.map(async (t) => {
                                    try {
                                        return (await service.translate(t, config)).text;
                                    } catch {
                                        return '[Translation failed]';
                                    }
                                })
                            );
                        }
                    } else {
                        batchResults = await Promise.all(
                            batchTexts.map(async (t) => {
                                try {
                                    return (await service.translate(t, config)).text;
                                } catch {
                                    return '[Translation failed]';
                                }
                            })
                        );
                    }

                    batch.forEach((item, j) => {
                        translatedLines[item.lineIdx] = batchResults[j] || '[Translation failed]';
                    });

                    done += batch.length;
                    progress.report({
                        message: `Batch ${done}/${work.length} (concurrency=${config.concurrency})`,
                        increment: (100 * batch.length) / Math.max(work.length, 1)
                    });

                    const live = translateSlidePanels.get(panelKey);
                    if (live) {
                        live.webview.html = getTranslationResultHtml(originalLines, translatedLines, true);
                    }
                }
            }
        );

        const live = translateSlidePanels.get(panelKey);
        if (live) {
            live.webview.html = getTranslationResultHtml(originalLines, translatedLines, false);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const live = translateSlidePanels.get(panelKey);
        if (live) {
            live.webview.html = getErrorHtml(errorMessage);
        }
    }
}

async function showTranslateSlidePanelOnlyTarget(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    text: string,
    config: TranslateConfig
): Promise<void> {
    const panel = getOrCreateSlidePanel(context, document);
    const panelKey = slidePanelKey(document);

    panel.webview.html = getOnlyTargetResultHtml('', true);

    try {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Translating ${slidePanelTitle(document).replace(/^Translation: /, '')}...`,
                cancellable: false
            },
            async () => {
                const service = createTranslationService(config.apiProvider);
                return service.translate(text, config);
            }
        );

        const live = translateSlidePanels.get(panelKey);
        if (live) {
            live.webview.html = getOnlyTargetResultHtml(result.text, false);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const live = translateSlidePanels.get(panelKey);
        if (live) {
            live.webview.html = getErrorHtml(errorMessage);
        }
    }
}

async function translateImmersive(
    editor: vscode.TextEditor,
    config: TranslateConfig
): Promise<void> {
    // Clear existing decorations
    immersiveDecorations = [];

    const document = editor.document;
    const lineCount = Math.min(document.lineCount, 50); // Limit to 50 lines for performance

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Translating...',
            cancellable: true
        },
        async (progress, token) => {
            const service = createTranslationService(config.apiProvider);

            const work: { lineNum: number; text: string }[] = [];
            for (let i = 0; i < lineCount; i++) {
                const lineText = document.lineAt(i).text.trim();
                if (lineText) {
                    work.push({ lineNum: i, text: lineText });
                }
            }

            const batches = chunkArray(work, config.concurrency);
            let done = 0;

            for (const batch of batches) {
                if (token.isCancellationRequested) {
                    break;
                }

                progress.report({
                    message: `Line ${done + 1}-${Math.min(done + batch.length, work.length)}/${work.length} (concurrency=${config.concurrency})`,
                    increment: 0
                });

                const texts = batch.map((b) => b.text);
                const translations = await translateLinesConcurrently(
                    service,
                    texts,
                    config,
                    undefined,
                    token
                );

                batch.forEach((item, j) => {
                    const translated = translations[j];
                    if (!translated) {
                        return;
                    }
                    const line = document.lineAt(item.lineNum);
                    immersiveDecorations.push({
                        range: line.range,
                        renderOptions: {
                            after: {
                                contentText: translated
                            }
                        }
                    });
                });

                editor.setDecorations(immersiveDecorationType!, [...immersiveDecorations]);

                done += batch.length;
                progress.report({
                    message: `Line ${done}/${work.length} (concurrency=${config.concurrency})`,
                    increment: (100 * batch.length) / Math.max(work.length, 1)
                });
            }
        }
    );

    vscode.window.showInformationMessage(`Immersive translation complete.`);
}

function clearImmersiveDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && immersiveDecorationType) {
        editor.setDecorations(immersiveDecorationType, []);
    }
    immersiveDecorations = [];
}

function getTranslationResultHtml(originalLines: string[], translatedLines: string[], translating: boolean): string {
    const interleavedHtml = buildInterleavedHtml(originalLines, translatedLines);
    const status = translating ? '<div class="status">Translating...</div>' : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Result</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
                    font-size: var(--vscode-editor-font-size, 14px);
                    font-weight: var(--vscode-editor-font-weight, normal);
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .content {
                    line-height: 1.5;
                    tab-size: 4;
                    padding: 8px 8px 8px 0;
                    margin: 0;
                }
                .status {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    margin: 0;
                    padding: 6px 12px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .row {
                    display: flex;
                    align-items: flex-start;
                    margin: 0;
                    padding: 0;
                }
                .gutter {
                    flex: 0 0 3.5em;
                    width: 3.5em;
                    padding: 0 8px 0 4px;
                    text-align: right;
                    user-select: none;
                    color: var(--vscode-editorLineNumber-foreground, #858585);
                    font-variant-numeric: tabular-nums;
                }
                .gutter.empty {
                    color: transparent;
                }
                .line {
                    flex: 1 1 auto;
                    min-width: 0;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    margin: 0;
                    padding: 0;
                }
                .line.original {
                    color: var(--vscode-editor-foreground);
                }
                .line.translation {
                    color: #6A9955;
                    font-style: italic;
                    background: transparent;
                    border-left: none;
                    padding: 0;
                    margin: 0 0 6px 0;
                }
            </style>
        </head>
        <body>${status}<div class="content">${interleavedHtml}</div></body>
        </html>
    `;
}

function getOnlyTargetResultHtml(translatedText: string, translating: boolean): string {
    const translatedLinesHtml = translatedText
        .split(/\r?\n/)
        .map((line) => `<div class="line translation">${escapeHtml(line)}</div>`)
        .join('');
    const status = translating ? '<div class="status">Translating...</div>' : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Result</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
                    font-size: var(--vscode-editor-font-size, 14px);
                    font-weight: var(--vscode-editor-font-weight, normal);
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .status {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    margin: 0;
                    padding: 6px 12px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .content {
                    line-height: 1.5;
                    tab-size: 4;
                    padding: 8px 12px;
                    margin: 0;
                }
                .line {
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    margin: 0;
                    padding: 0;
                }
                .line.translation {
                    color: #6A9955;
                    font-style: italic;
                    background: transparent;
                    border-left: none;
                    padding: 0;
                    margin: 0 0 6px 0;
                }
            </style>
        </head>
        <body>${status}<div class="content">${translatedLinesHtml}</div></body>
        </html>
    `;
}

function buildInterleavedHtml(originalLines: string[], translatedLines: string[]): string {
    const maxLines = Math.max(originalLines.length, translatedLines.length);
    const rows: string[] = [];

    for (let i = 0; i < maxLines; i++) {
        const originalLine = escapeHtml(originalLines[i] ?? '');
        const translatedLine = escapeHtml(translatedLines[i] ?? '');
        // 1-based line number matching the source editor; only on original rows.
        const lineNo = String(i + 1);

        rows.push(
            `<div class="row">` +
            `<span class="gutter" aria-hidden="true">${lineNo}</span>` +
            `<div class="line original">${originalLine}</div>` +
            `</div>`
        );
        rows.push(
            `<div class="row">` +
            `<span class="gutter empty" aria-hidden="true">${lineNo}</span>` +
            `<div class="line translation">${translatedLine}</div>` +
            `</div>`
        );
    }

    return rows.join('');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getErrorHtml(errorMessage: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Error</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .error-box {
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    padding: 16px;
                    border-radius: 6px;
                }
                .error-title {
                    color: #F44747;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
            </style>
        </head>
        <body>
            <div class="error-box">
                <div class="error-title">⚠️ Translation Failed</div>
                <div>${errorMessage}</div>
            </div>
        </body>
        </html>
    `;
}

export function deactivate() {
    for (const panel of translateSlidePanels.values()) {
        panel.dispose();
    }
    translateSlidePanels.clear();
    immersiveDecorationType?.dispose();
    immersiveDecorations = [];
}
