# UTF-8 Editing Guide

To keep Norwegian letters (æøå) and emoji intact, always save files in UTF-8. Follow these rules:

- **In VS Code**: check the status bar encoding. If it is not `UTF-8`, click it → *Save with Encoding…* → choose `UTF-8`. VS Code will remember this per file.
- **In PowerShell**: when writing files, always specify the encoding, e.g.
  ```powershell
  Set-Content -Path <file> -Value $content -Encoding utf8
  ```
  or
  ```powershell
  "text" | Out-File <file> -Encoding utf8
  ```
  Avoid bare `>` redirects or `Set-Content` without `-Encoding`, because older versions default to ASCII.
- **Optional safety**: run `chcp 65001` at the start of a shell session so the console uses UTF-8.
- **For icons**: using HTML entities like `&#x25BC;` for ▼ is a fallback when UTF-8 isn’t available.

Stick to these steps and the repo keeps its special characters healthy.
