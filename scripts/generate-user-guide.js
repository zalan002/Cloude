const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, PageBreak
} = require("docx");
const fs = require("fs");

const DEEP_BLUE = "003A6F";
const MEDIUM_BLUE = "0066CC";
const GOLD = "D4A843";
const LIGHT_GRAY = "F3F4F6";
const WHITE = "FFFFFF";
const DARK = "1F2937";

function h1(t) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 120 }, children: [
    new TextRun({ text: t, color: DEEP_BLUE, bold: true, font: "Montserrat", size: 32 })
  ]});
}
function h2(t) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [
    new TextRun({ text: t, color: DEEP_BLUE, bold: true, font: "Montserrat", size: 26 })
  ]});
}
function h3(t) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 }, children: [
    new TextRun({ text: t, color: DEEP_BLUE, bold: true, font: "Montserrat", size: 22 })
  ]});
}
function p(t, opts) {
  var o = opts || {};
  return new Paragraph({ spacing: { after: o.after || 120 }, indent: o.indent ? { left: o.indent } : undefined, children: [
    new TextRun({ text: t, font: "Open Sans", size: 21, color: DARK, bold: !!o.bold, italics: !!o.italic })
  ]});
}
function bl(t, lvl) {
  return new Paragraph({ spacing: { after: 60 }, bullet: { level: lvl || 0 }, children: [
    new TextRun({ text: t, font: "Open Sans", size: 21, color: DARK })
  ]});
}
function st(num, t) {
  return new Paragraph({ spacing: { after: 80 }, indent: { left: 360 }, children: [
    new TextRun({ text: num + ". ", font: "Open Sans", size: 21, color: MEDIUM_BLUE, bold: true }),
    new TextRun({ text: t, font: "Open Sans", size: 21, color: DARK })
  ]});
}
function info(t) {
  return new Paragraph({ spacing: { before: 120, after: 120 }, shading: { type: ShadingType.SOLID, color: "E8F4FD" },
    indent: { left: 200, right: 200 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: MEDIUM_BLUE } },
    children: [ new TextRun({ text: "  [i] " + t, font: "Open Sans", size: 21, color: DARK, italics: true }) ]
  });
}
function warn(t) {
  return new Paragraph({ spacing: { before: 120, after: 120 }, shading: { type: ShadingType.SOLID, color: "FEF3C7" },
    indent: { left: 200, right: 200 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
    children: [ new TextRun({ text: "  [!] " + t, font: "Open Sans", size: 21, color: DARK, bold: true }) ]
  });
}
function ce(t, opts) {
  var o = opts || {};
  return new TableCell({
    shading: o.header ? { type: ShadingType.SOLID, color: DEEP_BLUE } : o.shade ? { type: ShadingType.SOLID, color: LIGHT_GRAY } : undefined,
    width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
    children: [ new Paragraph({ spacing: { before: 40, after: 40 }, children: [
      new TextRun({ text: t, font: "Open Sans", size: 19, color: o.header ? WHITE : DARK, bold: !!(o.header || o.bold) })
    ]})]
  });
}
function div() {
  return new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: LIGHT_GRAY } }, children: [] });
}
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function empty() { return p(""); }

// Use guillemets for quoting UI elements
var LQ = "\u00AB";
var RQ = "\u00BB";
function q(s) { return LQ + s + RQ; }

var doc = new Document({
  styles: { default: { document: { run: { font: "Open Sans", size: 21, color: DARK } } } },
  sections: [
    // COVER PAGE
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1200, right: 1200 } } },
      children: [
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          new TextRun({ text: "CONSORTIO", font: "Montserrat", size: 72, bold: true, color: DEEP_BLUE })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          new TextRun({ text: "Munkaid\u0151 Nyilv\u00e1ntart\u00f3 Rendszer", font: "Montserrat", size: 32, color: MEDIUM_BLUE })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
          new TextRun({ text: "Felhaszn\u00e1l\u00f3i K\u00e9zik\u00f6nyv", font: "Montserrat", size: 40, bold: true, color: DEEP_BLUE })
        ]}),
        new Paragraph({ spacing: { before: 1200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "K\u00e9sz\u00edtette: Training Hungary Kft.", font: "Open Sans", size: 22, color: DARK })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "Verzi\u00f3: 1.0", font: "Open Sans", size: 22, color: DARK })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "D\u00e1tum: 2026. m\u00e1rcius 16.", font: "Open Sans", size: 22, color: DARK })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new TextRun({ text: "https://consortio.traininghungary.com", font: "Open Sans", size: 22, color: MEDIUM_BLUE })
        ]}),
      ],
    },
    // CONTENT
    {
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
      children: [
        // TOC
        h1("Tartalomjegyz\u00e9k"),
        div(),
        p("1.  A rendszer \u00e1ttekint\u00e9se", {bold:true}),
        p("2.  Bejelentkez\u00e9s", {bold:true}),
        p("3.  Kezd\u0151lap (Dashboard)", {bold:true}),
        p("4.  \u00daj id\u0151bejegyz\u00e9s r\u00f6gz\u00edt\u00e9se", {bold:true}),
        p("5.  Bejegyz\u00e9seim (El\u0151zm\u00e9nyek)", {bold:true}),
        p("6.  Riportok \u00e9s elemz\u00e9sek", {bold:true}),
        p("7.  Admin funkci\u00f3k", {bold:true}),
        p("    7.1  Projekt szinkroniz\u00e1ci\u00f3 (MiniCRM)", {bold:true}),
        p("    7.2  Feladatkezel\u00e9s", {bold:true}),
        p("    7.3  Felhaszn\u00e1l\u00f3kezel\u00e9s", {bold:true}),
        p("8.  Gyakori k\u00e9rd\u00e9sek (GYIK)", {bold:true}),
        p("9.  Hibaelh\u00e1r\u00edt\u00e1s", {bold:true}),
        p("10. T\u00e1mogat\u00e1s \u00e9s kapcsolat", {bold:true}),

        // 1. A RENDSZER
        pb(),
        h1("1. A rendszer \u00e1ttekint\u00e9se"),
        div(),
        p("A CONSORTIO Munkaid\u0151 Nyilv\u00e1ntart\u00f3 egy webalap\u00fa alkalmaz\u00e1s, amely lehet\u0151v\u00e9 teszi a Consortio Zrt. munkat\u00e1rsai sz\u00e1m\u00e1ra a napi munkaid\u0151 prec\u00edz r\u00f6gz\u00edt\u00e9s\u00e9t, projektekhez \u00e9s feladatokhoz rendel\u00e9s\u00e9t, valamint r\u00e9szletes riportok k\u00e9sz\u00edt\u00e9s\u00e9t."),
        empty(),
        p("A rendszer f\u0151bb funkci\u00f3i:", {bold:true}),
        bl("Munkaid\u0151 r\u00f6gz\u00edt\u00e9se projektekhez \u00e9s feladatokhoz"),
        bl("Szem\u00e9lyes bejegyz\u00e9sek \u00e1ttekint\u00e9se \u00e9s kezel\u00e9se"),
        bl("Havi, projektalap\u00fa, feladatalap\u00fa \u00e9s heti riportok"),
        bl("MiniCRM-mel val\u00f3 automatikus projekt-szinkroniz\u00e1ci\u00f3"),
        bl("Felhaszn\u00e1l\u00f3- \u00e9s feladatkezel\u00e9s (adminisztr\u00e1torok sz\u00e1m\u00e1ra)"),
        empty(),
        p("Felhaszn\u00e1l\u00f3i szerepk\u00f6r\u00f6k:", {bold:true}),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [ ce("Szerepk\u00f6r", {header:true, width:25}), ce("Jogosults\u00e1gok", {header:true, width:75}) ] }),
          new TableRow({ children: [ ce("Munkat\u00e1rs", {bold:true}), ce("Id\u0151bejegyz\u00e9s r\u00f6gz\u00edt\u00e9se, saj\u00e1t bejegyz\u00e9sek megtekint\u00e9se/t\u00f6rl\u00e9se, saj\u00e1t riportok megtekint\u00e9se") ] }),
          new TableRow({ children: [ ce("Adminisztr\u00e1tor", {bold:true, shade:true}), ce("Minden munkat\u00e1rsi funkci\u00f3 + projekt szinkroniz\u00e1ci\u00f3, feladatkezel\u00e9s, felhaszn\u00e1l\u00f3kezel\u00e9s, \u00f6sszes felhaszn\u00e1l\u00f3 riportjainak megtekint\u00e9se", {shade:true}) ] }),
        ]}),
        empty(),
        p("El\u00e9r\u00e9s:", {bold:true}),
        p("A rendszer az al\u00e1bbi URL-en \u00e9rhet\u0151 el b\u00f6ng\u00e9sz\u0151b\u0151l (sz\u00e1m\u00edt\u00f3g\u00e9pen \u00e9s mobilon egyar\u00e1nt):"),
        p("https://consortio.traininghungary.com", {bold:true}),

        // 2. BEJELENTKEZES
        pb(),
        h1("2. Bejelentkez\u00e9s"),
        div(),
        p("A rendszer haszn\u00e1lat\u00e1hoz bejelentkez\u00e9s sz\u00fcks\u00e9ges. Az alkalmaz\u00e1s megnyit\u00e1sakor a bejelentkez\u00e9si k\u00e9perny\u0151 fogadja \u00d6nt."),
        empty(),
        p("Bejelentkez\u00e9s l\u00e9p\u00e9sei:", {bold:true}),
        st(1, "Nyissa meg a b\u00f6ng\u00e9sz\u0151ben a https://consortio.traininghungary.com oldalt."),
        st(2, "Adja meg az e-mail c\u00edm\u00e9t az " + q("E-mail c\u00edm") + " mez\u0151ben."),
        st(3, "Adja meg a jelszav\u00e1t a " + q("Jelsz\u00f3") + " mez\u0151ben."),
        st(4, "Kattintson a " + q("Bejelentkez\u00e9s") + " gombra."),
        st(5, "Sikeres bejelentkez\u00e9s ut\u00e1n a Kezd\u0151lapra (Dashboard) ker\u00fcl."),
        empty(),
        warn("Figyelem: A felhaszn\u00e1l\u00f3i fi\u00f3kokat az adminisztr\u00e1tor hozza l\u00e9tre. Ha m\u00e9g nincs fi\u00f3kja, k\u00e9rje a rendszergazd\u00e1t vagy \u00edrjon a support@traininghungary.com c\u00edmre."),
        info("Tipp: A rendszer megjegyzi a bejelentkez\u00e9s\u00e9t, \u00edgy nem kell minden alkalommal \u00fajra bel\u00e9pnie, am\u00edg ki nem jelentkezik."),

        // 3. KEZDOLAP
        pb(),
        h1("3. Kezd\u0151lap (Dashboard)"),
        div(),
        p("A bejelentkez\u00e9s ut\u00e1n a Kezd\u0151lap fogadja \u00d6nt, amely \u00e1ttekint\u00e9st ny\u00fajt a napi munkav\u00e9gz\u00e9sr\u0151l."),
        empty(),
        h3("Statisztikai k\u00e1rty\u00e1k"),
        p("A k\u00e9perny\u0151 tetej\u00e9n h\u00e1rom \u00f6sszefoglal\u00f3 k\u00e1rtya jelenik meg:"),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [ ce("K\u00e1rtya", {header:true, width:30}), ce("Le\u00edr\u00e1s", {header:true, width:70}) ] }),
          new TableRow({ children: [ ce("Mai \u00f3r\u00e1k", {bold:true}), ce("Az adott napon r\u00f6gz\u00edtett \u00f6sszes munkaid\u0151 (\u00f3ra \u00e9s perc)") ] }),
          new TableRow({ children: [ ce("Heti \u00f6sszesen", {bold:true, shade:true}), ce("Az elm\u00falt 7 napban r\u00f6gz\u00edtett \u00f6sszes munkaid\u0151", {shade:true}) ] }),
          new TableRow({ children: [ ce("Akt\u00edv projektek", {bold:true}), ce("Azon projektek sz\u00e1ma, amelyeken az elm\u00falt h\u00e9ten dolgozott") ] }),
        ]}),
        empty(),
        h3("Gyors bejegyz\u00e9s"),
        p("Az akt\u00edv projektek list\u00e1ja gombokk\u00e9nt jelenik meg. B\u00e1rmelyikre kattintva k\u00f6zvetlen\u00fcl az id\u0151bejegyz\u00e9s \u0171rlapra ugorhat, ahol a kiv\u00e1lasztott projekt m\u00e1r el\u0151re ki van t\u00f6ltve."),
        empty(),
        h3("Mai bejegyz\u00e9sek"),
        p("Az aznap r\u00f6gz\u00edtett \u00f6sszes id\u0151bejegyz\u00e9s list\u00e1ja, amely tartalmazza:"),
        bl("A projekt nev\u00e9t"),
        bl("A feladat nev\u00e9t (ha van)"),
        bl("A le\u00edr\u00e1st (ha megadta)"),
        bl("A r\u00f6gz\u00edtett id\u0151tartamot"),
        bl("T\u00f6rl\u00e9s gombot az egyes bejegyz\u00e9sekn\u00e9l"),

        // 4. UJ IDOBEJEGYZES
        pb(),
        h1("4. \u00daj id\u0151bejegyz\u00e9s r\u00f6gz\u00edt\u00e9se"),
        div(),
        p("Ez a rendszer legfontosabb funkci\u00f3ja \u2013 itt r\u00f6gz\u00edtheti a napi munkaidej\u00e9t."),
        empty(),
        p("Megnyit\u00e1s:", {bold:true}),
        bl("Kattintson az oldals\u00e1vban az " + q("\u00daj bejegyz\u00e9s") + " men\u00fcpontra, VAGY"),
        bl("A Kezd\u0151lapon kattintson a " + q("+ \u00daj bejegyz\u00e9s") + " gombra, VAGY"),
        bl("A Kezd\u0151lapon kattintson egy projekt nev\u00e9re a Gyors bejegyz\u00e9s szekci\u00f3ban"),
        empty(),
        p("Az \u0171rlap mez\u0151i:", {bold:true}),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [ ce("Mez\u0151", {header:true, width:22}), ce("Le\u00edr\u00e1s", {header:true, width:56}), ce("K\u00f6telez\u0151?", {header:true, width:22}) ] }),
          new TableRow({ children: [ ce("Projekt", {bold:true}), ce("V\u00e1lassza ki a projektet a leg\u00f6rd\u00fcl\u0151 list\u00e1b\u00f3l. Kereshet n\u00e9v, kateg\u00f3ria vagy MiniCRM ID alapj\u00e1n."), ce("Igen") ] }),
          new TableRow({ children: [ ce("Feladat", {bold:true, shade:true}), ce("V\u00e1lassza ki a feladatot. A feladatok kateg\u00f3ri\u00e1nk\u00e9nt vannak csoportos\u00edtva.", {shade:true}), ce("Igen", {shade:true}) ] }),
          new TableRow({ children: [ ce("D\u00e1tum", {bold:true}), ce("Az adott nap d\u00e1tuma. Alap\u00e9rtelmezetten a mai nap, de m\u00f3dos\u00edthat\u00f3."), ce("Igen") ] }),
          new TableRow({ children: [ ce("Id\u0151tartam (perc)", {bold:true, shade:true}), ce("A munkaid\u0151 percben megadva (1-1440). Automatikus \u00f3ra:perc megjelen\u00edt\u00e9s.", {shade:true}), ce("Igen", {shade:true}) ] }),
          new TableRow({ children: [ ce("Le\u00edr\u00e1s", {bold:true}), ce("Sz\u00f6veges megjegyz\u00e9s a v\u00e9gzett munk\u00e1r\u00f3l."), ce("Nem") ] }),
        ]}),
        empty(),
        p("Bejegyz\u00e9s ment\u00e9se:", {bold:true}),
        st(1, "T\u00f6ltse ki az \u00f6sszes k\u00f6telez\u0151 mez\u0151t."),
        st(2, "Kattintson a " + q("Ment\u00e9s") + " gombra."),
        st(3, "Sikeres ment\u00e9s ut\u00e1n z\u00f6ld pipa jelenik meg, majd \u00e1tir\u00e1ny\u00edt\u00e1s a " + q("Bejegyz\u00e9seim") + " oldalra."),
        empty(),
        info("Tipp: A keres\u0151ben el\u00e9g n\u00e9h\u00e1ny bet\u0171t be\u00edrni. Billenty\u0171zettel is navig\u00e1lhat (fel/le nyilak, Enter, Escape)."),
        info("Tipp: Ha 90 percet dolgozott, \u00edrja be: 90. A rendszer mutatja: 1 \u00f3ra 30 perc."),

        // 5. BEJEGYZESEIM
        pb(),
        h1("5. Bejegyz\u00e9seim (El\u0151zm\u00e9nyek)"),
        div(),
        p("Ezen az oldalon megtekintheti \u00e9s kezelheti az elm\u00falt 14 nap id\u0151bejegyz\u00e9seit."),
        empty(),
        p("Megnyit\u00e1s:", {bold:true}),
        p("Kattintson az oldals\u00e1vban a " + q("Bejegyz\u00e9seim") + " men\u00fcpontra."),
        empty(),
        p("A megjelen\u00edt\u00e9s fel\u00e9p\u00edt\u00e9se:", {bold:true}),
        bl("A bejegyz\u00e9sek napok szerint vannak csoportos\u00edtva, leg\u00fajabb nap el\u00f6l"),
        bl("Minden napn\u00e1l megjelenik a nap neve \u00e9s d\u00e1tuma"),
        bl("Minden napn\u00e1l egy k\u00e9k kit\u0171z\u0151 mutatja a napi \u00f6sszes\u00edt\u00e9st"),
        empty(),
        p("Egy bejegyz\u00e9s adatai:", {bold:true}),
        bl("Projekt neve"),
        bl("Feladat neve (k\u00e9k sz\u00ednnel)"),
        bl("Le\u00edr\u00e1s (ha van)"),
        bl("Id\u0151tartam (\u00f3ra \u00e9s perc form\u00e1tumban)"),
        empty(),
        p("Bejegyz\u00e9s t\u00f6rl\u00e9se:", {bold:true}),
        st(1, "Keresse meg a t\u00f6r\u00f6lni k\u00edv\u00e1nt bejegyz\u00e9st."),
        st(2, "Kattintson a piros t\u00f6rl\u00e9s ikonra a bejegyz\u00e9s jobb oldal\u00e1n."),
        st(3, "Er\u0151s\u00edtse meg a t\u00f6rl\u00e9st a felugr\u00f3 ablakban."),
        st(4, "A bejegyz\u00e9s v\u00e9glegesen t\u00f6rl\u0151dik, \u00e9s a lista friss\u00fcl."),
        warn("Figyelem: A t\u00f6rl\u00e9s v\u00e9gleges \u00e9s nem vonhat\u00f3 vissza!"),

        // 6. RIPORTOK
        pb(),
        h1("6. Riportok \u00e9s elemz\u00e9sek"),
        div(),
        p("A Riportok oldalon r\u00e9szletes kimutat\u00e1sokat tekinthet meg a munkaid\u0151-adatokr\u00f3l. N\u00e9gy k\u00fcl\u00f6nb\u00f6z\u0151 n\u00e9zet \u00e9rhet\u0151 el f\u00fclekre kattintva."),
        empty(),
        p("Megnyit\u00e1s:", {bold:true}),
        p("Kattintson az oldals\u00e1vban a " + q("Riportok") + " men\u00fcpontra."),
        empty(),
        info("Munkat\u00e1rsak csak a saj\u00e1t adataikat l\u00e1tj\u00e1k. Adminisztr\u00e1torok az \u00f6sszes felhaszn\u00e1l\u00f3 adatait megtekinthetik \u00e9s sz\u0171rhetik."),
        empty(),
        h2("6.1 Havi \u00f6sszes\u00edt\u0151"),
        p("Az adott h\u00f3nap munkaid\u0151-adatait mutatja felhaszn\u00e1l\u00f3nk\u00e9nt \u00f6sszes\u00edtve."),
        st(1, "V\u00e1lassza ki a k\u00edv\u00e1nt h\u00f3napot a d\u00e1tumv\u00e1laszt\u00f3val."),
        st(2, "Megjelenik a felhaszn\u00e1l\u00f3k list\u00e1ja v\u00edzszintes s\u00e1vdiagrammal."),
        st(3, "Kattintson egy felhaszn\u00e1l\u00f3 nev\u00e9re a r\u00e9szletes bont\u00e1s megtekint\u00e9s\u00e9hez."),
        empty(),
        h2("6.2 Projekt bont\u00e1s"),
        p("A projektek szerinti munkaid\u0151-kimutat\u00e1st jelen\u00edti meg."),
        p("Sz\u0171r\u00e9si lehet\u0151s\u00e9gek:", {bold:true}),
        bl("Szem\u00e9ly sz\u0171r\u0151 (admin eset\u00e9n): v\u00e1lasszon egy konkr\u00e9t felhaszn\u00e1l\u00f3t vagy a " + q("Mindenki") + " opci\u00f3t"),
        bl("D\u00e1tum sz\u0171r\u0151: adjon meg kezd\u0151 \u00e9s z\u00e1r\u00f3 d\u00e1tumot"),
        bl(q("Sz\u0171r\u0151 t\u00f6rl\u00e9se") + " gomb: vissza\u00e1ll\u00edtja a d\u00e1tum sz\u0171r\u0151t"),
        p("A kimutat\u00e1s elemei:", {bold:true}),
        bl("Projektek list\u00e1ja az \u00f6sszegzett \u00f3r\u00e1kkal"),
        bl("Kattintson egy projektre a r\u00e9szletek megtekint\u00e9s\u00e9hez"),
        bl("\u00d6sszeg\u00e9s\u00edtett \u00f3rasz\u00e1m az oldal alj\u00e1n"),
        empty(),
        h2("6.3 Feladat bont\u00e1s"),
        p("A feladatok szerinti munkaid\u0151-kimutat\u00e1s \u2013 ugyanazokkal a sz\u0171r\u00e9si lehet\u0151s\u00e9gekkel."),
        bl("Feladatok list\u00e1ja az \u00f6sszegzett \u00f3r\u00e1kkal"),
        bl("Kattintson egy feladatra a r\u00e9szletek megtekint\u00e9s\u00e9hez"),
        empty(),
        h2("6.4 Heti n\u00e9zet"),
        p("Az elm\u00falt 14 nap munkaidej\u00e9t jelen\u00edti meg oszlopdiagramon."),
        bl("Minden oszlop egy napot jel\u00f6l, a nap nev\u00e9vel \u00e9s d\u00e1tum\u00e1val"),
        bl("A h\u00e9tv\u00e9gi napok vil\u00e1gosabb sz\u00ednnel jelennek meg"),
        bl("Az oszlopok tetej\u00e9n az adott napi \u00f3rasz\u00e1m olvashat\u00f3"),
        bl("Az oldal alj\u00e1n a 14 napos \u00f6sszeg\u00e9s\u00edt\u00e9s l\u00e1that\u00f3"),

        // 7. ADMIN
        pb(),
        h1("7. Admin funkci\u00f3k"),
        div(),
        warn("Az al\u00e1bbi funkci\u00f3k kiz\u00e1r\u00f3lag adminisztr\u00e1tori jogosults\u00e1ggal rendelkez\u0151 felhaszn\u00e1l\u00f3k sz\u00e1m\u00e1ra \u00e9rhet\u0151k el. Az oldals\u00e1vban az ADMIN felirat alatt jelennek meg."),
        empty(),
        h2("7.1 Projekt szinkroniz\u00e1ci\u00f3 (MiniCRM)"),
        p("A rendszer k\u00e9pes automatikusan import\u00e1lni a projekteket a MiniCRM-b\u0151l Google Sheets-en kereszt\u00fcl."),
        empty(),
        p("Manu\u00e1lis szinkroniz\u00e1ci\u00f3:", {bold:true}),
        st(1, "Navig\u00e1ljon az oldals\u00e1vban a " + q("Projekt Szinkron") + " men\u00fcpontra."),
        st(2, "Kattintson a " + q("Szinkroniz\u00e1l\u00e1s most") + " gombra."),
        st(3, "V\u00e1rja meg a folyamat v\u00e9g\u00e9t (forg\u00f3 ikon jelzi)."),
        st(4, "A szinkroniz\u00e1ci\u00f3 v\u00e9g\u00e9n megjelenik az eredm\u00e9ny:"),
        bl("Szinkroniz\u00e1lt projektek sz\u00e1ma", 1),
        bl("\u00c9rt\u00e9kes\u00edt\u00e9s \u00e9s Partner forr\u00e1sb\u00f3l \u00e9rkezett projektek sz\u00e1ma", 1),
        bl("Kisz\u0171rt duplik\u00e1tumok sz\u00e1ma", 1),
        bl("Esetleges hib\u00e1k sz\u00e1ma", 1),
        empty(),
        p("Automatikus szinkroniz\u00e1ci\u00f3 be\u00e1ll\u00edt\u00e1sa:", {bold:true}),
        st(1, "Kapcsolja be az " + q("Automatikus napi szinkroniz\u00e1ci\u00f3") + " kapcsol\u00f3t."),
        st(2, "V\u00e1lassza ki a k\u00edv\u00e1nt id\u0151pontot (UTC id\u0151z\u00f3n\u00e1ban)."),
        st(3, "Kattintson a " + q("Be\u00e1ll\u00edt\u00e1sok ment\u00e9se") + " gombra."),
        p("A rendszer ezut\u00e1n naponta automatikusan szinkroniz\u00e1lja a projekteket."),
        empty(),
        p("Manu\u00e1lis projekt hozz\u00e1ad\u00e1sa:", {bold:true}),
        st(1, "Kattintson a " + q("+ \u00daj Projekt") + " gombra."),
        st(2, "Adja meg a projekt nev\u00e9t."),
        st(3, "Kattintson a " + q("Hozz\u00e1ad\u00e1s") + " gombra."),
        info("A manu\u00e1lisan hozz\u00e1adott projekteket a szinkroniz\u00e1ci\u00f3 nem \u00e9rinti \u2013 nem \u00edr\u00f3dnak fel\u00fcl \u00e9s nem t\u00f6rl\u0151dnek."),
        empty(),
        p("Projekt lista kezel\u00e9se:", {bold:true}),
        bl("Kereshet projekt n\u00e9v vagy kateg\u00f3ria alapj\u00e1n"),
        bl("Sz\u0171rhet forr\u00e1s szerint (MiniCRM \u00c9rt\u00e9kes\u00edt\u00e9s, MiniCRM Partner, Manu\u00e1lis)"),
        bl("Sz\u0171rhet st\u00e1tusz szerint (Akt\u00edv, Archiv\u00e1lt)"),
        bl("Kattintson egy projektre a MiniCRM nyers adatainak megtekint\u00e9s\u00e9hez"),
        bl("Az Akt\u00edv/Archiv\u00e1lt gombbal m\u00f3dos\u00edthatja a projekt st\u00e1tusz\u00e1t"),
        info("Az archiv\u00e1lt projektek nem jelennek meg az id\u0151bejegyz\u00e9s \u0171rlap projekt v\u00e1laszt\u00f3j\u00e1ban."),

        // 7.2 FELADATKEZELES
        pb(),
        h2("7.2 Feladatkezel\u00e9s"),
        p("A feladatok azok a tev\u00e9kenys\u00e9gt\u00edpusok, amelyeket a felhaszn\u00e1l\u00f3k id\u0151bejegyz\u00e9skor kiv\u00e1laszthatnak."),
        empty(),
        p("\u00daj feladat l\u00e9trehoz\u00e1sa:", {bold:true}),
        st(1, "Navig\u00e1ljon a " + q("Feladatok") + " men\u00fcpontra az oldals\u00e1vban."),
        st(2, "Kattintson a " + q("+ \u00daj Feladat") + " gombra."),
        st(3, "Adja meg a feladat nev\u00e9t."),
        st(4, "Opcion\u00e1lisan v\u00e1lasszon kateg\u00f3ri\u00e1t:"),
        bl("\u00c9RT\u00c9KES\u00cdT\u00c9S", 1),
        bl("JOG", 1),
        bl("ASSZISZTENCIA", 1),
        bl("K\u00d6NYVEL\u00c9S", 1),
        bl("MUNKA\u00dcGY", 1),
        st(5, "Kattintson a " + q("Hozz\u00e1ad\u00e1s") + " gombra."),
        empty(),
        p("Feladatok kezel\u00e9se:", {bold:true}),
        bl("Kateg\u00f3ria m\u00f3dos\u00edt\u00e1sa: v\u00e1lassza ki az \u00faj kateg\u00f3ri\u00e1t a leg\u00f6rd\u00fcl\u0151 list\u00e1b\u00f3l"),
        bl("St\u00e1tusz m\u00f3dos\u00edt\u00e1sa: kattintson az Akt\u00edv/Archiv\u00e1lt gombra"),
        bl("Feladat t\u00f6rl\u00e9se: csak akkor lehets\u00e9ges, ha nincs hozz\u00e1 id\u0151bejegyz\u00e9s"),
        bl("Sz\u0171r\u00e9s: kereshet n\u00e9v, kateg\u00f3ria vagy st\u00e1tusz alapj\u00e1n"),
        warn("Ha egy feladathoz m\u00e1r van id\u0151bejegyz\u00e9s, a feladat nem t\u00f6r\u00f6lhet\u0151 \u2013 csak archiv\u00e1lhat\u00f3."),

        // 7.3 FELHASZNALOKEZELES
        empty(),
        h2("7.3 Felhaszn\u00e1l\u00f3kezel\u00e9s"),
        p("Az adminisztr\u00e1torok itt kezelhetik a rendszer felhaszn\u00e1l\u00f3it."),
        empty(),
        p("Felhaszn\u00e1l\u00f3 lista:", {bold:true}),
        bl("N\u00e9v \u00e9s e-mail c\u00edm"),
        bl("R\u00e9szleg (\u00c9rt\u00e9kes\u00edt\u00e9s, Jog, Asszisztencia, K\u00f6nyvel\u00e9s, Munka\u00fcgy)"),
        bl("Szerepk\u00f6r (Admin / Munkat\u00e1rs)"),
        bl("St\u00e1tusz (Akt\u00edv / Inakt\u00edv)"),
        empty(),
        p("Kezel\u00e9si lehet\u0151s\u00e9gek:", {bold:true}),
        bl("R\u00e9szleg m\u00f3dos\u00edt\u00e1sa: v\u00e1lassza ki az \u00faj r\u00e9szleget a leg\u00f6rd\u00fcl\u0151 list\u00e1b\u00f3l"),
        bl("Szerepk\u00f6r v\u00e1lt\u00e1sa: kattintson a szerepk\u00f6r gombra (lila = Admin, k\u00e9k = Munkat\u00e1rs)"),
        bl("St\u00e1tusz v\u00e1lt\u00e1sa: kattintson a st\u00e1tusz gombra (z\u00f6ld = Akt\u00edv, piros = Inakt\u00edv)"),
        empty(),
        warn("Saj\u00e1t fi\u00f3kj\u00e1t nem m\u00f3dos\u00edthatja. Ezt egy m\u00e1sik adminisztr\u00e1tornak kell elv\u00e9geznie."),
        empty(),
        p("\u00daj felhaszn\u00e1l\u00f3 ig\u00e9nyl\u00e9se:", {bold:true}),
        p("\u00cdrjon a support@traininghungary.com c\u00edmre az al\u00e1bbi adatokkal:"),
        bl("Felhaszn\u00e1l\u00f3 teljes neve"),
        bl("E-mail c\u00edm"),
        bl("K\u00edv\u00e1nt szerepk\u00f6r (Admin vagy Munkat\u00e1rs)"),
        bl("R\u00e9szleg"),

        // 8. GYIK
        pb(),
        h1("8. Gyakori k\u00e9rd\u00e9sek (GYIK)"),
        div(),
        p("Elfelejtett jelsz\u00f3 \u2013 mit tegyek?", {bold:true}),
        p("\u00cdrjon a support@traininghungary.com c\u00edmre, \u00e9s az adminisztr\u00e1tor \u00faj jelsz\u00f3t \u00e1ll\u00edt be \u00d6nnek.", {indent:360}),
        empty(),
        p("M\u00faltbeli napra is r\u00f6gz\u00edthetek id\u0151t?", {bold:true}),
        p("Igen! Az id\u0151bejegyz\u00e9s \u0171rlapon a d\u00e1tum mez\u0151ben kiv\u00e1laszthat kor\u00e1bbi d\u00e1tumot is.", {indent:360}),
        empty(),
        p("H\u00e1ny percet adhatok meg maximum?", {bold:true}),
        p("Minimum 1, maximum 1440 perc (24 \u00f3ra) egy bejegyz\u00e9sben. Egy napra t\u00f6bb bejegyz\u00e9s is k\u00e9sz\u00edthet\u0151.", {indent:360}),
        empty(),
        p("M\u00f3dos\u00edthatom egy megl\u00e9v\u0151 bejegyz\u00e9semet?", {bold:true}),
        p("Jelenleg a bejegyz\u00e9sek nem szerkeszthet\u0151k, de t\u00f6r\u00f6lhet\u0151k. T\u00f6r\u00f6lje \u00e9s k\u00e9sz\u00edtsen \u00fajat.", {indent:360}),
        empty(),
        p("Meddig l\u00e1tom a kor\u00e1bbi bejegyz\u00e9seimet?", {bold:true}),
        p("A Bejegyz\u00e9seim oldalon az elm\u00falt 14 nap l\u00e1that\u00f3. R\u00e9gebbi adatokhoz haszn\u00e1lja a Riportok oldalt d\u00e1tum sz\u0171r\u0151vel.", {indent:360}),
        empty(),
        p("Nem tal\u00e1lom a projektemet \u2013 mit tegyek?", {bold:true}),
        p("Lehets\u00e9ges, hogy archiv\u00e1lva van vagy m\u00e9g nem szinkroniz\u00e1l\u00f3dott. K\u00e9rje meg az adminisztr\u00e1tort.", {indent:360}),
        empty(),
        p("Mobilr\u00f3l is haszn\u00e1lhat\u00f3?", {bold:true}),
        p("Igen! A rendszer reszponz\u00edv. Mobilon a men\u00fc a bal fels\u0151 hamburger ikonnal nyithat\u00f3.", {indent:360}),

        // 9. HIBAELHARITAS
        pb(),
        h1("9. Hibaelh\u00e1r\u00edt\u00e1s"),
        div(),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [ ce("Probl\u00e9ma", {header:true, width:35}), ce("Megold\u00e1s", {header:true, width:65}) ] }),
          new TableRow({ children: [ ce("Nem tudok bejelentkezni"), ce("Ellen\u0151rizze az e-mail c\u00edmet \u00e9s jelsz\u00f3t. Forduljon az adminisztr\u00e1torhoz.") ] }),
          new TableRow({ children: [ ce("Az oldal nem t\u00f6lt\u0151dik be", {shade:true}), ce("Friss\u00edtse az oldalt (F5 / Ctrl+R). T\u00f6r\u00f6lje a b\u00f6ng\u00e9sz\u0151 gyors\u00edt\u00f3t\u00e1r\u00e1t.", {shade:true}) ] }),
          new TableRow({ children: [ ce("A ment\u00e9s gomb nem m\u0171k\u00f6dik"), ce("Ellen\u0151rizze, hogy minden k\u00f6telez\u0151 mez\u0151 ki van-e t\u00f6ltve.") ] }),
          new TableRow({ children: [ ce("Szinkroniz\u00e1ci\u00f3s hib\u00e1k", {shade:true}), ce("Ellen\u0151rizze az internetkapcsolatot \u00e9s a Google Sheets hivatkoz\u00e1sok \u00e9rv\u00e9nyess\u00e9g\u00e9t.", {shade:true}) ] }),
          new TableRow({ children: [ ce("Nem l\u00e1tom az Admin men\u00fct"), ce("Csak adminisztr\u00e1tori szerepk\u00f6rrel el\u00e9rhet\u0151. K\u00e9rje meg egy m\u00e1sik admint.") ] }),
          new TableRow({ children: [ ce("Nem tal\u00e1lok projektet", {shade:true}), ce("G\u00e9peljen a keres\u0151be. Ha archiv\u00e1lt, az adminnak kell \u00fajraaktiv\u00e1lnia.", {shade:true}) ] }),
        ]}),

        // 10. TAMOGATAS
        empty(),
        empty(),
        h1("10. T\u00e1mogat\u00e1s \u00e9s kapcsolat"),
        div(),
        p("Ha k\u00e9rd\u00e9se van, az al\u00e1bbi m\u00f3don k\u00e9rhet seg\u00edts\u00e9get:"),
        empty(),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [ ce("Kapcsolat", {header:true, width:30}), ce("El\u00e9rhet\u0151s\u00e9g", {header:true, width:70}) ] }),
          new TableRow({ children: [ ce("E-mail", {bold:true}), ce("support@traininghungary.com") ] }),
          new TableRow({ children: [ ce("Rendszer URL", {bold:true, shade:true}), ce("https://consortio.traininghungary.com", {shade:true}) ] }),
          new TableRow({ children: [ ce("\u00dczemelteto", {bold:true}), ce("Training Hungary Kft.") ] }),
        ]}),
        empty(),
        empty(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 },
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: GOLD } }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, children: [
          new TextRun({ text: "CONSORTIO Munkaid\u0151 Nyilv\u00e1ntart\u00f3", font: "Montserrat", size: 20, color: DEEP_BLUE, bold: true })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
          new TextRun({ text: "\u00a9 2026 Training Hungary Kft. \u2013 Minden jog fenntartva.", font: "Open Sans", size: 18, color: "6B7280" })
        ]}),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(function(buffer) {
  var outPath = "/home/user/Cloude/public/CONSORTIO_Felhasznaloi_Kezikonyv.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("User guide generated: " + outPath + " (" + (buffer.length / 1024).toFixed(0) + " KB)");
}).catch(function(err) { console.error("Error:", err); });
