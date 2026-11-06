import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "aspa-mcp-test-"));
  process.env.ASPA_CONFIG_DIR = root;
  process.env.ASPA_ENV_FILE = join(root, "env");
  process.env.ASPA_TEAM_CONFIG = join(root, "equipe.yaml");
  process.env.ASPA_PERSONAL_CONFIG = join(root, "pessoal.yaml");
  delete process.env.ASPA_READ_ONLY;
  return root;
}

export const write = (path, content) => writeFileSync(path, content);
