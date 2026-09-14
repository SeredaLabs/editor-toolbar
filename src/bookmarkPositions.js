'use strict';

// Changes use coordinates from the document before the edit. Apply them bottom-up.
// A bookmark is anchored at the start of its line. Multi-line deletion that consumes
// that anchor removes it; edits within a single line keep its bookmark.
function moveBookmarks(lines, changes, lineCount) {
  let result = [...lines];
  const ordered = [...changes].sort((a, b) =>
    b.range.start.line - a.range.start.line || b.range.start.character - a.range.start.character);
  for (const { range: { start, end }, text } of ordered) {
    const added = (text.match(/\r\n|\r|\n/g) || []).length;
    const delta = added - (end.line - start.line);
    result = result.flatMap(line => {
      if (line < start.line) return [line];
      if (line < end.line && (line > start.line || start.character === 0)) return [];
      if (line === end.line && end.line > start.line && end.character > 0) return [];
      if (line > end.line || (line === end.line && end.line > start.line)) return [line + delta];
      if (line === start.line && start.character === 0 && end.character === 0) return [line + added];
      return [line];
    });
  }
  return new Set(result.filter(line => Number.isInteger(line) && line >= 0 && line < lineCount));
}

module.exports = { moveBookmarks };
