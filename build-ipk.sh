#!/bin/bash
# Gera o .ipk da TV. Os ajustes de config.json (token Pulsoid, idade, peso) vão dentro do .ipk.
# Uso: ./build-ipk.sh            -> abre a versão publicada (GitHub Pages)
#      ./build-ipk.sh --mac      -> abre a versão servida por este Mac (./start.sh)
set -e
cd "$(dirname "$0")"
if [ "$1" = "--mac" ]; then
  APP_URL="http://$(ipconfig getifaddr en0 || ipconfig getifaddr en1):8787/"
else
  APP_URL="https://femotta.github.io/bike-tv/"
fi
CFG=$(node -e '
const fs = require("fs");
let c = {}; try { c = JSON.parse(fs.readFileSync("config.json", "utf8")); } catch {}
console.log(JSON.stringify(Object.assign({ pulsoidToken: "", age: 35, weightKg: 80, sex: "male", restingHr: 60 }, c)));
')
rm -rf build dist && mkdir -p build dist
cp webos/appinfo.json build/
APP_URL="$APP_URL" CFG="$CFG" node -e '
const fs = require("fs");
// string JS segura dentro de <script>: escapa \\, aspas e < (evita fechar a tag)
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'"'"'/g, "\\x27").replace(/</g, "\\x3c");
const html = fs.readFileSync("webos/index.html", "utf8")
  .replace("__APP_URL__", () => esc(process.env.APP_URL))
  .replace("__CFG__", () => esc(process.env.CFG));
fs.writeFileSync("build/index.html", html);
'
python3 make-icons.py build
ares-package build -o dist
echo "App da TV abre: $APP_URL"
