import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const sourceRoot = new URL('../src/', import.meta.url);
const sourceStyles = new URL('../styles-vite.css', import.meta.url);
const failures = [];

async function collectVueFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await collectVueFiles(path));
        if (entry.isFile() && extname(entry.name) === '.vue') files.push(path);
    }

    return files;
}

function record(file, line, message) {
    failures.push(`${relative(root.pathname, file)}:${line}: ${message}`);
}

function auditCss(file, css, startLine = 1) {
    const lines = css.split('\n');

    lines.forEach((line, index) => {
        const lineNumber = startLine + index;
        const declaration = line.trim();

        if (/^font-family\s*:/.test(declaration) && !declaration.includes('var(--journalyst-type-font-')) {
            record(file, lineNumber, 'use a semantic --journalyst-type-font-* token');
        }
        if (/^font-size\s*:/.test(declaration) && !declaration.includes('var(--journalyst-type-size-')) {
            record(file, lineNumber, 'use a semantic --journalyst-type-size-* token');
        }
        if (/^font-weight\s*:/.test(declaration) && !declaration.includes('var(--journalyst-type-weight-')) {
            record(file, lineNumber, 'use a semantic --journalyst-type-weight-* token');
        }
        if (/^line-height\s*:/.test(declaration) && !declaration.includes('var(--journalyst-type-line-')) {
            record(file, lineNumber, 'use a semantic --journalyst-type-line-* token');
        }
        if (/^letter-spacing\s*:/.test(declaration) && !/^letter-spacing\s*:\s*0\s*;?$/.test(declaration)) {
            record(file, lineNumber, 'letter spacing must remain zero');
        }
        if (/^text-transform\s*:\s*uppercase/.test(declaration)) {
            const selector = lines.slice(Math.max(0, index - 8), index).join('\n');
            if (!file.endsWith('styles-vite.css') || !selector.includes('.journalyst-type-label')) {
                record(file, lineNumber, 'use the shared .journalyst-type-label role for uppercase text');
            }
        }
    });
}

const vueFiles = await collectVueFiles(sourceRoot.pathname);
for (const file of vueFiles) {
    const content = await readFile(file, 'utf8');
    const stylePattern = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g;
    let match;
    while ((match = stylePattern.exec(content)) !== null) {
        const startLine = content.slice(0, match.index).split('\n').length;
        auditCss(file, match[1], startLine);
    }
}

auditCss(sourceStyles.pathname, await readFile(sourceStyles, 'utf8'));

if (failures.length > 0) {
    console.error('Journalyst typography check failed:\n');
    console.error(failures.map(failure => `- ${failure}`).join('\n'));
    process.exitCode = 1;
} else {
    console.log('Journalyst typography check passed.');
}
