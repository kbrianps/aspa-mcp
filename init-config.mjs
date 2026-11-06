import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR, PERSONAL_CONFIG, TEAM_CONFIG } from "./config.mjs";

const templates = new URL("./modelos/", import.meta.url).pathname;
const knowledge = join(CONFIG_DIR, "conhecimento");

mkdirSync(knowledge, { recursive: true });
for (const [source, target] of [
  [join(templates, "equipe.yaml"), TEAM_CONFIG],
  [join(templates, "pessoal.yaml"), PERSONAL_CONFIG],
  [join(templates, "LEIA-ME-conhecimento.md"), join(knowledge, "LEIA-ME.md")],
]) {
  if (existsSync(target)) {
    console.log(`Mantido (já existe): ${target}`);
  } else {
    copyFileSync(source, target);
    console.log(`Criado: ${target}`);
  }
}
console.log("\nEdite os arquivos acima. As mudanças valem na hora, sem reiniciar o serviço.");
console.log("Exemplo completo preenchido (empresa fictícia): pasta exemplos/ do repositório.");
