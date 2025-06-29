# CEP

## Requirements

- Git
- Go 1.21+ (macOS 15+ requires Go 1.23.3+)
- PNPM (Node 15+)
- Wails CLI
- GCC Compiler
- Docker

## Getting Started

### Setup

1. `git clone https://github.com/clydewilmoth/cep.git`
2. `cd mssql`
3. `docker compose up -d` (MSSQL Database Container)

### Default Database Login

- Host: localhost
- Port: 1433
- Database: test
- User: sa
- Password: 123StrongPassword!
- Encrypted: true
- Trust Server: true

### Build

1. `wails build`
2. Portable Build: build/bin/. after completion

### Developer Mode

1. `wails dev`
2. Developer Mode (supporting live changes) opens after completion
