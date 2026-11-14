/* Produktdaten aus Open Food Facts (kostenlose, offene Datenbank) anhand des Barcodes.
   Liefert Name, Foto und – wenn erkennbar – einen Pfand-Vorschlag. Preise gibt es dort nicht. */
var Lookup = (function () {
  var FIELDS = "product_name,product_name_de,generic_name_de,brands,quantity,image_front_small_url,categories_tags,packaging_tags";
  var DRINKS = ["en:waters", "en:sodas", "en:beers", "en:carbonated-drinks", "en:energy-drinks", "en:iced-teas",
    "en:soft-drinks", "en:non-alcoholic-beverages", "en:lemonades", "en:colas", "en:mineral-waters", "en:spring-waters", "en:wines", "en:ciders"];

  function has(tags, list) { return (tags || []).some(function (t) { return list.indexOf(t) >= 0; }); }

  function depositGuess(p) {
    if (!has(p.categories_tags, DRINKS)) return 0;
    var pk = p.packaging_tags || [];
    if (has(pk, ["en:can", "en:plastic-bottle", "en:pet", "en:bottle-pet"])) return 25;
    if (has(pk, ["en:glass-bottle", "en:glass"])) return 8;
    return 0;
  }

  function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

  /* → {name, imgUrl, deposit} oder null (nicht gefunden) ; wirft bei Netzwerkfehler */
  function byBarcode(code) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
    var url = "https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json?fields=" + FIELDS;
    return fetch(url, { signal: ctl.signal }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.status !== 1 || !j.product) return null;
      var p = j.product;
      var base = clean(p.product_name_de || p.product_name || p.generic_name_de);
      var brand = clean((p.brands || "").split(",")[0]);
      var qty = clean(p.quantity);
      if (!base && !brand) return null;
      var name = base;
      if (brand && name.toLowerCase().indexOf(brand.toLowerCase()) < 0) name = brand + " " + name;
      name = clean(name);
      if (qty && name.toLowerCase().indexOf(qty.toLowerCase()) < 0) name += " " + qty;
      return { name: name.slice(0, 80), imgUrl: p.image_front_small_url || "", deposit: depositGuess(p) };
    });
  }
  return { byBarcode: byBarcode };
})();
