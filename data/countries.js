/*
 * Country data — baseline for 2025.
 * Sources: GDP (nominal, USD bn), growth, inflation (avg. consumer prices), unemployment: IMF World Economic Outlook (2025 editions).
 *          Population (millions, 2025): UN World Population Prospects 2024.
 * NOTE: values are rounded and were entered without live access to the sources.
 *       DATA_META.verified = false → check each number against IMF DataMapper / UN WPP before release.
 * A value of null means "unknown / to be filled in"; the UI shows «نامشخص».
 * Flags are emoji generated from iso2. Put image flags in /assets/flags/ later if needed.
 */
const DATA_META = { year: 2025, verified: false, sources: ['IMF WEO 2025', 'UN WPP 2024'] };

// [id, iso2, نام, English, mapName (world-atlas), پایتخت, pop, gdp, growth, inflation, unemployment]
const RAW_COUNTRIES = [
  ['usa','US','ایالات متحده','United States','United States of America','واشینگتن',342,30500,2.0,2.7,4.2],
  ['chn','CN','چین','China','China','پکن',1408,19400,4.8,0.0,5.1],
  ['jpn','JP','ژاپن','Japan','Japan','توکیو',123.1,4280,1.1,3.2,2.5],
  ['deu','DE','آلمان','Germany','Germany','برلین',84.1,4740,0.2,2.2,3.5],
  ['ind','IN','هند','India','India','دهلی نو',1464,4130,6.6,2.8,null],
  ['gbr','GB','بریتانیا','United Kingdom','United Kingdom','لندن',69.3,3960,1.3,3.4,4.7],
  ['fra','FR','فرانسه','France','France','پاریس',66.5,3280,0.7,1.0,7.5],
  ['ita','IT','ایتالیا','Italy','Italy','رم',59.3,2420,0.5,1.7,6.2],
  ['can','CA','کانادا','Canada','Canada','اتاوا',41.3,2240,1.2,2.0,6.9],
  ['bra','BR','برزیل','Brazil','Brazil','برازیلیا',212.8,2300,2.4,5.2,6.0],
  ['rus','RU','روسیه','Russia','Russia','مسکو',143.9,2540,1.0,8.5,2.3],
  ['kor','KR','کره جنوبی','South Korea','South Korea','سئول',51.7,1880,0.9,2.0,2.8],
  ['aus','AU','استرالیا','Australia','Australia','کانبرا',27.4,1830,1.8,3.2,4.2],
  ['esp','ES','اسپانیا','Spain','Spain','مادرید',49.1,1830,2.9,2.3,10.5],
  ['mex','MX','مکزیک','Mexico','Mexico','مکزیکوسیتی',131.9,1860,0.5,3.8,2.7],
  ['idn','ID','اندونزی','Indonesia','Indonesia','جاکارتا',283.5,1430,4.9,1.8,4.8],
  ['tur','TR','ترکیه','Turkey','Turkey','آنکارا',87.5,1320,3.2,34.0,8.5],
  ['sau','SA','عربستان سعودی','Saudi Arabia','Saudi Arabia','ریاض',34.8,1240,3.5,2.1,3.2],
  ['pol','PL','لهستان','Poland','Poland','ورشو',38.0,920,3.2,3.8,3.2],
  ['arg','AR','آرژانتین','Argentina','Argentina','بوئنوس‌آیرس',45.7,680,4.5,40.0,7.0],
  ['irn','IR','ایران','Iran','Iran','تهران',91.6,430,-1.7,null,8.0],
  ['egy','EG','مصر','Egypt','Egypt','قاهره',118.4,350,4.3,15.0,6.3],
  ['nga','NG','نیجریه','Nigeria','Nigeria','آبوجا',232.7,220,3.4,null,null],
  ['zaf','ZA','آفریقای جنوبی','South Africa','South Africa','پرتوریا',64.0,400,1.1,3.2,32.0],
  ['pak','PK','پاکستان','Pakistan','Pakistan','اسلام‌آباد',255.2,370,3.0,5.0,null],
  ['ukr','UA','اوکراین','Ukraine','Ukraine','کیف',37.9,200,2.0,13.0,null],
  ['isr','IL','اسرائیل','Israel','Israel','اورشلیم',9.4,540,3.0,3.2,3.0],
  ['vnm','VN','ویتنام','Vietnam','Vietnam','هانوی',101.6,510,6.5,3.4,2.2],
  ['tha','TH','تایلند','Thailand','Thailand','بانکوک',71.7,540,1.8,-0.2,1.0],
  ['nld','NL','هلند','Netherlands','Netherlands','آمستردام',18.3,1350,1.4,3.2,3.9]
];

const COUNTRIES = RAW_COUNTRIES.map(([id, iso2, name, nameEn, mapName, capital, pop, gdp, growth, inflation, unemployment]) => ({
  id, iso2, name, nameEn, mapName, capital, pop, gdp, growth, inflation, unemployment,
  gdpPerCapita: Math.round(gdp / pop * 1000),
  flag: String.fromCodePoint(...[...iso2].map(ch => 127397 + ch.charCodeAt(0)))
}));
