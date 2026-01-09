// apply-react-hooks-shim.js
// Idempotent script to patch eslint-plugin-react-hooks runtime file to
// provide compatibility for environments where RuleContext lacks
// context.getSource(). Adds a small helper and replaces calls to
// context.getSource(...) with getSourceTextFromContext(context,...).

const fs = require('fs');
const path = require('path');

function log(...args) { console.log('[apply-react-hooks-shim]', ...args); }

function run() {
  // Try both development and production builds inside the package
  const candidates = [
    'eslint-plugin-react-hooks/cjs/eslint-plugin-react-hooks.development.js',
    'eslint-plugin-react-hooks/cjs/eslint-plugin-react-hooks.production.min.js'
  ];

  const helper = `\n// Compatibility helper inserted by project (apply-react-hooks-shim.js)\nfunction getSourceTextFromContext(context, node) {\n  try {\n    if (typeof context.getSource === 'function') return context.getSource(node);\n    const sc = context.getSourceCode && context.getSourceCode();\n    if (sc && typeof sc.getText === 'function') return sc.getText(node);\n  } catch (e) { /* swallow */ }\n  return '';\n}\n`;

  for (const rel of candidates) {
    let target;
    try {
      target = require.resolve(rel);
    } catch (err) {
      target = path.join(__dirname, '..', 'node_modules', rel);
    }

    if (!fs.existsSync(target)) {
      log('Not found:', target);
      continue;
    }

    let src = fs.readFileSync(target, 'utf8');
    const hasHelper = src.includes('function getSourceTextFromContext(');
    if (hasHelper) {
      // If helper already present, check if any .getSource( occurrences remain that need conversion
      const remaining = /[A-Za-z0-9_$]\.(?:getSource)\s*\(/.test(src);
      if (!remaining) {
        log('Shim already fully applied in', rel);
        continue;
      }
      log('Helper present but found remaining .getSource( patterns in', rel, '- applying replacement pass');
    }

    // Insert helper after 'use strict' if possible
    const needle = "'use strict';\n\n";
    const idx = src.indexOf(needle);
    let patched = src;
    if (idx !== -1) {
      const insertAt = idx + needle.length;
      patched = src.slice(0, insertAt) + helper + src.slice(insertAt);
    } else {
      patched = helper + src;
    }

  // Replace occurrences of context.getSource( with getSourceTextFromContext(context,
  patched = patched.replace(/context\.getSource\s*\(/g, 'getSourceTextFromContext(context,');
  // Also replace minified patterns like a.getSource( or anyIdentifier.getSource(
  // with getSourceTextFromContext(identifier,
  patched = patched.replace(/([A-Za-z0-9_$])\.getSource\s*\(/g, 'getSourceTextFromContext($1,');

    try {
      fs.writeFileSync(target, patched, 'utf8');
      log('Patched', rel);
    } catch (err) {
      log('Failed to write patched file:', target, err);
      process.exitCode = 1;
    }
  }
}

run();
