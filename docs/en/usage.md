# How to use

[← Back to README](../../README.en.md) · [Installation](installation.md) · [Usage](usage.md) · [Configuration](configuration.md) · [Notifications](notifications.md) · [Troubleshooting](troubleshooting.md) · [Reference](reference.md) · 🇧🇷 [Português](../uso.md)

## Day-to-day use

Open Claude Code in any folder and **ask in plain language**, the way you would ask a colleague. English and Portuguese both work.

### Recommended flow

1. **See what came in**
   > List the Aspa conversations and tell me which ones are unread.
2. **Understand the problem**
   > Read João's conversation and summarize it in 3 lines. If there is audio, transcribe it. If there is an image, tell me what it shows.
3. **Ask for a draft**
   > Prepare a draft reply. Don't send it yet.

   Claude automatically checks the team's tone, rules and documents.
4. **Review**: ask for changes if you want ("shorter", "explain step 2 better").
5. **Send** (pick one way)
   - Through Claude:
     > Go ahead and send it.

     Claude Code shows a **permission prompt** with the exact text. Check it and approve.
   - In Aspa itself, reviewing it on screen:
     > Open it in Aspa with this draft so I can review it.

     An **Aspa window** opens directly on the conversation, with the text already in the message box. You edit it and click send in the panel. While the window is open, notifications and other actions are paused; close the window when you are done. The audit log records whether you sent it.
6. **Organize**
   > Close João's conversation.

### Important rules

- **Nothing is sent without your approval.** Sending, transferring, snoozing, closing, reopening and renaming always open a permission prompt.
- **Never choose "always allow"** for these tools. Approve them one by one.
- **WhatsApp 24-hour window**: after 24 hours without a message from the customer, you can only send **templates**. Claude warns you and suggests one.
- **Reading does not mark as read:** an unread conversation stays unread after the assistant reads it (it takes a few extra seconds). To mark it as read, ask to "read it and mark it as read".
- **A conversation with no agent assigned** shows "Assumir" (Take over) instead of the message box: ask Claude to "take over the conversation" before replying or transferring.

---

## Example requests

### Read and understand

```text
List the open Aspa conversations and tell me which ones are marked as unread.
```

```text
Read João's conversation in Aspa and summarize the problem in 3 lines.
```

```text
Read Maria's conversation (load more history 2 times), download the attachments and tell me what the images and the PDF show.
```

```text
Transcribe the audio messages in João's conversation and tell me what he asked for.
```

```text
Go through every conversation where the last message is from the customer and, for each one, give me: contact, a 1-line summary and a draft reply. Don't send anything.
```

```text
Read the conversation with the customer ACME and check in our system's code whether the behavior they describe is expected. Then prepare a draft explaining it to the customer.
```

### Reply

```text
Prepare a draft reply for João. Only send it after I approve.
```

```text
Go ahead and send João the draft I approved.
```

```text
The 24-hour window in Maria's conversation has closed. List the templates and send "Iniciar-conversa-manhã".
```

```text
Send João the PDF /home/eu/Downloads/manual.pdf with the caption "Segue o manual".
```

### More panel features

```text
List only the conversations with no reply, from oldest to newest.
```

```text
Search Maria's conversation for where she mentioned "boleto".
```

```text
Reply quoting João's last message: "Recebido, já estou verificando."
```

```text
Show today's Aspa statistics.
```

```text
Look up the contact with phone number 41 99999-9999.
```

```text
Search the closed conversations for last week's conversation with ACME.
```

### Organize

```text
Take over João's conversation.
```

```text
Mark João's conversation as unread.
```

```text
Snooze Maria's conversation until Monday at 9 a.m., with the comment "aguardando boleto".
```

```text
Transfer Maria's conversation to the Comercial team with the comment "cliente quer upgrade".
```

```text
Snooze João's conversation for 1 day.
```

```text
Close João's conversation.
```

```text
Reopen João's conversation that was closed yesterday.
```

### Configuration and session

```text
What are the team's reply guidelines and which documents do you have about the company?
```

```text
What do our documents say about the cancellation deadline?
```

```text
Show everything that was sent through Aspa today and whether any action failed.
```

```text
My Aspa session expired, sign in again.
```
