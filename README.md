# Gestor de Obras (React Version)

O **Gestor de Obras** é uma aplicação web de alta performance para gerenciamento, orçamentação e medição de obras de engenharia civil. O sistema permite criar estruturas analíticas de projeto (EAP) com profundidade infinita, realizar medições acumuladas e calcular custos automaticamente através de uma árvore hierárquica recursiva.

Esta versão foi construída utilizando **React** e **TypeScript**, focando em tipagem estrita e performance para grandes volumes de dados.

## 🚀 Tecnologias

* **React 18+** (Interface de Usuário)
* **TypeScript** (Segurança de tipos e Intellisense)
* **Vite** (Build tool e Dev Server ultra-rápido)
* **Tailwind CSS** (Estilização utilitária)
* **Lucide React** (Ícones)
* **XLSX** (Manipulação de arquivos Excel)

## 📋 Funcionalidades Principais

* **Estrutura em Árvore (WBS/EAP):** Criação de categorias e subcategorias com numeração automática (1, 1.1, 1.1.1).
* **Cálculo Recursivo (Rollup):** Os valores das categorias "Pai" são calculados automaticamente somando os valores dos filhos, garantindo integridade matemática.
* **Gestão de Medições:**
* Controle de valor contratual.
* Medição atual vs. Acumulada.
* Cálculo automático de saldos e porcentagens.


* **Importação de Excel:** Capacidade de importar planilhas orçamentárias existentes.
* **Edição Inline:** Interface tipo planilha para edição rápida de quantidades e valores.

## 📂 Estrutura do Projeto

```bash
src/
├── components/
│   ├── ThemeEditor.tsx    # Controle de temas/visual
│   ├── TreeTable.tsx      # Componente principal de tabela hierárquica
│   └── WorkItemModal.tsx  # Modal para edição/criação de itens
├── services/
│   ├── excelService.ts    # Lógica de parsing e exportação de planilhas
│   └── treeService.ts     # Algoritmos de cálculo recursivo e "flattening" da árvore
├── utils/
│   └── math.ts            # Helpers para cálculos financeiros precisos
├── types.ts               # Definições de tipos (WorkItem, Category, etc.)
└── App.tsx                # Entry point da aplicação

```

## 🛠️ Como rodar o projeto

### Pré-requisitos

* Node.js (versão 18 ou superior)
* NPM ou Yarn

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/gestor-de-obras.git
cd gestor-de-obras

```


2. Instale as dependências:
```bash
npm install

```


3. Rode o servidor de desenvolvimento:
```bash
npm run dev

```



O projeto estará disponível em `http://localhost:5173`.

## 🧠 Decisões de Arquitetura

### State Management (Estado Plano vs Árvore)

Para otimizar a performance de renderização e simplificar o CRUD, optamos por manter o estado como uma **lista plana (Flat List)** no React.

* **Armazenamento:** Array linear de objetos com `parentId`.
* **Renderização:** Uma função no `treeService` converte essa lista plana em uma estrutura visual hierárquica apenas no momento do render, calculando indentação e totais em tempo real.

### Precisão Numérica

Devido aos problemas de ponto flutuante do JavaScript (`0.1 + 0.2 !== 0.3`), todos os cálculos monetários são tratados com funções utilitárias em `src/utils/math.ts` para garantir precisão de centavos.

## 🤝 Contribuição

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/NovaFeature`)
3. Faça o Commit (`git commit -m 'Add some NovaFeature'`)
4. Push para a Branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

---

**Licença:** MIT
