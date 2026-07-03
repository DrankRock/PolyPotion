const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || ".";
const re = /register\(\s*["'`](\w+)/g;

let total = 0;
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort();

for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  let count = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(src)) !== null) {
    console.log(`${f} -> ${m[1]}`);
    count++;
  }
  total += count;
  console.error(`# ${f}: ${count} objects`);
}
console.error(`# TOTAL: ${total} objects`);