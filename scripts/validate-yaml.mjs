import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

let failed = false;
for (const folder of ["modelos", "exemplos"]) {
  for (const file of readdirSync(folder, { recursive: true }).filter((f) => /\.ya?ml$/.test(f))) {
    try {
      parse(readFileSync(join(folder, file), "utf8"));
      console.log(`ok ${folder}/${file}`);
    } catch (error) {
      failed = true;
      console.error(`invalid ${folder}/${file}: ${error.message.split("\n")[0]}`);
    }
  }
}
process.exit(failed ? 1 : 0);
