/**
 * Currency options for the currency picker.
 * Maps currency code → ISO 3166-1 alpha-2 country code for flag-icons (e.g. fi fi-gb).
 */
export type CurrencyOption = { code: string; countryCode: string };

/** Currency code → ISO country code (lowercase) for flag-icons: <span className="fi fi-{countryCode}" /> */
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  AED: "ae", AFN: "af", ALL: "al", AMD: "am", ANG: "cw", AOA: "ao", ARS: "ar",
  AUD: "au", AWG: "aw", AZN: "az", BAM: "ba", BBD: "bb", BDT: "bd", BGN: "bg", BHD: "bh", BIF: "bi",
  BMD: "bm", BND: "bn", BOB: "bo", BRL: "br", BSD: "bs", BTN: "bt", BWP: "bw", BYN: "by", BZD: "bz",
  CAD: "ca", CDF: "cd", CHF: "ch", CLP: "cl", CNY: "cn", COP: "co", CRC: "cr", CUP: "cu", CVE: "cv", CZK: "cz",
  DJF: "dj", DKK: "dk", DOP: "do", DZD: "dz", EGP: "eg", ERN: "er", ETB: "et", EUR: "eu",
  FJD: "fj", FKP: "fk", GBP: "gb", GEL: "ge", GHS: "gh", GIP: "gi", GMD: "gm", GNF: "gn", GTQ: "gt", GYD: "gy",
  HKD: "hk", HNL: "hn", HRK: "hr", HTG: "ht", HUF: "hu", IDR: "id", ILS: "il", INR: "in", IQD: "iq", IRR: "ir", ISK: "is",
  JMD: "jm", JOD: "jo", JPY: "jp", KES: "ke", KGS: "kg", KHR: "kh", KMF: "km", KPW: "kp", KRW: "kr", KWD: "kw", KYD: "ky", KZT: "kz",
  LAK: "la", LBP: "lb", LKR: "lk", LRD: "lr", LSL: "ls", LYD: "ly", MAD: "ma", MDL: "md", MGA: "mg", MKD: "mk", MMK: "mm", MNT: "mn", MOP: "mo", MUR: "mu", MVR: "mv", MWK: "mw", MXN: "mx", MYR: "my", MZN: "mz",
  NAD: "na", NGN: "ng", NIO: "ni", NOK: "no", NPR: "np", NZD: "nz", OMR: "om", PAB: "pa", PEN: "pe", PGK: "pg", PHP: "ph", PKR: "pk", PLN: "pl", PYG: "py",
  QAR: "qa", RON: "ro", RSD: "rs", RUB: "ru", RWF: "rw", SAR: "sa", SBD: "sb", SCR: "sc", SDG: "sd", SEK: "se", SGD: "sg", SHP: "sh", SLL: "sl", SOS: "so", SRD: "sr", SYP: "sy", SZL: "sz",
  THB: "th", TJS: "tj", TMT: "tm", TND: "tn", TOP: "to", TRY: "tr", TTD: "tt", TWD: "tw", TZS: "tz",
  UAH: "ua", UGX: "ug", USD: "us", UYU: "uy", UZS: "uz", VES: "ve", VND: "vn", VUV: "vu", WST: "ws",
  XAF: "cm", XCD: "ag", XOF: "sn", XPF: "pf", YER: "ye", ZAR: "za", ZMW: "zm", ZWL: "zw",
};

const CURRENCY_NAMES: Record<string, string> = {
  AED: "UAE Dirham",
  AUD: "Australian Dollar",
  BRL: "Brazilian Real",
  CAD: "Canadian Dollar",
  CHF: "Swiss Franc",
  CNY: "Chinese Yuan",
  EUR: "Euro",
  GBP: "British Pound",
  INR: "Indian Rupee",
  JPY: "Japanese Yen",
  MXN: "Mexican Peso",
  USD: "US Dollar",
  NZD: "New Zealand Dollar",
  PKR: "Pakistani Rupee",
  SGD: "Singapore Dollar",
  ZAR: "South African Rand",
};

/** Sorted list of { code, countryCode } for all currencies. Search by code or name. */
export const CURRENCY_OPTIONS: CurrencyOption[] = Object.entries(CURRENCY_TO_COUNTRY)
  .map(([code, countryCode]) => ({ code, countryCode }))
  .sort((a, b) => a.code.localeCompare(b.code));

export function getCurrencyLabel(code: string): string {
  return CURRENCY_NAMES[code] ? `${code} · ${CURRENCY_NAMES[code]}` : code;
}

export function getCurrencySearchText(option: CurrencyOption): string {
  const name = CURRENCY_NAMES[option.code];
  return name ? `${option.code} ${name}` : option.code;
}

/** Country code for flag-icons CSS class (e.g. "gb" → fi-gb). Use when code not in CURRENCY_OPTIONS. */
export function getCountryCodeForCurrency(currencyCode: string): string | undefined {
  return CURRENCY_TO_COUNTRY[currencyCode];
}
