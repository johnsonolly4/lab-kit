---
name: feedback
description: Turn the user's Lab Kit Feedback export (pasted text, "Copy all" output) into BACKLOG.md items. Use when the user pastes feedback or says "here's my feedback".
---
# Feedback → backlog

Input: text from the feedback page's **Copy all** (lines like `- Item: Change - comment (2 screenshots)`), or pasted notes. Screenshots: ask the user to paste them into the chat if a comment refers to one.

1. Sort each line:
   - **Broken** → `## <version> bugs`
   - **Change** with a clear instruction → `## <version> quick changes`
   - **Change** that needs a design choice, or the comment asks a question → `## Decisions needed`
   - **Works** with no comment → nothing; with a comment → answer it in your reply
   - **Skip** → `## Not yet tested by the user`
2. One bullet per change, imperative, short. Quote the user's own words for anything ambiguous.
3. Merge with existing items instead of duplicating them. Tick off items the feedback confirms as fixed.
4. Reply with: the counts per section, the questions the user asked (each answered in 1–2 lines), and the decisions needed as multiple-choice questions.
