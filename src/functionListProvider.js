'use strict';
const vscode = require('vscode');

// \w не покриває кирилицю в JS — використовуємо [\w\u0400-\u04FF]+
const W = '[\\w\\u0400-\\u04FF]+';

const DEFAULT_PATTERNS = [
  // 1C BSL — платформа підтримує тільки російські ключові слова (плюс англійський варіант нижче)
  { re: new RegExp(`^\\s*Процедура\\s+(${W})\\s*\\(`), kind: 'bsl-procedure', langs: ['bsl'] },
  { re: new RegExp(`^\\s*Функция\\s+(${W})\\s*\\(`),   kind: 'bsl-function',  langs: ['bsl'] },
  // JavaScript / TypeScript
  { re: new RegExp(`^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+(${W})\\s*\\(`), kind: 'function', langs: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'] },
  // Python
  { re: new RegExp(`^\\s*(?:async\\s+)?def\\s+(${W})\\s*\\(`),             kind: 'function', langs: ['python'] },
  // Go — метод (є ресивер) відрізняється від звичайної функції
  { re: new RegExp(`^\\s*func\\s+\\(\\w+\\s+\\*?\\w+\\)\\s+(${W})\\s*\\(`), kind: 'method',   langs: ['go'] },
  { re: new RegExp(`^\\s*func\\s+(${W})\\s*\\(`),                          kind: 'function', langs: ['go'] },
  // Kotlin / Swift
  { re: new RegExp(`^\\s*(?:fun|func)\\s+(${W})\\s*[<(]`),                 kind: 'function', langs: ['kotlin', 'swift'] },
  // Rust
  { re: new RegExp(`^\\s*(?:pub\\s+)?(?:async\\s+)?fn\\s+(${W})\\s*[<(]`), kind: 'function', langs: ['rust'] },
  // PHP
  { re: new RegExp(`^\\s*(?:(?:public|private|protected|static)\\s+)*function\\s+(${W})\\s*\\(`), kind: 'function', langs: ['php'] },
  // C# / Java / C++
  { re: new RegExp(`^\\s*(?:(?:public|private|protected|static|virtual|override|async)\\s+)*(?:void|int|string|bool|float|double|${W})\\s+(${W})\\s*\\(`), kind: 'method', langs: ['csharp', 'java', 'cpp', 'c'] },
  // VBA / VBScript
  { re: new RegExp(`^\\s*(?:Public\\s+|Private\\s+)?Sub\\s+(${W})\\s*\\(`),      kind: 'procedure', langs: ['vb'] },
  { re: new RegExp(`^\\s*(?:Public\\s+|Private\\s+)?Function\\s+(${W})\\s*\\(`), kind: 'function',  langs: ['vb'] },
  // Ruby
  { re: new RegExp(`^\\s*def\\s+(${W})`),                                  kind: 'function', langs: ['ruby'] },
  // Shell / Bash
  { re: new RegExp(`^\\s*(${W})\\s*\\(\\s*\\)\\s*\\{`),                    kind: 'function', langs: ['shellscript'] },
];

// Мови, для яких є спеціалізовані патерни вище — для файлу з такою мовою пробуємо
// тільки патерни цієї мови (усуває фальшиві збіги з чужих мов, наприклад коли
// заглушка C#/Java "СЛОВО СЛОВО(" ловить виклик вбудованої функції 1С типу
// "Если ЗначениеЗаповнено(" чи "Новый ОписаниеОповещения("). Для нерозпізнаної/
// незнайомої мови лишаємо старий "пробуй усе" фолбек.
const KNOWN_LANGS = new Set(DEFAULT_PATTERNS.flatMap(p => p.langs));

const SKIP = new Set(['if','for','while','switch','catch','else','return','import','export','class','const','let','var','new','delete','typeof','instanceof']);

// Ліміт довжини рядка для кастомних (user-supplied) патернів — обмежує час бектрекінгу
// навіть для потенційно ReDoS-вразливого regex, який користувач може вписати в customPatterns.
const CUSTOM_PATTERN_MAX_LINE_LENGTH = 500;

class FunctionListProvider {
  constructor(extensionUri) {
    this._debounceTimer = null;
    this._extensionUri = extensionUri;
    // uri string -> { version, results } — уникає повторного синхронного парсингу
    // всього файлу при кожному відкритті Quick Pick, якщо документ не змінювався.
    this._cache = new Map();
  }

  dispose() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    this._cache.clear();
  }

  refresh(doc) {
    if (!doc) return;
    this._cache.set(doc.uri.toString(), { version: doc.version, results: this._parse(doc) });
  }

  // `doc` захоплюється в момент події, а не читається з activeTextEditor після таймауту —
  // інакше можна оновити кеш не того файлу, якщо користувач встиг перемкнути вкладку.
  refreshDebounced(doc) {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this.refresh(doc), 500);
  }

  _getFunctions(doc) {
    const key = doc.uri.toString();
    const cached = this._cache.get(key);
    if (cached && cached.version === doc.version) return cached.results;

    const results = this._parse(doc);
    this._cache.set(key, { version: doc.version, results });
    return results;
  }

  async showQuickPick() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const fns = this._getFunctions(editor.document);
    if (!fns.length) {
      vscode.window.showInformationMessage('No functions or procedures found in this file.');
      return;
    }

    const kindIcon = {
      procedure: 'symbol-event',
      function:  'symbol-function',
      method:    'symbol-property',
      custom:    'symbol-key',
    };

    const kindLabel = {
      procedure:     'Procedure',
      function:      'Function',
      method:        'Method',
      custom:        'Custom',
      'bsl-procedure': 'Procedure',
      'bsl-function':  'Function',
    };

    const bslIcon = {
      'bsl-procedure': vscode.Uri.joinPath(this._extensionUri, 'images', 'icon-procedure.svg'),
      'bsl-function':  vscode.Uri.joinPath(this._extensionUri, 'images', 'icon-function.svg'),
    };

    const qp = vscode.window.createQuickPick();
    qp.placeholder = 'Go to function or procedure…';
    qp.matchOnDescription = true;

    // Кнопка сортування в заголовку Quick Pick
    qp.buttons = [{
      iconPath: new vscode.ThemeIcon('sort-precedence'),
      tooltip:  'Sort A→Z / by line',
    }];

    let sortedAlpha = false;

    const buildItems = (alpha) => fns
      .slice()
      .sort(alpha ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.line - b.line)
      .map(fn => ({
        label:       fn.name,
        description: `${kindLabel[fn.kind] ?? 'Function'} · line ${fn.line + 1}`,
        iconPath:    bslIcon[fn.kind] ?? new vscode.ThemeIcon(kindIcon[fn.kind] ?? 'symbol-function'),
        line:        fn.line,
      }));

    qp.items = buildItems(false);

    // Клік на кнопку — перемикає сортування
    qp.onDidTriggerButton(() => {
      sortedAlpha = !sortedAlpha;
      qp.placeholder = sortedAlpha ? 'Sorted A→Z' : 'Sorted by line';
      qp.items = buildItems(sortedAlpha);
    });

    qp.onDidAccept(async () => {
      const picked = qp.activeItems[0];
      qp.hide();
      if (!picked) return;

      // `editor` було захоплено на момент відкриття Quick Pick — якщо користувач встиг
      // перемкнути активну вкладку до вибору, застосовуємо результат до того ж документа,
      // а не до вкладки, що випадково опинилась активною зараз.
      const pos = new vscode.Position(picked.line, 0);
      const target = vscode.window.visibleTextEditors.find(e => e.document === editor.document)
        ?? await vscode.window.showTextDocument(editor.document, { preview: false });
      target.selection = new vscode.Selection(pos, pos);
      target.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    });

    qp.onDidHide(() => qp.dispose());
    qp.show();
  }

  _parse(doc) {
    const config = vscode.workspace.getConfiguration('editorToolbar');
    const custom = (config.get('customPatterns') ?? [])
      .map(p => { try { return { re: new RegExp(p), kind: 'custom' }; } catch { return null; } })
      .filter(Boolean);

    const langPatterns = KNOWN_LANGS.has(doc.languageId)
      ? DEFAULT_PATTERNS.filter(p => p.langs.includes(doc.languageId))
      : DEFAULT_PATTERNS;
    const patterns = [...langPatterns, ...custom];
    const results = [];
    const seen = new Set();

    for (let i = 0; i < doc.lineCount; i++) {
      const text = doc.lineAt(i).text;
      const trimmed = text.trim();

      // Пропускаємо коментарі
      if (trimmed.startsWith('//') || trimmed.startsWith('#') ||
          trimmed.startsWith('*')  || trimmed.startsWith('--') ||
          trimmed.startsWith(';')  || trimmed.startsWith("'")) continue;

      for (const { re, kind } of patterns) {
        if (kind === 'custom' && text.length > CUSTOM_PATTERN_MAX_LINE_LENGTH) continue;

        const m = re.exec(text);
        if (m) {
          const name = m[1];
          if (name && name.length > 1 && !SKIP.has(name)) {
            const key = `${name}:${i}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ name, line: i, kind });
            }
          }
          break;
        }
      }
    }
    return results;
  }
}

module.exports = { FunctionListProvider };
