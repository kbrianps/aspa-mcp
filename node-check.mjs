const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(`O aspa-mcp precisa do Node.js 22.12 ou mais novo; este computador tem o ${process.versions.node}. Atualize o Node e rode npm ci de novo.`);
  process.exit(1);
}
