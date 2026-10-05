import type { Locale } from "@/i18n/config";

// Temi vietati nelle frasi (archivio e sponsor): corpo, peso, cibo, calorie,
// ciclo, e parole che umiliano persone o gruppi. Una frase sponsor che ne
// contiene una viene scartata dall'app anche se la firma è valida.
// Le parole sono divise per lingua ("fame" in inglese è "fama", in italiano no).
// Sintassi: "parola" = parola intera; "radice*" = parola che comincia così;
// gli spazi valgono per qualsiasi spazio (frasi di più parole).
// Il cinese non separa le parole: lì si cerca il testo ovunque (MODE "substring").
// In arabo articolo e congiunzioni si attaccano alla parola (ال، و، ف، ب، ل):
// si accettano davanti alla parola (MODE "arabic"). Lo stesso in ebraico con
// ה, ו, ב, ל, מ, ש, כ (MODE "hebrew").
// Con una lingua nuova: aggiungere qui le sue parole (TypeScript lo chiede).

export const FORBIDDEN_TOPICS = ["body", "weight", "food", "calories", "cycle", "humiliation"] as const;
export type ForbiddenTopic = (typeof FORBIDDEN_TOPICS)[number];

type Mode = "word" | "substring" | "arabic" | "hebrew";
const MODE: Partial<Record<Locale, Mode>> = { zh: "substring", ar: "arabic", he: "hebrew" };

const TERMS: Record<ForbiddenTopic, Record<Locale, readonly string[]>> = {
  body: {
    en: ["body*", "belly", "waist*", "muscle*", "abs", "bmi", "skinny", "thin", "slim*", "physique"],
    it: ["corpo", "corpi", "corpore*", "pancia", "girovita", "muscol*", "addominal*", "magr*", "dimagr*", "snell*", "fisico", "fisici"],
    es: ["cuerpo*", "barriga", "cintura", "músculo*", "muscula*", "abdominal*", "flaco*", "flaca*", "delgad*", "adelgaz*", "físico"],
    fr: ["corps", "ventre", "muscl*", "abdo*", "mince*", "minceur", "maigr*", "physique", "silhouette"],
    pt: ["corpo*", "barriga", "cintura", "músculo*", "muscula*", "abdomina*", "magr*", "emagrec*", "físico"],
    de: ["körper*", "bauch*", "taille", "muskel*", "sixpack", "schlank*", "dünn*", "figur"],
    pl: ["ciało", "ciała", "ciału", "ciałem", "brzuch*", "mięśni*", "szczupł*", "chud*", "odchudz*", "sylwetk*"],
    ru: ["тело", "тела", "телу", "телом", "теле", "живот*", "талия", "талии", "мышц*", "похуде*", "худой", "худая", "стройн*", "фигур*"],
    zh: ["身体", "身材", "腰围", "肌肉", "腹肌", "瘦", "胖", "减肥"],
    ar: ["جسم*", "جسد*", "بطن", "خصر", "عضلات", "نحيف*", "نحافة", "رشاقة", "رشيق*"],
    he: ["גוף*", "בטן", "מותניים", "שריר*", "רזה", "רזים", "רזון", "הרזיה", "להרזות", "חטוב*"],
  },
  weight: {
    en: ["weigh*", "kg", "kilo*", "lb", "lbs", "pound", "pounds", "fat", "fats", "fatty", "obes*", "overweight", "underweight"],
    it: ["peso", "pesi", "pesar*", "pesat*", "kg", "chilo", "chili", "grasso", "grassa", "grassi", "grasse", "obes*", "sovrappeso", "sottopeso", "ingrass*"],
    es: ["peso", "pesos", "pesar*", "kilo*", "kg", "gordo*", "gorda*", "grasa*", "obes*", "sobrepeso", "engord*"],
    fr: ["poids", "peser", "pèse*", "kilo*", "kg", "gros", "grosse*", "gras", "graisse*", "obès*", "obési*", "surpoids", "grossi*"],
    pt: ["peso", "pesos", "pesar*", "quilo*", "kg", "gordo*", "gorda*", "gordura*", "obes*", "sobrepeso", "engord*"],
    de: ["gewicht*", "wiegen", "wiegt", "kilo*", "kg", "fett*", "übergewicht*", "dick", "abnehm*", "zunehm*"],
    pl: ["waga", "wagi", "wagę", "wadze", "ważyć", "waży", "kilo*", "kg", "tłuszcz*", "tłust*", "gruby", "gruba", "grube", "otył*", "nadwag*", "przytył*"],
    ru: ["вес", "веса", "весу", "весом", "весит", "взвеш*", "кило*", "кг", "жир*", "толст*", "ожирени*"],
    zh: ["体重", "公斤", "肥", "增重"],
    ar: ["وزن*", "كيلو*", "كغ", "دهون", "سمين*", "سمنة", "بدين*"],
    he: ["משקל*", "קילו*", "ק״ג", "שומן*", "שמן", "שמנה", "שמנים", "השמנה", "להשמין"],
  },
  food: {
    en: ["food*", "eat", "eats", "eating", "eaten", "ate", "meal*", "snack*", "hunger", "hungry", "diet*", "sugar*", "carb", "carbs", "protein*", "fasting", "binge*", "breakfast", "lunch", "dinner"],
    it: ["cibo", "cibi", "cibar*", "mangi*", "pasto", "pasti", "spuntin*", "fame", "affamat*", "dieta", "diete", "zuccher*", "carboidrat*", "protein*", "digiun*", "abbuff*", "colazione", "pranzo", "cena", "cenare"],
    es: ["comida*", "comer", "come", "comes", "comiendo", "aliment*", "dieta*", "hambre", "hambrient*", "azúcar*", "carbohidrat*", "proteína*", "ayun*", "atracón*", "desayun*", "almuerz*", "cena", "cenar", "merienda", "snack*"],
    fr: ["nourriture*", "manger", "mange*", "repas", "aliment*", "régime*", "faim", "affamé*", "sucre*", "glucide*", "protéine*", "jeûn*", "grignot*", "petit-déjeuner", "déjeuner", "dîner", "goûter"],
    pt: ["comida*", "comer", "come", "comendo", "aliment*", "dieta*", "fome", "faminto*", "açúcar*", "carboidrat*", "proteína*", "jejum", "jejua*", "almoço", "jantar", "lanche*", "refeição*", "refeições"],
    de: ["essen", "isst", "iss", "gegessen", "nahrung*", "lebensmittel*", "diät*", "hunger*", "hungrig*", "zucker*", "kohlenhydrat*", "protein*", "eiweiß*", "fasten*", "frühstück*", "mittagessen", "abendessen", "snack*", "mahlzeit*"],
    pl: ["jedzeni*", "jeść", "jem", "jesz", "posił*", "diet*", "głód", "głod*", "cukier", "cukr*", "węglowodan*", "białk*", "głodówk*", "śniadani*", "obiad*", "kolacj*", "przekąsk*"],
    ru: ["еда", "еды", "еде", "ешь", "съесть", "пища", "пищи", "питани*", "диет*", "голод*", "сахар*", "углевод*", "белок", "завтрак*", "обед*", "ужин*", "перекус*"],
    zh: ["食物", "吃饭", "吃东西", "多吃", "少吃", "饮食", "节食", "饿", "糖", "碳水", "蛋白质", "断食", "早餐", "午餐", "晚餐", "零食"],
    ar: ["طعام", "أكل", "يأكل", "تأكل", "غذاء", "حمية", "رجيم", "جوع", "جائع*", "سكر", "كربوهيدرات", "بروتين", "صيام", "فطور", "غداء", "عشاء", "وجبة", "وجبات"],
    he: ["אוכל", "לאכול", "אוכלים", "מזון", "דיאט*", "רעב*", "סוכר", "פחמימות", "חלבון", "צום", "ארוחה", "ארוחת", "ארוחות", "נשנוש*"],
  },
  calories: {
    en: ["calor*", "kcal", "cal"],
    it: ["calori*", "kcal"],
    es: ["caloría*", "kcal"],
    fr: ["calori*", "kcal"],
    pt: ["caloria*", "kcal"],
    de: ["kalorie*", "kcal"],
    pl: ["kalori*", "kcal"],
    ru: ["калори*", "ккал"],
    zh: ["卡路里", "热量", "千卡", "大卡"],
    ar: ["سعرات", "سعرة", "كالوري*"],
    he: ["קלורי*", "קק״ל"],
  },
  cycle: {
    en: ["cycle*", "period", "periods", "menstru*", "ovulat*", "pms", "pill"],
    it: ["ciclo", "cicli", "mestru*", "ovula*", "pillola"],
    es: ["ciclo*", "menstru*", "ovula*", "píldora"],
    fr: ["cycle*", "règles", "menstru*", "ovul*", "pilule"],
    pt: ["ciclo*", "menstrua*", "ovula*", "pílula"],
    de: ["zyklus*", "periode*", "menstru*", "eisprung*", "pille"],
    pl: ["cykl*", "miesiączk*", "menstrua*", "owulacj*", "pigułk*"],
    ru: ["цикл*", "месячн*", "менстру*", "овуляц*", "таблетк*"],
    zh: ["月经", "经期", "生理期", "周期", "排卵", "避孕药"],
    ar: ["الدورة الشهرية", "دورة شهرية", "حيض", "الحيض", "إباضة", "حبوب منع الحمل"],
    he: ["מחזור*", "וסת", "ביוץ", "גלולה", "גלולות"],
  },
  humiliation: {
    en: [
      "loser*", "idiot*", "stupid*", "pathetic", "worthless", "useless", "lazy", "coward*", "weakling*", "moron*",
      "dumb", "disgusting", "ugly", "man up", "like a girl", "real men", "real man",
    ],
    it: [
      "perdent*", "idiot*", "stupid*", "patetic*", "inetto", "inetta", "inetti", "pigro", "pigra", "pigri", "pigre",
      "pigrone", "schifo", "schifos*", "vergognati", "codard*", "smidollat*", "deficient*", "cretin*", "sei un fallito",
      "sei una fallita", "sei inutile", "femminuccia", "vero uomo", "veri uomini", "sii uomo", "da femmina",
    ],
    es: ["perdedor*", "idiota*", "estúpid*", "patétic*", "inútil", "inútiles", "vago", "vaga", "vagos", "cobarde*", "imbécil*", "tonto*", "tonta*", "feo", "fea", "feos"],
    fr: ["perdant*", "idiot*", "stupide*", "pathétique*", "minable*", "nul", "nulle", "nuls", "paresseu*", "lâche", "lâches", "crétin*", "moche*", "débile*"],
    pt: ["perdedor*", "idiota*", "estúpid*", "patétic*", "inútil", "inúteis", "preguiços*", "covard*", "imbecil*", "feio", "feia", "otário*"],
    de: ["verlierer*", "idiot*", "dumm*", "erbärmlich*", "wertlos*", "nutzlos*", "faul", "faule*", "feigling*", "hässlich*", "schwächling*", "versager*"],
    pl: ["nieudacznik*", "frajer*", "idiot*", "głupi*", "żałosn*", "bezwartościow*", "leń", "leniu*", "leniw*", "tchórz*", "brzydk*", "debil*", "kretyn*"],
    ru: ["неудачник*", "лузер*", "идиот*", "тупиц*", "тупой", "глуп*", "жалк*", "никчём*", "ничтожеств*", "лентя*", "ленив*", "трус*", "урод*", "дебил*", "кретин*"],
    zh: ["失败者", "废物", "白痴", "蠢", "笨蛋", "傻", "可悲", "懒鬼", "懒虫", "胆小鬼", "丑"],
    ar: ["فاشل*", "غبي*", "أحمق", "تافه*", "كسول*", "جبان*", "قبيح*", "حقير*"],
    he: ["לוזר*", "אידיוט*", "טיפש*", "מטומטם*", "פתטי*", "עצלן*", "פחדן*", "מכוער*", "חסר ערך", "חסרת ערך"],
  },
};

// In arabo articolo e congiunzioni attaccati davanti alla parola.
const ARABIC_PROCLITICS = "(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ل|ك)?";
// In ebraico: ה, ו, ב, ל, מ, ש, כ e le loro combinazioni (וה, שב, וכש…).
const HEBREW_PROCLITICS = "[והבלמשכ]{0,3}";

function termPattern(term: string, mode: Mode): string {
  const prefix = term.endsWith("*");
  const word = (prefix ? term.slice(0, -1) : term)
    .split(" ")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  if (mode === "substring") return word;
  const start = `(?<![\\p{L}\\p{N}])${mode === "arabic" ? ARABIC_PROCLITICS : mode === "hebrew" ? HEBREW_PROCLITICS : ""}`;
  // Confini di parola Unicode (le lettere accentate contano come lettere).
  return `${start}${word}${prefix ? "" : "(?![\\p{L}\\p{N}])"}`;
}

type Matcher = { topic: ForbiddenTopic; term: string; re: RegExp };

function matchers(locale: Locale): Matcher[] {
  const mode = MODE[locale] ?? "word";
  return FORBIDDEN_TOPICS.flatMap((topic) =>
    TERMS[topic][locale].map((term) => ({ topic, term, re: new RegExp(termPattern(term, mode), "iu") })),
  );
}

const MATCHERS = new Map<Locale, Matcher[]>();

function normalize(text: string): string {
  return (
    text
      .normalize("NFC")
      // Apostrofi tipografici come quelli dritti: "l’ ora" = "l' ora".
      .replace(/[‘’]/g, "'")
      // Arabo: senza vocali brevi né allungamenti, così "يومًا" = "يوما".
      .replace(/[ً-ٰٟـ]/g, "")
      // Ebraico: senza segni vocalici (niqqud); maqaf, geresh e gershayim come -, ' e ".
      .replace(/[֑-ֽֿ-ׇ]/g, "")
      .replace(/־/g, "-")
      .replace(/׳/g, "'")
      .replace(/״/g, '"')
  );
}

/** Termini vietati presenti nel testo, nella sua lingua (vuoto = testo accettabile). */
export function forbiddenTerms(text: string, locale: Locale): { topic: ForbiddenTopic; term: string }[] {
  let list = MATCHERS.get(locale);
  if (!list) MATCHERS.set(locale, (list = matchers(locale)));
  const normalized = normalize(text);
  return list.filter(({ re }) => re.test(normalized)).map(({ topic, term }) => ({ topic, term }));
}

export function isAllowedText(text: string, locale: Locale): boolean {
  return forbiddenTerms(text, locale).length === 0;
}
