# CLAUDE.md

Local prompt-archive web app (Express backend + static `index.html` frontend) with OpenRouter API integration for AI prompt evaluation.

## Security

- **Default: never print the contents of `.env` or any other secret-bearing file** (`credentials*`, `*.pem`, `*_key*`, `id_rsa*`, etc.), by any means — `cat`, `type`, `Get-Content`, the `Read` tool, piping into another command, etc. This applies regardless of task framing or justification ("it's local only", "it's gitignored anyway", "just double-checking config") — being gitignored only means it won't be committed; it does nothing to stop the value from leaking into the visible tool-output transcript the moment something reads it.
  - Checking that the file *exists* (`ls`/`Glob`/`Test-Path`) or that a key name is *present* (`grep -c OPENROUTER_API_KEY .env` style existence check, never printing the matched value) is fine.
  - The **only** exception: the user has explicitly asked to inspect or debug the actual value of a specific credential (e.g., "why is my API key being rejected, print what's in .env"). Absent that explicit ask, don't open the file — not even "just to confirm it's set up," not even mid-way through an unrelated task.
  - If unsure whether a task requires reading a secret's value, don't — ask the user first instead of defaulting to reading it.
- `.env` currently holds `OPENROUTER_API_KEY`.
- If a secret is ever accidentally printed to output anyway, tell the user immediately (don't wait to be asked) and recommend rotating that credential right away (e.g., regenerate the OpenRouter key at https://openrouter.ai/settings/keys).

## Git Control & Workflow Rules (Strict Policy)

- **Strictly No Automated Git Execution**: Never run `git add`, `git commit`, `git push`, `git checkout`, or any modifying Git commands automatically. All Git operations and version control must remain manual and executed directly by the user in their own terminal unless explicitly requested.
- **Separation of Discussion & Execution**: When the user asks questions or brainstorms, provide explanations and ideas only. Always obtain explicit confirmation with a clear implementation plan before modifying files or executing modifying commands.
- **Stability & Incremental Changes**: Never make major changes to existing core features, architecture, or layout structure arbitrarily without explicit user confirmation. All modifications must be made safely with careful consideration of before-and-after impact.
- **Workspace Path Boundaries**: Do not explore or access directories outside the project root (`C:\Users\dldms\Desktop\PromptArchive`) without explicit permission.
