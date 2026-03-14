# Tool Usage Notes

## Desktop Tools

- `open_app` — opens an app by name (must be in whitelist in config.json)
- `open_url` — opens a URL in the default browser (must be in domain whitelist)
- `open_file` — opens a file with its default program
- `open_folder` — opens a folder in File Explorer
- `take_screenshot` — captures screen, saves to userData/screenshots/
- `send_notification` — sends a system desktop notification
- `get_system_info` — returns OS, CPU, memory, screen info (read-only)

## Whitelist Configuration

To allow apps and domains, edit `config.json`:

```json
"tools": {
  "whitelist": {
    "apps": [{ "name": "Notepad", "path": "C:/Windows/System32/notepad.exe" }],
    "domains": ["github.com", "google.com"]
  }
}
```
