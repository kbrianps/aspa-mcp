import assert from "node:assert/strict";
import { test } from "node:test";
import { present } from "../present.mjs";

test("pages the conversation list and drops duplicated captions", () => {
  const conversations = Array.from({ length: 5 }, (_, index) => ({ index, contact: `C${index}`, captions: ["x"] }));
  const first = present("listConversations", { tabs: [], conversations }, { limit: 2 });
  assert.deepEqual(first.conversations.map((c) => c.index), [0, 1]);
  assert.equal(first.next_cursor, 2);
  assert.equal(first.total, 5);
  assert.equal(first.conversations[0].captions, undefined);
  const last = present("listConversations", { tabs: [], conversations }, { limit: 2, cursor: 4 });
  assert.deepEqual(last.conversations.map((c) => c.index), [4]);
  assert.equal(last.next_cursor, undefined);
});

test("keeps only the kind and name of attachments when reading", () => {
  const result = present("readConversation", {
    url: "https://app",
    items: [{ index: 0, attachments: [{ kind: "audio", url: "", trigger: "a-1-0", name: undefined }] }, { index: 1, text: "oi" }],
  });
  assert.equal(result.url, undefined);
  assert.deepEqual(result.items[0].attachments, [{ kind: "audio", name: undefined }]);
  assert.equal(result.items[1].text, "oi");
});
