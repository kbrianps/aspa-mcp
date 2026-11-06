const slimAttachments = (attachments) => attachments?.map(({ kind, name }) => ({ kind, name }));
const slimItems = (items) => items?.map((item) => (item.attachments ? { ...item, attachments: slimAttachments(item.attachments) } : item));

export function present(method, result, args = {}) {
  if (method === "listConversations") {
    const start = args.cursor ?? 0;
    const limit = args.limit ?? 50;
    const all = result.conversations.map(({ captions, ...item }) => item);
    const page = all.slice(start, start + limit);
    return { ...result, conversations: page, total: all.length, next_cursor: start + limit < all.length ? start + limit : undefined };
  }
  if (method === "readConversation") {
    const { url, ...rest } = result;
    return { ...rest, items: slimItems(result.items) };
  }
  if (method === "searchConversation") return { ...result, matches: slimItems(result.matches) };
  return result;
}
