# Journalyst Typography

Journalyst uses Obsidian's interface typography. It does not bundle a font, scale text from the viewport, or alter the user's theme-level type choices. The semantic tokens in `styles-vite.css` are the source of truth for every Journalyst UI surface.

## Principles

- Inherit `--font-interface` for plugin UI and use `--font-monospace` only for paths, template variables, formats, and code values. Native Markdown previews use `--font-text` through the dedicated Markdown token.
- Choose a role by meaning, not by the size that happens to look right in one component.
- Keep headings and titles in natural casing. Uppercase is reserved for short labels, eyebrows, metric labels, and statuses.
- Keep letter spacing at `0`. Do not compress headings or labels with negative tracking.
- Let descriptions and validation messages wrap. Truncate only names, paths, and metadata placed in fixed-width layouts.
- Use the compact measure for dense guidance and the readable measure for longer prose.

## Semantic Roles

| Role | Class | Intended use |
| --- | --- | --- |
| Page title | `.journalyst-type-page-title` | The single visible page heading |
| Context title | `.journalyst-type-context-title` | Selected journal or date context |
| Section title | `.journalyst-type-section-title` | Major workspace sections |
| Card title | `.journalyst-type-card-title` | Journal, synthesis, lookback, and chart cards |
| Row title | `.journalyst-type-row-title` | Setting rows and nested controls |
| Body | `.journalyst-type-body` | Primary interface copy |
| Supporting | `.journalyst-type-supporting` | Descriptions and guidance |
| Label | `.journalyst-type-label` | Uppercase eyebrow and metric labels |
| Metadata | `.journalyst-type-metadata` | Dates, paths, counts, and secondary facts |
| Status | `.journalyst-type-status` | Compact state badges |
| Large metric | `.journalyst-type-metric-large` | Primary summary values |
| Medium metric | `.journalyst-type-metric-medium` | Secondary summary values and period markers |
| Control | `.journalyst-type-control` | Inputs, selects, segmented controls, and buttons |
| Code | `.journalyst-type-code` | Paths, variables, formats, and code values |
| Prose | `.journalyst-type-prose` | Readable previews and longer explanatory copy |

Components may use the matching `--journalyst-type-size-*`, `--journalyst-type-weight-*`, and `--journalyst-type-line-*` tokens when a selector already owns layout or color. Shared primitives should own the typography of their content so callers do not repeat it.

## Hierarchy

- Use one `h1` per workspace. A visually hidden `h1` is appropriate when the visible page title was intentionally removed.
- Use `h2` for major workspace sections and `h3` for cards, setting blocks, and nested groups.
- Do not choose a heading level for its appearance. Apply the semantic class or tokens separately.
- Native Markdown previews keep Obsidian's Markdown typography and are not restyled as Journalyst interface prose.

## Color And Flow

- Titles use `--text-normal`.
- Supporting copy uses `--text-muted`; metadata may use `--text-faint` when contrast remains sufficient.
- Semantic statuses use Obsidian's success, warning, error, or accent text variables.
- Metrics use stable line-height tokens and must not resize their containers when values wrap.
- Journal names and paths can use ellipsis in fixed tracks. Descriptions, errors, and preview prose use normal wrapping and an appropriate text measure.

## Use This, Not That

```css
/* Use a semantic role token inside an existing component selector. */
.journal-card h3 {
    font-size: var(--journalyst-type-size-card-title);
    font-weight: var(--journalyst-type-weight-card-title);
    line-height: var(--journalyst-type-line-tight);
}

/* Do not introduce a one-off visual value. */
.journal-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
}
```

```html
<!-- Use the shared label role for intentional uppercase metadata. -->
<dt class="journalyst-type-label">Current streak</dt>

<!-- Keep ordinary headings naturally cased. -->
<h2 class="journalyst-type-section-title">Needs attention today</h2>
```

The dependency-free typography check runs as part of `npm run check`. It rejects component-local font families and sizes, numeric weights and line heights, nonzero letter spacing, and local uppercase transforms so future additions extend this system instead of bypassing it.
