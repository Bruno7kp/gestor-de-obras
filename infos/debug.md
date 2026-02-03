# DEBUG - Erro "h is not a function"

## Passos para Identificar o Problema

### 1. Limpar o LocalStorage
O erro pode estar relacionado a dados corrompidos. Abra o console do navegador e execute:

```javascript
localStorage.removeItem('promeasure_v4_data');
localStorage.removeItem('promeasure_theme');
location.reload();
```

### 2. Verificar se o erro persiste após limpar cache
- Pressione `Ctrl + Shift + R` (ou `Cmd + Shift + R` no Mac) para fazer hard reload
- Ou vá em DevTools > Network > Marcar "Disable cache"

### 3. Adicionar Console Logs Temporários

Se o problema persistir, adicione logs no `App.tsx`:

```typescript
const App: React.FC = () => {
  const hookResult = useProjectState();
  
  // DEBUG: Verificar o que está sendo retornado
  console.log('Hook Result:', hookResult);
  console.log('updateProjects type:', typeof hookResult.updateProjects);
  console.log('updateGroups type:', typeof hookResult.updateGroups);
  
  const { 
    projects, biddings, groups, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings,
    updateActiveProject, updateProjects, updateGroups, updateBiddings, updateCertificates, bulkUpdate
  } = hookResult;
  
  // ... resto do código
}
```

### 4. Verificar se todas as funções existem

No console do navegador, após a página carregar, execute:

```javascript
// Isso deve mostrar se as funções estão definidas
console.log('Functions check:', {
  updateProjects: typeof window.__APP_updateProjects,
  updateGroups: typeof window.__APP_updateGroups,
});
```

### 5. Build Local para Testar

Execute localmente para ver o erro não-minificado:

```bash
# Instalar dependências
npm install

# Rodar em modo dev (não minificado)
npm run dev

# Ou fazer build e testar o preview
npm run build
npm run preview
```

### 6. Verificar Ordem de Importação

O erro pode ser causado por importações circulares. Verifique se não há:
- `types.ts` importando de `services`
- `services` importando de `components`
- `components` importando de forma circular

### 7. Checar Versões de Dependências

Verifique se as versões no `package.json` estão corretas:

```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "lucide-react": "0.460.0",
    "xlsx": "0.18.5",
    "zod": "3.23.8",
    "@hello-pangea/dnd": "17.0.0"
  }
}
```

### 8. Rollback para Versão Anterior

Se tudo falhar, você pode tentar fazer rollback no Vercel para um deploy anterior que funcionava.

## Possíveis Causas

1. **LocalStorage corrompido** - dados antigos incompatíveis
2. **Cache do navegador** - JavaScript antigo sendo servido
3. **Build minificado** - problema só aparece em produção
4. **Importações circulares** - módulos se importando mutuamente
5. **TypeScript/Babel transpilation** - problema na compilação
6. **React hooks instáveis** - funções sendo recriadas em cada render

## Solução Rápida (Workaround)

Se nada funcionar, você pode adicionar validação defensiva no Sidebar:

```typescript
<button 
  onClick={() => {
    if (typeof onCreateProject === 'function') {
      onCreateProject(null);
    } else {
      console.error('onCreateProject is not a function:', typeof onCreateProject);
    }
  }} 
  className="..."
>
  <PlusCircle size={16}/>
</button>
```

## Próximos Passos Recomendados

1. Limpar localStorage
2. Fazer hard reload (Ctrl+Shift+R)
3. Testar localmente com `npm run dev`
4. Se funcionar local, fazer novo deploy no Vercel
5. Se não funcionar, adicionar console.logs e investigar