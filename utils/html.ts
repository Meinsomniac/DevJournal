const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™',
  deg: '°', plusmn: '±', micro: 'µ', frac14: '¼', frac12: '½', frac34: '¾',
  times: '×', divide: '÷', bull: '•', middot: '·',
  cent: '¢', pound: '£', yen: '¥', euro: '€',
  larr: '←', rarr: '→', uparr: '↑', downarr: '↓',
  iexcl: '¡', iquest: '¿', sect: '§', para: '¶',
  excl: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%',
  apostrophe: "'", parenleft: '(', parenright: ')',
  asterisk: '*', plus: '+', comma: ',', hyphen: '‐', period: '.',
  slash: '/', colon: ':', semicolon: ';', equal: '=',
  question: '?', at: '@', bracketleft: '[', backslash: '\\', bracketright: ']',
  asciicircum: '^', underscore: '_', grave: '`', braceleft: '{', bar: '|',
  braceright: '}', asciitilde: '~',
  Oslash: 'Ø', Uuml: 'Ü', ouml: 'ö', auml: 'ä', euml: 'ë',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã',
  Aring: 'Å', AE: 'Æ', Ccedil: 'Ç',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï',
  Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û',
  Yacute: 'Ý', THORN: 'Þ', szlig: 'ß', yuml: 'ÿ',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã',
  aring: 'å', aelig: 'æ', ccedil: 'ç',
  egrave: 'è', eacute: 'é', ecirc: 'ê',
  igrave: 'ì', iacute: 'í', icirc: 'î',
  ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û',
  yacute: 'ý', thorn: 'þ',
  loz: '◆', star: '★',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity) => {
    // Decimal numeric: &#123;
    if (/^#\d+$/.test(entity)) {
      const code = parseInt(entity.slice(1), 10);
      return String.fromCharCode(code);
    }
    // Hex numeric: &#x1A;
    if (/^#[xX][0-9a-fA-F]+$/.test(entity)) {
      const code = parseInt(entity.slice(2), 16);
      return String.fromCharCode(code);
    }
    // Named entity
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function toString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map(toString).join(' ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj._ === 'string') return obj._;
    if (typeof obj['#text'] === 'string') return obj['#text'];
    // Last resort: try to find any string property
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') return obj[key];
    }
  }
  return '';
}

export function stripHtml(html: unknown): string {
  const str = toString(html);
  if (!str) return '';

  const decoded = decodeEntities(str);

  return decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|h[1-6]|blockquote|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeHtml(html: unknown): string {
  const str = toString(html);
  if (!str) return '';

  let sanitized = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s*on\w+='[^']*'/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');

  return sanitized;
}

export function extractImageFromHtml(html: unknown): string | undefined {
  const str = toString(html);
  if (!str) return undefined;

  const match = str.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : undefined;
}
