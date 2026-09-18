# Central de Telemetria Agrícola

Arquitetura inicial para os módulos de Colhedora, Tratos, Plantadora e Bases.

## Estrutura
- `index.html` — entrada, abre o módulo Colhedora.
- `pages/colhedora.html` — módulo existente de Colhedora, com a lógica preservada.
- `pages/tratos.html` — novo módulo de Tratos, com a mesma estrutura de ocorrências, mapas, filtros, insights e PDF; parâmetros: velocidade mínima, duração mínima e gap máximo.
- `pages/plantadora.html` — placeholder para a próxima etapa.
- `pages/bases.html` — área reservada para blocos, produtividade e chuva.
- `assets/menu.css` e `assets/menu.js` — menu lateral compartilhado.

## Rodar no Codespace
No terminal, dentro desta pasta, execute:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Depois abra a porta 8000 encaminhada pelo Codespaces.

## Observação
Colhedora e Tratos compartilham o mesmo IndexedDB de telemetria e das bases já existentes. O Tratos não exige a coluna de pressão de corte.
