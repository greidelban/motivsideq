// Tabella degli alimenti inclusa nell'app: valori medi per 100 g (o 100 ml per
// le bevande) di alimenti generici, senza marche. Funziona offline e non chiede
// nulla a nessun server.
// I valori sono medie di riferimento delle tabelle pubbliche (es. USDA FoodData
// Central, di pubblico dominio): prima del lancio vanno ricontrollati uno per uno
// (DA_FARE.md sezione 0e). Più avanti gli utenti potranno segnalare e correggere
// i valori (stile Wikipedia): per questo ogni alimento ha un id stabile, che non
// si cambia mai (le voci del diario alimentare lo ricordano).
// I nomi stanno nei file per lingua (`names/<lingua>.ts`): un alimento nuovo va
// aggiunto qui e in TUTTI i file dei nomi (un test lo controlla).

type FoodCategory =
  | "grains"
  | "protein"
  | "dairy"
  | "legumes"
  | "vegetables"
  | "fruit"
  | "nuts"
  | "condiments"
  | "sweets"
  | "drinks";

/** Porzioni tipiche: il nome si traduce nei dizionari (health.food.portions). */
type PortionKey =
  | "piece"
  | "slice"
  | "serving"
  | "pot"
  | "glass"
  | "can"
  | "cup"
  | "tbsp"
  | "tsp"
  | "handful"
  | "scoop"
  | "square"
  | "whole";

export type CatalogFood = {
  id: string;
  category: FoodCategory;
  /** "ml": valori per 100 ml (bevande, latte). */
  unit: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Grammi di alcol: 7 kcal per grammo. Le bevande alcoliche non si mostrano ai minorenni. */
  alcohol?: number;
  portions?: readonly (readonly [PortionKey, number])[];
};

type Row = [id: string, kcal: number, protein: number, carbs: number, fat: number, portions?: [PortionKey, number][]];

const rows = (category: FoodCategory, list: Row[], unit: "g" | "ml" = "g"): CatalogFood[] =>
  list.map(([id, kcal, protein, carbs, fat, portions]) => ({ id, category, unit, kcal, protein, carbs, fat, portions }));

export const FOODS: readonly CatalogFood[] = [
  ...rows("grains", [
    ["pasta-dry", 371, 13, 75, 1.5, [["serving", 80]]],
    ["pasta-cooked", 158, 5.8, 31, 0.9, [["serving", 200]]],
    ["wholewheat-pasta-dry", 348, 14.6, 71.6, 1.4, [["serving", 80]]],
    ["rice-dry", 365, 7.1, 80, 0.7, [["serving", 80]]],
    ["rice-cooked", 130, 2.7, 28, 0.3, [["serving", 200]]],
    ["brown-rice-cooked", 123, 2.7, 25.6, 1, [["serving", 200]]],
    ["bread-white", 265, 9, 49, 3.2, [["slice", 30]]],
    ["bread-wholemeal", 252, 12.4, 42.7, 3.5, [["slice", 30]]],
    ["rusks", 408, 11.3, 72, 6.9, [["piece", 10]]],
    ["crackers", 428, 9.4, 72, 10, [["serving", 25]]],
    ["oats", 379, 13.2, 67.7, 6.5, [["serving", 40]]],
    ["cornflakes", 357, 7.5, 84, 0.4, [["serving", 30]]],
    ["muesli", 363, 10, 66, 6, [["serving", 40]]],
    ["couscous-cooked", 112, 3.8, 23.2, 0.2, [["serving", 150]]],
    ["quinoa-cooked", 120, 4.4, 21.3, 1.9, [["serving", 150]]],
    ["polenta-cooked", 70, 1.6, 15, 0.4, [["serving", 250]]],
    ["potatoes-boiled", 87, 1.9, 20.1, 0.1, [["serving", 200]]],
    ["french-fries", 312, 3.4, 41, 15, [["serving", 120]]],
    ["pizza-margherita", 265, 11.4, 33, 9.7, [["slice", 110], ["whole", 330]]],
    ["croissant", 406, 8.2, 45.8, 21, [["piece", 50]]],
    ["butter-cookies", 467, 6.1, 68.9, 18.8, [["piece", 8]]],
  ]),
  ...rows("protein", [
    ["chicken-breast-raw", 120, 22.5, 0, 2.6, [["serving", 150]]],
    ["chicken-breast-cooked", 165, 31, 0, 3.6, [["serving", 120]]],
    ["turkey-breast-raw", 114, 23.7, 0, 1.5, [["serving", 150]]],
    ["beef-lean-raw", 125, 22, 0, 4, [["serving", 150]]],
    ["beef-ground-raw", 215, 18.6, 0, 15, [["serving", 120]]],
    ["pork-loin-raw", 143, 21, 0, 6, [["serving", 150]]],
    ["pork-sausage-raw", 268, 14, 0, 23, [["piece", 80]]],
    ["cooked-ham", 145, 19, 1.5, 7, [["slice", 20]]],
    ["cured-ham", 250, 26, 0, 16, [["slice", 15]]],
    ["bresaola", 151, 32, 0, 2.6, [["slice", 10]]],
    ["salami", 392, 22, 1.5, 33, [["slice", 8]]],
    ["egg", 143, 12.6, 0.7, 9.5, [["piece", 50]]],
    ["egg-white", 52, 10.9, 0.7, 0.2, [["piece", 33]]],
    ["tuna-in-water", 116, 25.5, 0, 0.8, [["can", 56]]],
    ["tuna-in-oil", 198, 29, 0, 8.2, [["can", 56]]],
    ["salmon-raw", 208, 20.4, 0, 13.4, [["serving", 150]]],
    ["cod-raw", 82, 17.8, 0, 0.7, [["serving", 150]]],
    ["shrimp-raw", 85, 20.1, 0, 0.5, [["serving", 100]]],
    ["tofu", 144, 17.3, 2.8, 8.7, [["serving", 100]]],
    ["whey-protein", 380, 80, 8, 5, [["scoop", 30]]],
  ]),
  ...rows("dairy", [
    ["yogurt-plain", 61, 3.5, 4.7, 3.3, [["pot", 125]]],
    ["greek-yogurt-0", 59, 10.3, 3.6, 0.4, [["pot", 150]]],
    ["greek-yogurt-full", 97, 9, 4, 5, [["pot", 150]]],
    ["mozzarella", 253, 18.7, 0.7, 19.5, [["piece", 125]]],
    ["parmesan", 392, 33, 0, 28, [["tbsp", 5]]],
    ["ricotta", 146, 8.8, 3.5, 10.9, [["serving", 100]]],
    ["cheddar", 403, 24.9, 1.3, 33.1, [["slice", 20]]],
    ["feta", 264, 14.2, 4.1, 21.3, [["serving", 50]]],
    ["cottage-cheese", 98, 11.1, 3.4, 4.3, [["pot", 200]]],
    ["butter", 717, 0.9, 0.1, 81, [["tsp", 5]]],
  ]),
  ...rows(
    "dairy",
    [
      ["milk-whole", 61, 3.2, 4.8, 3.3, [["glass", 200], ["cup", 250]]],
      ["milk-semi", 46, 3.3, 4.9, 1.6, [["glass", 200], ["cup", 250]]],
      ["milk-skim", 34, 3.4, 5, 0.1, [["glass", 200], ["cup", 250]]],
    ],
    "ml",
  ),
  ...rows("legumes", [
    ["chickpeas-cooked", 164, 8.9, 27.4, 2.6, [["serving", 150]]],
    ["chickpeas-dry", 378, 20.5, 63, 6, [["serving", 60]]],
    ["lentils-cooked", 116, 9, 20.1, 0.4, [["serving", 150]]],
    ["lentils-dry", 352, 24.6, 63.4, 1.1, [["serving", 60]]],
    ["beans-cooked", 127, 8.7, 22.8, 0.5, [["serving", 150]]],
    ["peas", 78, 5.2, 14.3, 0.3, [["serving", 150]]],
    ["hummus", 166, 7.9, 14.3, 9.6, [["tbsp", 15]]],
  ]),
  ...rows("vegetables", [
    ["tomato", 18, 0.9, 3.9, 0.2, [["piece", 120]]],
    ["lettuce", 15, 1.4, 2.9, 0.2, [["serving", 80]]],
    ["carrot", 41, 0.9, 9.6, 0.2, [["piece", 60]]],
    ["zucchini", 17, 1.2, 3.1, 0.3, [["piece", 200]]],
    ["broccoli", 34, 2.8, 6.6, 0.4, [["serving", 150]]],
    ["spinach", 23, 2.9, 3.6, 0.4, [["serving", 100]]],
    ["bell-pepper", 31, 1, 6, 0.3, [["piece", 150]]],
    ["onion", 40, 1.1, 9.3, 0.1, [["piece", 110]]],
    ["cucumber", 15, 0.7, 3.6, 0.1, [["piece", 200]]],
    ["eggplant", 25, 1, 5.9, 0.2, [["piece", 300]]],
    ["mushrooms", 22, 3.1, 3.3, 0.3, [["serving", 100]]],
    ["green-beans", 31, 1.8, 7, 0.2, [["serving", 150]]],
    ["cauliflower", 25, 1.9, 5, 0.3, [["serving", 150]]],
    ["avocado", 160, 2, 8.5, 14.7, [["piece", 150]]],
    ["sweet-corn", 86, 3.3, 19, 1.4, [["tbsp", 15]]],
    ["sweet-potato", 86, 1.6, 20.1, 0.1, [["piece", 130]]],
    ["tomato-sauce", 30, 1.4, 5.2, 0.3, [["serving", 100]]],
  ]),
  ...rows("fruit", [
    ["apple", 52, 0.3, 13.8, 0.2, [["piece", 180]]],
    ["banana", 89, 1.1, 22.8, 0.3, [["piece", 120]]],
    ["orange", 47, 0.9, 11.8, 0.1, [["piece", 150]]],
    ["mandarin", 53, 0.8, 13.3, 0.3, [["piece", 80]]],
    ["pear", 57, 0.4, 15.2, 0.1, [["piece", 170]]],
    ["peach", 39, 0.9, 9.5, 0.3, [["piece", 150]]],
    ["apricot", 48, 1.4, 11.1, 0.4, [["piece", 35]]],
    ["kiwi", 61, 1.1, 14.7, 0.5, [["piece", 75]]],
    ["strawberries", 32, 0.7, 7.7, 0.3, [["serving", 150]]],
    ["blueberries", 57, 0.7, 14.5, 0.3, [["handful", 50]]],
    ["cherries", 63, 1.1, 16, 0.2, [["handful", 60]]],
    ["grapes", 69, 0.7, 18.1, 0.2, [["serving", 150]]],
    ["watermelon", 30, 0.6, 7.6, 0.2, [["slice", 300]]],
    ["melon", 34, 0.8, 8.2, 0.2, [["slice", 200]]],
    ["pineapple", 50, 0.5, 13.1, 0.1, [["slice", 100]]],
    ["dates-dried", 282, 2.5, 75, 0.4, [["piece", 8]]],
    ["raisins", 299, 3.1, 79.2, 0.5, [["handful", 30]]],
  ]),
  ...rows("nuts", [
    ["almonds", 579, 21.2, 21.6, 49.9, [["handful", 30]]],
    ["walnuts", 654, 15.2, 13.7, 65.2, [["handful", 30]]],
    ["hazelnuts", 628, 15, 16.7, 60.8, [["handful", 30]]],
    ["peanuts", 567, 25.8, 16.1, 49.2, [["handful", 30]]],
    ["pistachios", 560, 20.2, 27.2, 45.3, [["handful", 30]]],
    ["cashews", 553, 18.2, 30.2, 43.9, [["handful", 30]]],
    ["peanut-butter", 588, 25, 20, 50, [["tbsp", 16]]],
    ["chia-seeds", 486, 16.5, 42.1, 30.7, [["tbsp", 12]]],
  ]),
  ...rows("condiments", [
    ["olive-oil", 884, 0, 0, 100, [["tbsp", 13], ["tsp", 4.5]]],
    ["mayonnaise", 680, 1, 0.6, 75, [["tbsp", 15]]],
    ["ketchup", 101, 1, 27.4, 0.1, [["tbsp", 17]]],
    ["pesto", 520, 5, 6, 53, [["tbsp", 15]]],
    ["honey", 304, 0.3, 82.4, 0, [["tsp", 7]]],
    ["sugar", 387, 0, 100, 0, [["tsp", 4]]],
    ["jam", 278, 0.4, 68.9, 0.1, [["tbsp", 20]]],
  ]),
  ...rows("sweets", [
    ["dark-chocolate", 598, 7.8, 45.9, 42.6, [["square", 10]]],
    ["milk-chocolate", 535, 7.7, 59.4, 29.7, [["square", 10]]],
    ["ice-cream", 207, 3.5, 23.6, 11, [["scoop", 50]]],
    ["potato-chips", 536, 7, 53, 35, [["serving", 30]]],
  ]),
  ...rows(
    "drinks",
    [
      ["orange-juice", 45, 0.7, 10.4, 0.2, [["glass", 200]]],
      ["cola", 42, 0, 10.6, 0, [["can", 330]]],
      ["coffee", 2, 0.1, 0, 0, [["cup", 30]]],
    ],
    "ml",
  ),
  { id: "beer", category: "drinks", unit: "ml", kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, alcohol: 3.9, portions: [["glass", 200], ["can", 330]] },
  { id: "wine", category: "drinks", unit: "ml", kcal: 85, protein: 0.1, carbs: 2.6, fat: 0, alcohol: 10.6, portions: [["glass", 125]] },
];

const byId = new Map<string, CatalogFood>(FOODS.map((f) => [f.id, f]));

export function catalogFood(id: string): CatalogFood | undefined {
  return byId.get(id);
}
