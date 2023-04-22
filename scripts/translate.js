const {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} = require("fs");
const { JSDOM } = require("jsdom");
const [, , lang, apiKey, translateAll] = process.argv;

if (!existsSync("out")) {
  console.error("`out` directory not found. Run `npm run build` first.");
  process.exit(1);
}

if (!lang || !apiKey) {
  console.error("args required: lang, apiKey");
  process.exit(1);
}

const targets = walk("out")
  .filter((x) => x.endsWith(".html"))
  .map((x) => {
    return { path: x, content: readFileSync(x, "utf8") };
  })
  .filter((x) => (translateAll ? true : x.path.match("multipage")));

(async () => {
  for (let _target of targets) {
    console.log("Translating", _target.path);
    const dom = new JSDOM(_target.content);
    const { document } = dom.window;
    [...document.querySelectorAll("*")]
      .filter(
        (x) =>
          (x.tagName !== "EMU-CLAUSE" && x.tagName.startsWith("EM")) ||
          x.tagName === "VAR"
      )
      .map((x) => x.setAttribute("translate", "no"));

    const targets =
      document.querySelector("#spec-container").children[0].children;

    for (let target of targets) {
      if (target.outerHTML.length > 10000) {
        const parent = target;
        for (let target of parent.children) {
          target.outerHTML = await translate(
            target.outerHTML,
            lang,
            _target.path
          );
        }
      } else {
        target.outerHTML = await translate(
          target.outerHTML,
          lang,
          _target.path
        );
      }
    }

    writeFileSync(_target.path, document.querySelector("html").outerHTML);
  }
})();

async function translate(text, lang, comment) {
  const req = await fetch("https://api-free.deepl.com/v2/translate?", {
    method: "POST",
    body: new URLSearchParams({
      target_lang: lang,
      source_lang: "en",
      text,
      tag_handling: "html",
    }).toString(),
    headers: {
      Authorization: "DeepL-Auth-Key " + apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!req.ok) {
    console.error("Failed translate", comment, req.statusText);
    process.exit(1);
  }

  const res = await req.json();

  return res.translations[0].text;
}

function walk(dir) {
  let results = [];
  const list = readdirSync(dir);
  list.forEach(function (file) {
    file = dir + "/" + file;
    const stat = statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(walk(file));
    else results.push(file);
  });
  return results;
}
