/**
 * Bootstrap Script - Limpa dados corrompidos do localStorage
 * Este arquivo deve ser importado ANTES do App.tsx no index.tsx
 */

const STORAGE_VERSION = '4.1'; // Incrementar quando houver breaking changes
const VERSION_KEY = 'promeasure_storage_version';

export const initializeApp = () => {
  const currentVersion = localStorage.getItem(VERSION_KEY);
  
  // Se a versão não existe ou é diferente, limpar dados
  if (currentVersion !== STORAGE_VERSION) {
    console.log('Detectada mudança de versão. Limpando localStorage...');
    
    // Backup do tema se existir
    const theme = localStorage.getItem('promeasure_theme');
    
    // Limpar tudo relacionado ao ProMeasure
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('promeasure_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Restaurar tema
    if (theme) {
      localStorage.setItem('promeasure_theme', theme);
    }
    
    // Definir nova versão
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
    
    console.log('localStorage limpo. Nova versão:', STORAGE_VERSION);
  }
  
  // Validar estrutura de dados existente
  try {
    const data = localStorage.getItem('promeasure_v4_data');
    if (data) {
      const parsed = JSON.parse(data);
      
      // Validar estrutura básica
      if (!parsed.projects || !Array.isArray(parsed.projects)) {
        console.warn('Estrutura de dados inválida detectada. Resetando...');
        localStorage.removeItem('promeasure_v4_data');
      }
      
      if (!parsed.globalSettings) {
        console.warn('globalSettings ausente. Resetando...');
        localStorage.removeItem('promeasure_v4_data');
      }
    }
  } catch (error) {
    console.error('Erro ao validar localStorage. Limpando...', error);
    localStorage.removeItem('promeasure_v4_data');
  }
};