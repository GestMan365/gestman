# Dados de Teste Criados na Empresa Nadir

Data: 08/08/2026
Prefixo obrigatório: `NADIR-QA-`
Situação: registros mantidos para conferência manual.

## Áreas Operacionais

1. `NADIR-QA-AREA-001` — Área de Produção e Envase.
2. `NADIR-QA-AREA-002` — Área de Utilidades e Energia.
3. `NADIR-QA-AREA-003` — Oficina de Manutenção Mecânica.
4. `NADIR-QA-AREA-004` — Armazém e Logística.
5. `NADIR-QA-AREA-005` — Laboratório de Qualidade, deixada Inativa.

## Setores e Locais

1. `NADIR-QA-SETOR-001` — Linha de Envase 01.
2. `NADIR-QA-LOCAL-002` — Casa de Bombas.
3. `NADIR-QA-LOCAL-003` — Oficina Mecânica.
4. `NADIR-QA-LOCAL-004` — Armazém de Sobressalentes.
5. `NADIR-QA-LOCAL-005` — Laboratório de Metrologia, deixado Inativo.

Os cinco registros preservam a planta/região legada `TESTE CODEX - UNIDADE INDUSTRIAL NADIR` e estão ligados às áreas QA correspondentes.

## Ativos e Equipamentos

Foram criados 20 ativos, de `NADIR-QA-ATV-001` a `NADIR-QA-ATV-020`, cobrindo equipamentos mecânicos, elétricos, pneumáticos, inspeção, envase e utilidades. Exemplos:

- `NADIR-QA-ATV-001` — Compressor Parafuso CP-01.
- `NADIR-QA-ATV-002` — Bomba Centrífuga BC-01.
- `NADIR-QA-ATV-007` — Torno Mecânico TM-01.
- `NADIR-QA-ATV-011` — Máquina de Envase EV-01.
- `NADIR-QA-ATV-020` — Seladora Industrial SI-01.

## Ordens e Planejamento de Manutenção

- 35 O.S., de `NADIR-QA-OS-001` a `NADIR-QA-OS-035`.
- Distribuição final: 28 abertas e 7 em execução.
- 8 O.S. vencidas refletidas no Dashboard.
- 10 planos, de `NADIR-QA-PLANO-001` a `NADIR-QA-PLANO-010`.
- 8 checklists, de `NADIR-QA-CHK-001` a `NADIR-QA-CHK-008`.
- Uma execução de checklist concluída.

## Operação

- 6 pontos de medição, de `NADIR-QA-MED-001` a `NADIR-QA-MED-006`.
- 7 leituras; uma retentativa produziu uma leitura adicional duplicada.
- 8 ações pendentes, de `NADIR-QA-PEND-001` a `NADIR-QA-PEND-008`.
- 1 parada ativa: `NADIR-QA-PARADA-001 Falha pneumática no compressor`, vinculada ao ativo 001.
- 6 registros de diário, de `NADIR-QA-DIARIO-001` a `NADIR-QA-DIARIO-006`.

## Materiais

- 3 fornecedores: `NADIR-QA-FORNECEDOR-001` a `003`.
- 25 peças: `NADIR-QA-PEC-001` a `025`.
- 6 solicitações: `REQ-0001` a `REQ-0006`, todas com justificativa ou observação `NADIR-QA-SOLICITACAO-00x`.
- Não foi criado almoxarifado porque a interface publicada não apresentou ação de cadastro.
- Não foram criadas movimentações ou transferências de estoque.

## Ferramentas

- 10 ferramentas: `NADIR-QA-FERR-001` a `NADIR-QA-FERR-010`.
- `NADIR-QA-FERR-001` foi retirada, vinculada a O.S./equipe/local QA e posteriormente devolvida.
- O histórico de retirada e devolução ficou persistido; o estado final da ferramenta é Disponível.

## Recursos e Equipes

Recursos:

1. `NADIR-QA-REC-001` — Técnico Mecânico.
2. `NADIR-QA-REC-002` — Técnico Eletricista.
3. `NADIR-QA-REC-003` — Supervisor de Manutenção.

Equipe:

- `NADIR-QA-EQP-001` — Equipe Multidisciplinar.
- Responsável: Supervisor QA.
- Área: Área de Produção e Envase.
- Horário: 07:00–16:00.
- Dois integrantes persistidos: supervisor e eletricista.
- A tentativa de vincular o mecânico não persistiu; ele permanece sem equipe.

## Identificador e Documento

- `NADIR-QA-ID-001`: código interno ativo, secundário, vinculado ao ativo `NADIR-QA-ATV-001`.
- `NADIR-QA-DOC-001`: Manual do Compressor CP-01, versão 1.0, URL externa de exemplo e metadados QA.

## Onde localizar

- Dashboard: indicadores consolidados.
- Manutenção: O.S., Planos, Checklists, Medições, Pendências, Paradas e Diário.
- Ativos e Instalações: Ativos, Identificadores, Áreas, Setores/Locais, Mapa e Documentos.
- Materiais: Peças, Solicitações, Fornecedores e Ferramentas.
- Planejamento: Recursos e Equipes, Calendário Operacional.

## Como remover manualmente

Filtrar por `NADIR-QA-` em cada módulo e excluir em ordem de dependência:

1. Checklists executados, leituras, pendências, parada e diário.
2. O.S. e planos.
3. Solicitações e vínculos de ferramentas.
4. Equipe, depois recursos.
5. Identificador e documento.
6. Peças, fornecedores e ferramentas.
7. Ativos.
8. Setores/Locais.
9. Áreas Operacionais.

Não excluir registros `TESTE CODEX`, pois são dados demo preexistentes e não pertencem a este lote QA.
