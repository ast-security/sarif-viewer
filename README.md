# SARIF Viewer

A CLI tool to view and convert SARIF (Static Analysis Results Interchange Format) files to terminal output or interactive HTML reports.

## Features

- **Terminal Output**: View SARIF results in the terminal with color-coded severity levels (error, warning, note)
- **Interactive HTML**: Generate a single-file HTML report with sidebar navigation, search, and expandable details
- **Dark Mode**: Supported in both terminal (--no-color) and HTML (--dark)
- **Filtering**: Filter results by severity, rule ID, file path, or search query
- **Zero Dependencies**: Runs anywhere Node.js is available

## Installation

```bash
# Clone the repository
git clone https://github.com/<username>/sarif-viewer.git
cd sarif-viewer

# Install dependencies
npm install

# Link globally (optional)
npm link
```

## Usage

### Terminal Output

```bash
# Basic usage
sarif-viewer path/to/report.sarif.json

# Using npx without installation
npx tsx src/cli.ts path/to/report.sarif.json

# With flags
sarif-viewer path/to/report.sarif.json --no-color   # No ANSI colors
sarif-viewer path/to/report.sarif.json --level error # Only errors
sarif-viewer path/to/report.sarif.json --rule TS-001 # Specific rule
sarif-viewer path/to/report.sarif.json --file src/main.ts # Filter by file
sarif-viewer path/to/report.sarif.json --search "unused"  # Search results
```

### HTML Report

```bash
# Generate HTML report
sarif-viewer html path/to/report.sarif.json

# Save to custom path
sarif-viewer html path/to/report.sarif.json -o output/report.html

# Dark theme
sarif-viewer html path/to/report.sarif.json --dark

# Both together
sarif-viewer html path/to/report.sarif.json -o dark-report.html --dark
```

### HTML Report Features

The generated HTML file is a self-contained single-file application with:

- **Sidebar Navigation**: Filter by severity (errors, warnings, notes), rule, or file
- **Search**: Real-time search across messages, rule IDs, and file paths
- **Expandable Details**: Click any result to see full description, location, code snippets, and fixes
- **Sorting**: Sort by severity, file, or rule from the main view
- **Dark/Light Theme**: Toggle between themes with the "Toggle Theme" button
- **Stats**: Quick overview of error, warning, and note counts in the navbar
- **Zero Dependencies**: No external libraries, fonts, or CDN requests

## Examples

### Terminal Output

```
tslint v7.0.0

Summary
  Errors:   3
  Warnings: 4
  Notes:    1
  Total:    8

Results (By severity)
─────────────────────────────────────────────────────────────────────────────────────
Level: error
──────────────────────────────────────────────────────────────────────

  [X] [no-var-redeclare] Variable 'config' has already been declared.
  src/config.ts:3:1

  [X] [no-debugger] Unexpected debugger statement.
  src/debug.ts:8:5
  ...
```

### Generated HTML Report

The HTML report opens in your browser with:

- A dark navbar with tool name, version, search bar, and severity stats
- Sidebar with three filter groups: By Severity, By Rule, By File
- Sort buttons in the main area: Severity | File | Rule
- Click any result to expand and see details:
  - Description
  - Rule information
  - File location with line/column
  - Code snippet (if available)
  - Fix suggestions

## Development

### Project Structure

```
src/
├── cli.ts           # CLI entry point (commander)
├── sarif/
│   ├── types.ts     # Parsed data TypeScript interfaces
│   ├── parser.ts    # SARIF JSON parser for v2.1.0
│   └── utils.ts     # Sort, filter, group utilities
├── renderers/
│   ├── types.ts     # Renderer type definitions
│   ├── text.ts      # Terminal text renderer
│   ├── html.ts      # HTML report generator
│   └── render.js    # Client-side interactivity
├── templates/       # Static assets
└── test/
    └── all.test.ts  # Unit tests
```

### Commands

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run lint

# Run with tsx (no build needed)
npx tsx src/cli.ts examples/sample.sarif.json

# Generate HTML report
npx tsx src/cli.ts html examples/sample.sarif.json
```

### Adding SARIF Support

The parser handles all SARIF v2.1.0 features:
- Tool information and rule definitions
- Result messages and severity levels
- File locations with line/column numbers
- Code snippets
- Fix suggestions
- Occurrence counts
- Code flows (usage information)

## Tech Stack

- **TypeScript** for type safety
- **Commander** for CLI interface
- **Chalk** for terminal colors
- **SARIF types** from Microsoft
- **Vitest** for testing
- **TSX** for fast execution (no separate build step)

## Requirements

- Node.js 18+
- npm or yarn

## License

MIT
