/** 改行を守り、1文字ずつ詰めて幅に収まるよう折り返す */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && measure(line + ch) > maxWidth) {
        out.push(line);
        line = '';
      }
      line += ch;
    }
    out.push(line);
  }
  return out;
}

/** 折り返して maxLines 行に収める。入らない分は捨て、最後の行の末尾を「…」にする */
export function fitLines(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const lines = wrapText(text, maxWidth, measure);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(last + '…') > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = last + '…';
  return kept;
}

/** '2026-09-22' → '2026年9月22日' */
export function jpDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
