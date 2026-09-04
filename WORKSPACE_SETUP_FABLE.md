# Fable 5.1 Workspace Setup Guide

## Prerequisites
- .NET SDK 6.0 or higher
- Node.js (v16+) for tooling
- Git installed
- Your preferred code editor (VS Code with Ionide, Visual Studio, etc.)

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/w2171456-del/Coding.git
cd Coding
```

### 2. Install Dependencies

#### For .NET/F# Projects
```bash
# Restore NuGet packages
dotnet restore

# Install Fable
dotnet tool install -g fable
```

#### For Node.js/JavaScript Output
```bash
npm install
```

### 3. Configure Your Environment
```bash
cp .env.example .env
```

### 4. Run the Application

#### Development Mode
```bash
# Watch mode with Fable compilation
fable watch --run "npm start"
```

#### Build for Production
```bash
dotnet publish -c Release
```

## Fable 5.1 Specific Setup

### Project Structure
```
Coding/
├── src/
│   ├── *.fs              # F# source files
│   └── fable_modules/    # Compiled Fable output
├── webpack.config.js     # Webpack configuration
├── package.json          # Node.js dependencies
├── paket.lock           # NuGet/Paket dependencies
├── .fablerc.json        # Fable configuration
└── tsconfig.json        # TypeScript/JavaScript config
```

### Fable Configuration (.fablerc.json)
```json
{
  "outDir": "fable_modules",
  "jsx": "react"
}
```

### Common Commands

| Command | Purpose |
|---------|---------|
| `fable build` | Compile F# to JavaScript |
| `fable watch` | Watch files and recompile |
| `dotnet test` | Run unit tests |
| `npm start` | Start dev server |
| `npm run build` | Build for production |

## Development Workflow

### Branch Strategy
- `main` - Production branch
- `develop` - Development branch
- Feature branches: `feature/your-feature-name`

### Making Changes
1. Create a feature branch from `develop`
2. Write F# code or edit existing files
3. Fable automatically compiles to JavaScript
4. Test locally with `npm start`
5. Submit a pull request

## Useful Resources

- [Fable Documentation](https://fable.io/docs/)
- [F# Language Guide](https://docs.microsoft.com/en-us/dotnet/fsharp/)
- [Fable REPL](https://fable.io/repl/)
- [.NET Documentation](https://docs.microsoft.com/en-us/dotnet/)

## Troubleshooting

### Fable Not Found
```bash
# Reinstall Fable globally
dotnet tool uninstall -g fable
dotnet tool install -g fable
```

### NuGet Package Issues
```bash
# Clear NuGet cache
dotnet nuget locals all --clear

# Restore packages
dotnet restore
```

### JavaScript Output Not Updating
```bash
# Clean and rebuild
rm -rf fable_modules
fable build
```

## Need Help?
- Check the README.md for project-specific info
- Review Fable documentation at https://fable.io
- Open an issue on GitHub if you encounter problems
