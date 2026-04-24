export interface LanguageDef {
  name: string       // ISO 639-1 code used as canonical key
  aliases: string[]  // ISO 639-2/B, 639-2/T, 639-3, and common alternate codes
  label: string      // Human-readable display name
}

export const LANGUAGES: LanguageDef[] = [
  { name: 'en', aliases: ['eng', 'english'], label: 'English' },
  { name: 'ja', aliases: ['jpn', 'japanese'], label: 'Japanese' },
  { name: 'es', aliases: ['spa', 'spanish'], label: 'Spanish' },
  { name: 'pt', aliases: ['por', 'portuguese'], label: 'Portuguese' },
  { name: 'de', aliases: ['deu', 'ger', 'german'], label: 'German' },
  { name: 'it', aliases: ['ita', 'italian'], label: 'Italian' },
  { name: 'fr', aliases: ['fre', 'fra', 'french'], label: 'French' },
  { name: 'ru', aliases: ['rus', 'russian'], label: 'Russian' },
  { name: 'zh', aliases: ['zho', 'chi', 'chinese', 'cmn', 'yue'], label: 'Chinese' },
  { name: 'ko', aliases: ['kor', 'korean'], label: 'Korean' },
  { name: 'ar', aliases: ['ara', 'arabic'], label: 'Arabic' },
  { name: 'hi', aliases: ['hin', 'hindi'], label: 'Hindi' },
  { name: 'pl', aliases: ['pol', 'polish'], label: 'Polish' },
  { name: 'nl', aliases: ['nld', 'dut', 'dutch'], label: 'Dutch' },
  { name: 'tr', aliases: ['tur', 'turkish'], label: 'Turkish' },
  { name: 'sv', aliases: ['swe', 'swedish'], label: 'Swedish' },
  { name: 'th', aliases: ['tha', 'thai'], label: 'Thai' },
  { name: 'vi', aliases: ['vie', 'vietnamese'], label: 'Vietnamese' },
  { name: 'id', aliases: ['ind', 'indonesian'], label: 'Indonesian' },
  { name: 'ms', aliases: ['msa', 'may', 'malay'], label: 'Malay' },
  { name: 'af', aliases: ['afr', 'afrikaans'], label: 'Afrikaans' },
  { name: 'bg', aliases: ['bul', 'bulgarian'], label: 'Bulgarian' },
  { name: 'bn', aliases: ['ben', 'bengali'], label: 'Bengali' },
  { name: 'bs', aliases: ['bos', 'bosnian'], label: 'Bosnian' },
  { name: 'ca', aliases: ['cat', 'catalan'], label: 'Catalan' },
  { name: 'cs', aliases: ['ces', 'cze', 'czech'], label: 'Czech' },
  { name: 'da', aliases: ['dan', 'danish'], label: 'Danish' },
  { name: 'el', aliases: ['ell', 'gre', 'greek'], label: 'Greek' },
  { name: 'et', aliases: ['est', 'estonian'], label: 'Estonian' },
  { name: 'fa', aliases: ['fas', 'per', 'persian', 'farsi'], label: 'Persian' },
  { name: 'fi', aliases: ['fin', 'finnish'], label: 'Finnish' },
  { name: 'fil', aliases: ['tgl', 'tagalog', 'filipino'], label: 'Filipino' },
  { name: 'he', aliases: ['heb', 'hebrew'], label: 'Hebrew' },
  { name: 'hr', aliases: ['hrv', 'croatian'], label: 'Croatian' },
  { name: 'hu', aliases: ['hun', 'hungarian'], label: 'Hungarian' },
  { name: 'is', aliases: ['isl', 'ice', 'icelandic'], label: 'Icelandic' },
  { name: 'ka', aliases: ['kat', 'geo', 'georgian'], label: 'Georgian' },
  { name: 'kk', aliases: ['kaz', 'kazakh'], label: 'Kazakh' },
  { name: 'km', aliases: ['khm', 'khmer'], label: 'Khmer' },
  { name: 'la', aliases: ['lat', 'latin'], label: 'Latin' },
  { name: 'lt', aliases: ['lit', 'lithuanian'], label: 'Lithuanian' },
  { name: 'lv', aliases: ['lav', 'latvian'], label: 'Latvian' },
  { name: 'mk', aliases: ['mkd', 'mac', 'macedonian'], label: 'Macedonian' },
  { name: 'mn', aliases: ['mon', 'mongolian'], label: 'Mongolian' },
  { name: 'my', aliases: ['mya', 'bur', 'burmese'], label: 'Burmese' },
  { name: 'ne', aliases: ['nep', 'nepali'], label: 'Nepali' },
  { name: 'no', aliases: ['nor', 'nob', 'nno', 'norwegian'], label: 'Norwegian' },
  { name: 'ro', aliases: ['ron', 'rum', 'romanian'], label: 'Romanian' },
  { name: 'si', aliases: ['sin', 'sinhala', 'sinhalese'], label: 'Sinhala' },
  { name: 'sk', aliases: ['slk', 'slo', 'slovak'], label: 'Slovak' },
  { name: 'sl', aliases: ['slv', 'slovenian'], label: 'Slovenian' },
  { name: 'sq', aliases: ['sqi', 'alb', 'albanian'], label: 'Albanian' },
  { name: 'sr', aliases: ['srp', 'serbian'], label: 'Serbian' },
  { name: 'sw', aliases: ['swa', 'swahili'], label: 'Swahili' },
  { name: 'ta', aliases: ['tam', 'tamil'], label: 'Tamil' },
  { name: 'te', aliases: ['tel', 'telugu'], label: 'Telugu' },
  { name: 'uk', aliases: ['ukr', 'ukrainian'], label: 'Ukrainian' },
  { name: 'ur', aliases: ['urd', 'urdu'], label: 'Urdu' }
]

// Indices of the "common" languages at the top of the list (first 9)
const COMMON_COUNT = 9

/** Common languages for the top section of dropdowns */
export const COMMON_LANGUAGES = LANGUAGES.slice(0, COMMON_COUNT)

/** All languages sorted alphabetically by label */
export const ALL_LANGUAGES_SORTED = [...LANGUAGES].sort((a, b) => a.label.localeCompare(b.label))

// Build a lookup map: lowercase alias/name -> LanguageDef
const _lookup = new Map<string, LanguageDef>()
for (const lang of LANGUAGES) {
  _lookup.set(lang.name.toLowerCase(), lang)
  for (const alias of lang.aliases) {
    _lookup.set(alias.toLowerCase(), lang)
  }
}

/**
 * Resolve a track language string (e.g. "eng", "jpn", "en") to a LanguageDef.
 * Returns undefined if no match found.
 */
export function resolveLanguage(trackLang: string): LanguageDef | undefined {
  return _lookup.get(trackLang.toLowerCase())
}

/**
 * Check if a track language matches a preferred language code (ISO 639-1).
 */
export function matchesLanguage(trackLang: string | undefined, preferredCode: string): boolean {
  if (!trackLang) return false
  const tl = trackLang.toLowerCase()
  if (tl === preferredCode) return true
  const preferred = _lookup.get(preferredCode)
  if (!preferred) return false
  // Check if trackLang is the name or any alias of the preferred language
  if (tl === preferred.name) return true
  return preferred.aliases.some((a) => tl === a || tl.startsWith(a))
}
