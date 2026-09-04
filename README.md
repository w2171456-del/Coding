# Fable 5.1 Coding Project

A modern F# web development project using Fable 5.1, which compiles F# code to JavaScript.

## Quick Start

```bash
# Install dependencies
npm install
dotnet restore

# Start development server
fable watch --run "npm start"
```

## Technologies

- **Fable 5.1** - F# to JavaScript compiler
- **F#** - Functional programming language
- **Webpack** - Module bundler
- **React** - (optional) UI library
- **.NET 6.0+** - Development framework

## Project Structure

```
Coding/
├── src/              # F# source files
├── public/           # Static files (HTML, etc.)
├── dist/             # Compiled output
└── fable_modules/    # Fable compilation output
```

## Available Scripts

- `npm start` - Start development server (port 8080)
- `npm run build` - Build for production
- `dotnet test` - Run tests
- `fable watch` - Watch F# files for changes

## Documentation

See `WORKSPACE_SETUP_FABLE.md` for detailed setup instructions.

## License

MIT
