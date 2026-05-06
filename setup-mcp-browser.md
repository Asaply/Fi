# Setup: Browser MCP para Claude Code

Esto le da a Claude Code acceso a Chrome con localhost:3005, igual que el browser MCP en claude.ai.

---

## Opción recomendada: Chrome DevTools MCP (oficial de Google)

### 1. Instalar el plugin desde Claude Code

Abre Claude Code en el terminal dentro del proyecto y corre:

```
/plugin marketplace add ChromeDevTools/chrome-devtools-mcp
```

Luego reinicia Claude Code. Verifica con `/skills` que aparezca el plugin.

---

### Opción alternativa: config manual

Si el marketplace no funciona, agrega esto a `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  },
  "claudeInChromeDefaultEnabled": true
}
```

---

### 2. Lanzar Chrome con remote debugging

Cada vez que trabajes en FNCE, abre Chrome así (cierra el Chrome normal primero):

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-dev \
  http://localhost:3005
```

O agrega un alias en tu `~/.zshrc`:
```bash
alias fnce-chrome='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-dev http://localhost:3005'
```

---

### 3. Workflow de sesión completo

Terminal 1 — dev server:
```bash
cd ~/Documents/FNCE.md
npm run dev
```

Terminal 2 — Chrome con debugging:
```bash
fnce-chrome
```

Terminal 3 — Claude Code:
```bash
cd ~/Documents/FNCE.md
claude
```

Dentro de Claude Code, simplemente di:
```
Lee CLAUDE.md y TASKS.md, luego implementa todas las tareas pendientes en orden.
```

Claude Code verá el browser, los archivos y los logs del server en tiempo real.

---

## Verificar que funciona

Dentro de una sesión de Claude Code, pide:
```
Toma un screenshot de localhost:3005
```

Si ves la app, el setup está completo.
