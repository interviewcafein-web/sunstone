// Tidying hand-typed names and titles from the LMS and the delivery tracker, so they read the
// same everywhere (website, app, reports and emails).

/** "PRIME_COMMUNICATION", "Prime_aptitude " → "Prime Communication", "Prime Aptitude". */
export function subjectName(raw: string): string {
  const name = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/**
 * A person's name with each word capitalised: "Shivam chaturvedi" → "Shivam Chaturvedi",
 * "DR. ATUL NANDWAL" → "Dr. Atul Nandwal", "Manisha A s" → "Manisha A S". Words typed in mixed
 * case on purpose ("McDonald") are kept.
 */
export function personName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\p{L}+/gu, (word) =>
      word === word.toLowerCase() || word === word.toUpperCase()
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : word
    );
}

/** Short words kept lower case inside a title, and abbreviations kept in capitals. */
const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);
const ABBREVIATIONS = new Set([
  'AI',
  'AMCAT',
  'API',
  'BFS',
  'BST',
  'CN',
  'CSS',
  'DBMS',
  'DFS',
  'DP',
  'DSA',
  'GCD',
  'GD',
  'HTML',
  'JS',
  'LCM',
  'LMS',
  'MCQ',
  'MCQS',
  'ML',
  'OOP',
  'OOPS',
  'OS',
  'PI',
  'PRIME',
  'SQL',
  'STL',
]);

/**
 * A test, module or lesson title: starts with a capital ("test 1" → "Test 1"), a title typed
 * in capitals reads in title case ("PROBLEMS ON BINARY TREE" → "Problems on Binary Tree",
 * "BST PROBLEMS" → "BST Problems"), and ordinals are lower case ("5Th sem" → "5th sem").
 */
export function titleText(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (text === text.toUpperCase() && /\p{Lu}{4}/u.test(text)) {
    let first = true;
    text = text.replace(/\p{L}+/gu, (word) => {
      const lower = word.toLowerCase();
      const out = ABBREVIATIONS.has(word)
        ? word
        : !first && SMALL_WORDS.has(lower)
          ? lower
          : word[0] + lower.slice(1);
      first = false;
      return out;
    });
  }
  return text
    .replace(
      /(\d)(st|nd|rd|th)\b/gi,
      (_, digit: string, suffix: string) => digit + suffix.toLowerCase()
    )
    .replace(/^\p{Ll}/u, (letter) => letter.toUpperCase());
}
