# Canteiro Digital v0.5
### High-Precision Engineering Measurement & Lifecycle Management Platform

O **Canteiro Digital** é uma plataforma de classe empresarial (SaaS-ready) projetada para suprir a lacuna entre o orçamento teórico e a execução física em obras de infraestrutura e edificações de alta complexidade. 

Diferente de planilhas convencionais, o sistema implementa um **Motor de Cálculo Hierárquico Relacional**, garantindo integridade matemática absoluta em estruturas analíticas (EAP) multiníveis.

---

## 🏗️ Core Pillars & Business Logic

### 1. Motor de EAP Dinâmico (WBS Engine)
*   **Hierarquia Recursiva:** Implementação de árvore virtual que gera automaticamente a numeração de itens (ex: 1.1.2.1) e propaga alterações de ordem via Drag-and-Drop sem perda de referência.
*   **Column Focus:** Recentemente otimizado para o padrão brasileiro de orçamentação, utilizando a nomenclatura de coluna `ITEM` (antigo WBS) e rastreabilidade de procedência via coluna `FONTE` (SINAPI, SBC, Próprio, etc).

### 2. Rollups Financeiros de Alta Precisão
*   **Cascateamento Automático:** Valores medidos na "folha" (item de serviço) são somados recursivamente para as categorias superiores em tempo real.
*   **Gestão de BDI (Benefícios e Despesas Indiretas):** Aplicação de taxas customizáveis por projeto com recálculo instantâneo de preços unitários e totais contratuais.
*   **Prevenção de Erros de Ponto Flutuante:** Utilização de utilitários de arredondamento financeiro (`DecimalSafe`) para garantir que 0.1 + 0.2 seja exatamente 0.3 no fechamento da medição.

### 3. Compliance & Governança (Auditoria)
*   **Snapshots de Medição:** Sistema de "Time Machine" que congela o estado da obra em cada fechamento, permitindo auditoria retroativa de qualquer período anterior.
*   **Diário de Obra Automatizado:** Engine de logs que gera registros de auditoria automáticos quando itens atingem 100% ou quando gastos superam limites críticos de sensibilidade financeira.

### 4. Ciclo de Vida de Licitações (Bidding)
*   **Pipeline de Propostas:** Gestão de editais desde a prospecção até a conversão em obra ativa.
*   **Compliance Documental:** Monitoramento de validade de certidões negativas e documentos de habilitação com alertas visuais de criticidade.

---

## 🛠️ Stack Tecnológica & Arquitetura

*   **Frontend:** React 18+ com **TypeScript Strict Mode** para eliminação de erros em tempo de compilação.
*   **State Management:** Hooks customizados com persistência em `localStorage` (Arquitetura orientada a migração rápida para API REST/PostgreSQL).
*   **Data Processing:** Engine [SheetJS](https://sheetjs.com/) para parsing heurístico de planilhas Excel.
*   **UI/UX:** Tailwind CSS com suporte a **Institutional Dark Mode** e layout de impressão otimizado para normas de engenharia (A4 Paisagem).

---

## 📐 Decisões de Engenharia (Architect's Note)

O sistema utiliza uma **Representação Flattened** no armazenamento para performance de escrita, mas reconstrói uma **Virtual Tree** em memória para todos os cálculos de rollup. Isso permite que a interface renderize milhares de itens com performance O(n) enquanto mantém a lógica de negócio complexa isolada na camada de serviço (`treeService.ts`).

### Estrutura de Pastas (Clean Architecture)
*   `/services`: Single Source of Truth para lógica de negócio (EAP, Finanças, Excel).
*   `/hooks`: Abstração de persistência e estados globais.
*   `/utils`: Utilitários matemáticos e formatadores de locale.
*   `/components`: UI Components atômicos e Views complexas.

---

## 🚀 Deployment & Instalação

A aplicação foi desenhada para ser executada como um módulo ES6 nativo, eliminando a necessidade de builders complexos para prototipagem rápida, mas mantendo total compatibilidade com ambientes de CI/CD modernos.

1.  Clone o repositório.
2.  Inicie um servidor estático na raiz (ex: `npx serve .` ou Live Server).
3.  Acesse `http://localhost:3000`.

*Para produção, consulte o arquivo `deployment.md` para configurações de Docker e instâncias gerenciadas de banco de dados.*

---
**Desenvolvido com rigor técnico para profissionais que não aceitam margem de erro.**