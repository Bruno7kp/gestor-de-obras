
export const financial = {
  /**
   * Arredondamento financeiro padrão (2 casas decimais).
   */
  round: (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  },

  /**
   * Truncagem rigorosa de 2 casas decimais (Excel TRUNCAR).
   * Adiciona um epsilon de 1e-9 para corrigir imprecisões de ponto flutuante do JS
   * antes de realizar o corte das casas decimais.
   */
  truncate: (value: number): number => {
    const factor = 100;
    // O 0.0000000001 (1e-10) serve para garantir que 5.9999999999 seja 6.00 antes do trunc
    return Math.floor((value + 0.0000000001) * factor) / factor;
  },
  
  /**
   * Formata para BRL usando o Intl padrão (inclui R$).
   */
  formatBRL: (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  },

  /**
   * Formata um número com símbolo customizado.
   */
  formatVisual: (value: number, symbol: string = 'R$'): string => {
    const num = value || 0;
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
    return symbol ? `${symbol} ${formatted}` : formatted;
  },

  /**
   * Formata quantidade com ate 2 casas decimais.
   */
  formatQuantity: (value: number | string | null | undefined): string => {
    const parsed = typeof value === 'string'
      ? parseFloat(value.replace(/\./g, '').replace(',', '.'))
      : (value ?? 0);
    const num = financial.round(Number.isFinite(parsed) ? parsed : 0);
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  },

  /**
   * Normaliza valores monetarios para 2 casas decimais.
   */
  normalizeMoney: (value: number): number => {
    return financial.truncate(value || 0);
  },

  /**
   * Normaliza quantidades para 2 casas decimais.
   */
  normalizeQuantity: (value: number): number => {
    return financial.round(value || 0);
  },

  /**
   * Normaliza percentuais para 2 casas decimais.
   */
  normalizePercent: (value: number): number => {
    return financial.round(value || 0);
  },

  /**
   * Máscara de digitação: transforma "1234" em "12,34"
   */
  maskCurrency: (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '0,00';
    const numberValue = parseInt(digits, 10) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberValue);
  },

  /**
   * Converte uma string formatada de volta para número.
   */
  parseLocaleNumber: (value: string): number => {
    if (!value) return 0;
    const cleanValue = value
      .replace(/[^\d,.-]/g, '') 
      .replace(/\./g, '')
      .replace(',', '.');
    return parseFloat(cleanValue) || 0;
  },

  /**
   * Soma de precisão: Soma os valores e trunca o resultado final.
   */
  sum: (values: number[]): number => {
    const total = values.reduce((acc, val) => acc + (val || 0), 0);
    return financial.truncate(total);
  },

  /**
   * Formata data YYYY-MM-DD para DD/MM/YYYY.
   */
  formatDate: (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
};
