export const LANGUAGES = {
  vi: {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    sttCode: 'vi',
    ttsCode: 'vi',
    defaultFormality: 'polite',
    triggerPhrases: ['dịch giúp tôi', 'phiên dịch', 'translate for me'],
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    sttCode: 'ja',
    ttsCode: 'ja',
    defaultFormality: 'teineigo',
    triggerPhrases: ['通訳してください', '翻訳してください', 'please interpret'],
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    sttCode: 'en',
    ttsCode: 'en',
    defaultFormality: 'neutral',
    triggerPhrases: ['please interpret', 'translate for me', 'can you translate'],
  },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
