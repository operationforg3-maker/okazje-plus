export const plMessages = {
  common: require('../../messages/pl/common.json'),
  home: require('../../messages/pl/home.json'),
  auth: require('../../messages/pl/auth.json'),
  admin: require('../../messages/pl/admin.json'),
};

export const enMessages = {
  common: require('../../messages/en/common.json'),
  home: require('../../messages/en/home.json'),
  auth: require('../../messages/en/auth.json'),
  admin: require('../../messages/en/admin.json'),
};

export const deMessages = {
  common: require('../../messages/de/common.json'),
  home: require('../../messages/de/home.json'),
  auth: require('../../messages/de/auth.json'),
  admin: require('../../messages/de/admin.json'),
};

export const messagesByLocale = {
  pl: plMessages,
  en: enMessages,
  de: deMessages,
} as const;
