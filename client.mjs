import { request } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";

export const SOCKET_PATH =
  process.env.ASPA_SOCKET || join(process.env.XDG_RUNTIME_DIR || join(homedir(), ".local", "share", "aspa-mcp"), "aspa-mcp.sock");

export function call(method, args = {}, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ method, args });
    const req = request(
      { socketPath: SOCKET_PATH, path: "/call", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) resolve(parsed.result);
            else reject(new Error(parsed.error));
          } catch {
            reject(new Error(`Invalid daemon response: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Daemon request timed out.")));
    req.on("error", (error) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        reject(new Error("aspa-mcp daemon is not running. Start it with: systemctl --user start aspa-mcp (or npm run daemon)."));
      } else reject(error);
    });
    req.end(body);
  });
}
