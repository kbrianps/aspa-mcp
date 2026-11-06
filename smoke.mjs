import { call } from "./client.mjs";

if (process.argv[2] === "--login") {
  console.log(await call("login"));
  process.exit(0);
}

const list = await call("listConversations");
console.log("tabs:", list.tabs);
console.log("conversations:", list.conversations.length);

const target = process.argv[2];
if (target) {
  const conversation = await call("readConversation", { contact: target });
  console.log("contact:", conversation.contact);
  console.log("window:", conversation.responseWindow);
  console.log("items:", conversation.items.length);
  console.log("directions:", conversation.items.map((item) => item.direction ?? item.type).join(","));
  const templates = await call("listTemplates", { contact: target });
  console.log("templates:", templates.templates.map((t) => t.name).join(", "));
}
