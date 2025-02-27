import i18next from 'i18next';
import HttpApi from 'i18next-http-backend';
import de from '../locale/de/dim.json';
import en from '../locale/dim.json';
import esMX from '../locale/es-mx/dim.json';
import es from '../locale/es/dim.json';
import fr from '../locale/fr/dim.json';
import it from '../locale/it/dim.json';
import ja from '../locale/ja/dim.json';
import ko from '../locale/ko/dim.json';
import pl from '../locale/pl/dim.json';
import ptBR from '../locale/pt-br/dim.json';
import ru from '../locale/ru/dim.json';
import zhCHS from '../locale/zh-chs/dim.json';
import zhCHT from '../locale/zh-cht/dim.json';
import { humanBytes } from './storage/human-bytes';

// Try to pick a nice default language
export function defaultLanguage(): string {
  const DIM_LANGS = [
    'de',
    'en',
    'es',
    'es-mx',
    'fr',
    'it',
    'ja',
    'pl',
    'pt-br',
    'ru',
    'ko',
    'zh-cht',
    'zh-chs',
  ];

  const storedLanguage = localStorage.getItem('dimLanguage');
  if (storedLanguage && DIM_LANGS.includes(storedLanguage)) {
    return storedLanguage;
  }
  const browserLang = (window.navigator.language || 'en').toLowerCase();
  return DIM_LANGS.find((lang) => browserLang.startsWith(lang)) || 'en';
}

export function initi18n(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // See https://github.com/i18next/i18next
    i18next.use(HttpApi).init(
      {
        initImmediate: true,
        debug: $DIM_FLAVOR === 'dev',
        lng: defaultLanguage(),
        fallbackLng: 'en',
        lowerCaseLng: true,
        load: 'currentOnly',
        interpolation: {
          escapeValue: false,
          format(val: string, format) {
            switch (format) {
              case 'pct':
                return `${Math.min(100, Math.floor(100 * parseFloat(val)))}%`;
              case 'humanBytes':
                return humanBytes(parseInt(val, 10));
              case 'number':
                return parseInt(val, 10).toLocaleString();
              default:
                return val;
            }
          },
        },
        backend: {
          loadPath([lng]: string[]) {
            const path = ({
              en,
              it,
              de,
              fr,
              es,
              'es-mx': esMX,
              ja,
              'pt-br': ptBR,
              pl,
              ru,
              ko,
              'zh-cht': zhCHT,
              'zh-chs': zhCHS,
            }[lng] as unknown) as string;
            if (!path) {
              throw new Error(`unsupported language ${lng}`);
            }
            return path;
          },
        },
        returnObjects: true,
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(undefined);
        }
      }
    );
  });
}
