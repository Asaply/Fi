const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

// Replace :root block with dark and light themes
const rootRegex = /:root\s*\{[\s\S]*?\/\* ─── Card tokens[^\}]*\}/;
const newRoot = `:root {
  /* ─── Dark palette (default) ─── */
  --bg-base:           #000000;
  --bg-surface:        #000000;
  --bg-elevated:       #2a2a2a;   /* inputs */
  --bg-surface-hover:  #111111;
  --bg-hover:          #111111;
  --bg-border:         #2a2a2a;
  --bg-border-subtle:  #1f1f1f;

  --bg-primary:        var(--bg-base);
  --bg-card:           var(--bg-surface);
  --bg-card-hover:     var(--bg-surface-hover);
  --bg-subtle:         #111111;

  --border:            #2a2a2a;
  --border-subtle:     #1f1f1f;

  --accent:            #ff6600;
  --accent-hover:      #ff7a1a;
  --brand:             var(--accent);
  --brand-hover:       var(--accent-hover);
  --accent-color:      var(--accent);

  --positive:          #22c55e;
  --negative:          #ef4444;
  --warning:           #ff6600;
  --info:              #ffffff;

  --text-primary:      #ffffff;
  --text-secondary:    #d1d5db;
  --text-muted:        #9ca3af;
  --text-tertiary:     #6b7280;

  --border-color:      var(--bg-border);

  --radius-sm:         14px;
  --radius-md:         24px;
  --radius-lg:         36px;
  --radius-xl:         48px;

  --shadow-sm:         0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:         0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg:         0 8px 24px rgba(0,0,0,0.6);

  --font-mono:         var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', monospace;

  --card-padding:      1.5rem;
  --card-radius:       var(--radius-lg);
  --card-border:       1px solid var(--border);
}

[data-theme="light"] {
  --bg-base:           #ffffff;
  --bg-surface:        #ffffff;
  --bg-elevated:       #f3f4f6;   /* inputs */
  --bg-surface-hover:  #f9fafb;
  --bg-hover:          #f9fafb;
  --bg-border:         #e5e7eb;
  --bg-border-subtle:  #f3f4f6;

  --bg-primary:        var(--bg-base);
  --bg-card:           var(--bg-surface);
  --bg-card-hover:     var(--bg-surface-hover);
  --bg-subtle:         #f9fafb;

  --border:            #e5e7eb;
  --border-subtle:     #f3f4f6;

  --text-primary:      #000000;
  --text-secondary:    #374151;
  --text-muted:        #6b7280;
  --text-tertiary:     #9ca3af;

  --border-color:      var(--bg-border);
  --card-border:       1px solid var(--border);
  
  --shadow-sm:         0 1px 3px rgba(0,0,0,0.05);
  --shadow-md:         0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg:         0 8px 24px rgba(0,0,0,0.12);
}`;

css = css.replace(rootRegex, newRoot);

// Adjust body background to use CSS variables
const bodyRegex = /body\s*\{[\s\S]*?\}/;
css = css.replace(bodyRegex, `body {
  padding: 0;
  margin: 0;
  background-color: var(--bg-base);
  background-image: var(--bg-image);
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:root {
  --bg-image: radial-gradient(900px 420px at 50% -6%, rgba(255, 102, 0, 0.22), rgba(255, 102, 0, 0) 70%),
              radial-gradient(700px 320px at 82% 8%, rgba(255, 122, 26, 0.12), rgba(255, 122, 26, 0) 72%),
              linear-gradient(180deg, #040404 0%, #000000 48%, #000000 100%);
}

[data-theme="light"] {
  --bg-image: none;
}`);

// Fix Topbar background for light theme
css = css.replace('background: rgba(0, 0, 0, 0.55);', 'background: var(--bg-surface); opacity: 0.95;');

fs.writeFileSync('src/app/globals.css', css);
console.log('CSS updated successfully');
