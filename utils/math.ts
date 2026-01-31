
export const financial = {
  /**
   * Arredondamento financeiro padrão (2 casas decimais).
   */
  round: (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  },
  
  formatBRL: (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  },

  /**
   * Formata um número puro para o padrão visual brasileiro sem o prefixo R$.
   */
  formatVisual: (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  },

  /**
   * Máscara de digitação: transforma "1234" em "12,34" e "123456" em "1.234,56"
   */
  maskCurrency: (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '0,00';
    const numberValue = parseInt(digits, 10) / 100;
    return financial.formatVisual(numberValue);
  },

  /**
   * Converte uma string formatada (1.234,56) de volta para um número (1234.56)
   */
  parseLocaleNumber: (value: string): number => {
    if (!value) return 0;
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  },

  sum: (values: number[]): number => {
    return financial.round(values.reduce((acc, val) => acc + val, 0));
  },

  /**
   * Formata data YYYY-MM-DD para DD/MM/YYYY sem sofrer alteração de fuso horário.
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
