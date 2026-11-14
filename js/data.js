/* Startdaten: Märkte und Artikel aus den Lidl-Kassenbons (Preis in Cent, optional Pfand in Cent).
   Wird beim allerersten Start einmalig eingetragen. */
var DEFAULT_STORES = ["Rewe", "Aldi", "Lidl", "Edeka", "dm", "Kaufland"];

var SEEDS = [{
  id: "lidl-bon-2026-11-13",
  store: "Lidl",
  items: [
    ["Laugenstange", 199], ["Steinofenpizza Margherita", 299], ["Steinofenpizza Salami", 399],
    ["Baguette Provence", 299], ["Södergården gesalzen", 105], ["Salami Spianata Rom.", 199],
    ["Del. Fleischsalat", 199], ["Antipasti Knob.-Pet.", 239], ["Würzige Remoulade", 169],
    ["Nutella", 579], ["Maggi Würze", 249], ["Mineralwasser", 29, 25], ["Paulaner Spezi", 125, 25],
    ["Kinder Kinderini", 379], ["Alpenvollmilchschoko", 79], ["Milch-Creme-Pr.", 249],
    ["Cruspies Paprika", 119], ["Cruspies XXL BBQ", 129], ["Fritt Waldmeister", 129],
    ["Waffelr. Vanillecr.", 129], ["Waffelr. Vanillecr. Ze", 129], ["Weizenbrötchen 8er", 119],
    ["Laugenbrötchen", 159], ["Brunchmix Brötchen", 129], ["Baguette Brötch. 6er", 69],
    ["Baguette Brötch. 4er", 69], ["Pombär Original", 179], ["Pfeffer Focaccia", 99],
    ["Papiertragetasche", 25], ["Fairy Spülm. Zitrone", 169], ["Hähn.-Geschnetzeltes", 499],
    ["Häh. Cordon Bleu", 649], ["Arbeitssocke", 399], ["Gewürzgurken Auslese", 119],
    ["Sandwich Toast Weizen", 119], ["Teddy's Hit Salz", 119], ["Erdnusskerne Pikant", 89]
  ]
}];
