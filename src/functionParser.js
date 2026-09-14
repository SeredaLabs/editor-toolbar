'use strict';

// \w не покриває кирилицю в JS — використовуємо [\w\u0400-\u04FF]+
const W = '[$\\w\\u0400-\\u04FF]+';

const DEFAULT_PATTERNS = [
  // 1C BSL — платформа підтримує тільки російські ключові слова (плюс англійський варіант нижче)
  { re: new RegExp(`^\\s*(?:Процедура|Procedure)\\s+(${W})\\s*\\(`, 'i'), kind: 'bsl-procedure', langs: ['bsl'] },
  { re: new RegExp(`^\\s*(?:Функция|Function)\\s+(${W})\\s*\\(`, 'i'),   kind: 'bsl-function',  langs: ['bsl'] },
  // JavaScript / TypeScript
  { re: new RegExp(`^\\s*(?:export\\s+(?:default\\s+)?)?(?:async\\s+)?function(?:\\s*\\*\\s*|\\s+)(${W})\\s*\\(`), kind: 'function', langs: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'] },
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

const JS = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
DEFAULT_PATTERNS.push(
  { re: new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+(${W})(?:\\s*:[^=]+)?\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|${W})\\s*(?::[^=]+)?=>`), kind: 'function', langs: JS },
  { re: new RegExp(`^\\s*(?:(?:public|private|protected|static|async|get|set|override)\\s+)*(${W})\\s*\\([^)]*\\)\\s*(?::[^{}]+)?\\{`), kind: 'method', langs: JS },
);

// Best-effort lexical filtering for the fallback parser. Keep columns and lines intact.
// Language providers remain authoritative for syntax this scanner cannot recognize.
function codeLines(text, languageId) {
  const lines = text.split(/\r\n|\r|\n/);
  const hashComment = ['python', 'ruby', 'shellscript', 'php', 'plaintext'].includes(languageId);
  const slashComment = !['python', 'ruby', 'shellscript', 'vb'].includes(languageId);
  let block = false;
  let quote = '';
  return lines.map(line => {
    let output = '';
    for (let i = 0; i < line.length;) {
      if (block) {
        if (line.startsWith('*/', i)) { block = false; output += '  '; i += 2; }
        else { output += ' '; i++; }
      } else if (quote) {
        if (line[i] === '\\') { output += '  '; i += 2; }
        else if (line.startsWith(quote, i)) { output += ' '.repeat(quote.length); i += quote.length; quote = ''; }
        else { output += ' '; i++; }
      } else if ((slashComment && line.startsWith('//', i)) || (hashComment && line[i] === '#') ||
        (languageId === 'vb' && line[i] === "'")) {
        output += ' '.repeat(line.length - i); break;
      } else if (slashComment && line.startsWith('/*', i)) {
        block = true; output += '  '; i += 2;
      } else if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
        quote = line.slice(i, i + 3); output += '   '; i += 3;
      } else if ('\'"`'.includes(line[i])) {
        quote = line[i]; output += ' '; i++;
      } else { output += line[i++]; }
    }
    // Single-line strings do not swallow the rest of an incomplete file.
    if (quote.length === 1 && quote !== '`') quote = '';
    return output;
  });
}

function parseFunctions({ text, languageId, customPatterns = [], customOnly = false }) {
  const defaults = customOnly ? [] : (KNOWN_LANGS.has(languageId)
    ? DEFAULT_PATTERNS.filter(pattern => pattern.langs.includes(languageId)) : DEFAULT_PATTERNS);
  const custom = (Array.isArray(customPatterns) ? customPatterns : [])
    .filter(pattern => typeof pattern === 'string')
    .map(pattern => { try { return { re: new RegExp(pattern), kind: 'custom' }; } catch { return null; } })
    .filter(Boolean);
  const results = [];
  const patterns = [...defaults, ...custom];
  const lines = codeLines(text, languageId);
  for (let line = 0; line < lines.length; line++) {
    const code = lines[line];
    // Prevent a return/throw/new expression from becoming a typed method declaration.
    const expression = /^(?:return|throw|new|if|else|while|for|switch|case)\b/.test(code.trimStart());
    for (const { re, kind } of patterns) {
      if ((kind === 'custom' && code.length > 500) || (kind !== 'custom' && expression)) continue;
      const match = re.exec(code);
      if (match?.[1] && !SKIP.has(match[1])) {
        results.push({ name: match[1], line, kind });
        break;
      }
    }
  }
  return results;
}

module.exports = { parseFunctions };
