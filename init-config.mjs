import { PERSONAL_CONFIG, TEAM_CONFIG } from "./config.mjs";
import { ensureConfigFiles } from "./setup.mjs";

const created = ensureConfigFiles();
for (const file of created) console.log(`Criado: ${file}`);
for (const file of [TEAM_CONFIG, PERSONAL_CONFIG].filter((f) => !created.includes(f))) console.log(`Mantido (já existe): ${file}`);
console.log("\nEdite os arquivos acima. As mudanças valem na hora, sem reiniciar o serviço.");
console.log("Exemplo completo preenchido (empresa fictícia): pasta exemplos/ do repositório.");
