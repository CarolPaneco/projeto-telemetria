# Telemetria Agrícola

Arquitetura modular inicial com Colhedora, Tratos, Plantadora e Bases compartilhadas.

## Bases compartilhadas
- Blocos
- Produtividade de cana
- Chuva
- Telemetria incremental por equipamento (Colhedora e Tratos)

## Telemetria incremental
Os arquivos de telemetria são armazenados no IndexedDB do navegador, separados por equipamento e arquivo/data. Novos arquivos podem ser adicionados diariamente sem apagar os anteriores.

A análise da Colhedora e de Tratos seleciona o período e usa os arquivos armazenados na página Bases.

## Rodar no Codespaces
```bash
python3 -m http.server 8000 --bind 0.0.0.0
```
Depois abra a porta 8000.

## Estrutura
```text
projeto_telemetria/
├── index.html
├── assets/
│   ├── bases.js
│   ├── menu.css
│   ├── menu.js
│   └── telemetria-base.js
└── pages/
    ├── bases.html
    ├── colhedora.html
    ├── plantadora.html
    └── tratos.html
```
