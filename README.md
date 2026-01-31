
# ProMeasure Pro - Gestão Profissional de Medições de Obras

O **ProMeasure Pro** é uma aplicação de nível SaaS desenvolvida para engenheiros e gestores de obras que necessitam de rigor matemático, controle hierárquico (EAP/WBS) e relatórios institucionais. O sistema permite o acompanhamento físico-financeiro detalhado, desde a importação do orçamento até a geração de boletins de medição para assinatura.

## 🚀 Funcionalidades Principais

- **Hierarquia EAP Dinâmica:** Estrutura de árvore multinível com renumeração automática de WBS (ex: 1.1, 1.1.1, 1.2).
- **Rollups Financeiros Recursivos:** Cálculos automáticos de totais que fluem dos itens de serviço para as categorias superiores em tempo real.
- **Drag-and-Drop Hierárquico:** Reorganização intuitiva da estrutura da obra mantendo a integridade dos cálculos.
- **Gestão de BDI:** Aplicação de taxas de Benefícios e Despesas Indiretas com cálculo reverso e atualização em cascata.
- **Importação/Exportação Excel:** Motor de processamento robusto para migração de dados via planilhas XLSX.
- **Histórico de Medições (Snapshots):** Sistema de congelamento de períodos para auditoria e acompanhamento de evolução física.
- **Impressão Profissional:** Layout otimizado para papel A4 em modo paisagem, incluindo cabeçalhos institucionais e campos de assinatura.
- **Interface SaaS Moderna:** Suporte nativo a Modo Escuro (Dark Mode) e design responsivo.

## 🛠️ Stack Tecnológica

- **Core:** [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Ícones:** [Lucide React](https://lucide.dev/)
- **Processamento de Dados:** [SheetJS (XLSX)](https://sheetjs.com/)
- **Validação:** [Zod](https://zod.dev/)
- **Interatividade:** [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) (Drag and Drop)

## 📂 Arquitetura do Sistema

O projeto segue princípios de **Clean Architecture** e separação de responsabilidades:

- `/services`: Lógica de negócio pesada (Serviço de Árvore e Excel).
- `/components`: Componentes de UI modulares e reutilizáveis.
- `/hooks`: Gerenciamento de estado complexo e persistência (Undo/Redo, LocalStorage).
- `/utils`: Utilitários matemáticos para precisão financeira (evitando erros de ponto flutuante).

## 📥 Instalação e Execução

Como o projeto utiliza módulos ES6 nativos e importmaps para máxima compatibilidade e performance sem a necessidade de um bundler complexo no desenvolvimento inicial, siga os passos abaixo:

### Requisitos
- Um servidor web local (devido às restrições de CORS para módulos ES6).

### Passo a Passo

1. **Clonar/Baixar o projeto:**
   Certifique-se de que todos os arquivos (`index.html`, `index.tsx`, `App.tsx`, etc.) estejam na mesma pasta raiz.

2. **Executar um servidor local:**
   Você pode usar qualquer servidor estático. Exemplos comuns:

   **Usando Node.js (npx):**
   ```bash
   npx serve .
   ```
   **Usando Python:**
   ```bash
   python -m http.server 8000
   ```
   **Usando VS Code:**
   Instale a extensão "Live Server" e clique em "Go Live".

3. **Acessar a aplicação:**
   Abra o navegador e acesse `http://localhost:3000` (ou a porta indicada pelo seu servidor).

## 📝 Notas de Uso

1. **Importação:** Para importar dados, use o botão "Template" para baixar o modelo correto. O sistema possui uma heurística que tenta identificar colunas mesmo em planilhas customizadas.
2. **Persistência:** Os dados são salvos automaticamente no `localStorage` do navegador. Para produção, recomenda-se a integração com o banco de dados PostgreSQL conforme sugerido no `architecture.md`.
3. **Impressão:** Use o atalho `Ctrl + P` ou o ícone de impressora na interface. O sistema ocultará automaticamente os elementos de UI e formatará a tabela para o padrão A4 de engenharia.

---
**Desenvolvido com foco em alta performance e experiência do usuário (DX/UX).**
