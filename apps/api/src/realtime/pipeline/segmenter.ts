const CJK_TERMINATORS = '。！？';
const LATIN_TERMINATORS = '.!?';

/** Splits streamed text into speakable sentences as soon as a boundary is certain. */
export class SentenceSegmenter {
  private buffer = '';

  constructor(private readonly maxChars = 220) {}

  push(delta: string): string[] {
    this.buffer += delta;
    const sentences: string[] = [];
    for (;;) {
      const end = this.findBoundary();
      if (end === -1) break;
      const sentence = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end);
      if (sentence) sentences.push(sentence);
    }
    return sentences;
  }

  flush(): string | undefined {
    const rest = this.buffer.trim();
    this.buffer = '';
    return rest || undefined;
  }

  private findBoundary(): number {
    const text = this.buffer;
    for (let i = 0; i < text.length; i += 1) {
      const char = text.charAt(i);
      if (CJK_TERMINATORS.includes(char)) {
        let end = i + 1;
        while (end < text.length && '」』）)"'.includes(text.charAt(end))) end += 1;
        return end;
      }
      if (LATIN_TERMINATORS.includes(char)) {
        const next = text.charAt(i + 1);
        if (next === '') return -1; // cannot tell yet (e.g. "3." vs "3.5")
        const prev = text.charAt(i - 1);
        const isDecimal = char === '.' && /\d/.test(prev) && /\d/.test(next);
        if (!isDecimal && /\s/.test(next)) return i + 1;
      }
    }
    if (text.length >= this.maxChars) {
      const slice = text.slice(0, this.maxChars);
      const cut = Math.max(slice.lastIndexOf(','), slice.lastIndexOf('、'), slice.lastIndexOf(' '));
      return cut > 0 ? cut + 1 : this.maxChars;
    }
    return -1;
  }
}
