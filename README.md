# CEP

## Requirements

- Go 1.21+ (macOS 15+ requires Go 1.23.3+)
- PNPM (Node 15+)
- Wails CLI

## Getting Started

### Setup
Step 1. and 2. only needed if contributing to the project 
1. `git config --global core.autocrlf false`
2. `git config --global core.eol crlf`
3. `git clone https://github.com/clydewilmoth/cep.git`
4. `cd frontend`
5. `pnpm install`
6. `cd ..`

### Build

1. `wails build`
2. Portable Build: build/bin/. after completion

### Developer Mode

1. `wails dev`
2. Developer Mode (supporting live changes) opens after completion
3. Web Developer Mode opens on http://localhost:34115
