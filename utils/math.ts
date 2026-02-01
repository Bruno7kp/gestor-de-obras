
export const financial = {
  /**
   * Arredondamento financeiro padrão (2 casas decimais).
   */
  round: (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  },

  /**
   * Truncagem financeira (2 casas decimais) - evita arredondar para cima.
   * Crucial para cálculos de BDI onde o valor não pode extrapolar o contrato.
   */
  truncate: (value: number): number => {
    return Math.floor((value + Number.EPSILON) * 100) / 100;
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
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return symbol ? `${symbol} ${formatted}` : formatted;
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
   * Soma valores garantindo truncagem no resultado final para precisão de centavos.
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
