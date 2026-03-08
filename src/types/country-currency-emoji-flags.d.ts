declare module "country-currency-emoji-flags" {
  export const currencyData: Record<string, string>;
  export const countryData: Record<string, string>;
  export function getEmojiByCurrencyCode(code: string): string;
  export function getEmojiByCountryCode(code: string): string;
}
