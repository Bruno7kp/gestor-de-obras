
export const financial = {
  roundTo: (value: number, decimals: number): number => {
    const safeDecimals = Math.min(Math.max(Math.trunc(decimals || 0), 0), 10);
    const factor = 10 ** safeDecimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  },

  truncateTo: (value: number, decimals: number): number => {
    const safeDecimals = Math.min(Math.max(Math.trunc(decimals || 0), 0), 10);
    const factor = 10 ** safeDecimals;
    return Math.floor((value + 0.0000000001) * factor) / factor;
  },

  clampDecimals: (value: number, min = 2, max = 6): number => {
    const normalized = Number.isFinite(value) ? Math.trunc(value) : min;
    return Math.min(Math.max(normalized, min), max);
  },

  /**
   * Arredondamento financeiro padrão (2 casas decimais).
   */
  round: (value: number): number => {
    return financial.roundTo(value, 2);
  },

  /**
   * Truncagem rigorosa de 2 casas decimais (Excel TRUNCAR).
   * Adiciona um epsilon de 1e-9 para corrigir imprecisões de ponto flutuante do JS
   * antes de realizar o corte das casas decimais.
   */
  truncate: (value: number): number => {
    return financial.truncateTo(value, 2);
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

  formatVisualPrecision: (
    value: number,
    symbol: string = 'R$',
    minFractionDigits = 2,
    maxFractionDigits = 6,
  ): string => {
    const min = financial.clampDecimals(minFractionDigits, 0, 10);
    const max = Math.max(min, financial.clampDecimals(maxFractionDigits, min, 10));
    const num = value || 0;
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(num);
    return symbol ? `${symbol} ${formatted}` : formatted;
  },

  /**
   * Formata quantidade com ate 6 casas decimais (exibe precisão real).
   */
  formatQuantity: (value: number | string | null | undefined): string => {
    const parsed = typeof value === 'string'
      ? parseFloat(value.replace(/\./g, '').replace(',', '.'))
      : (value ?? 0);
    const num = Number.isFinite(parsed) ? parsed : 0;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6
    }).format(num);
  },

  /**
   * Normaliza valores monetarios para 2 casas decimais.
   */
  normalizeMoney: (value: number): number => {
    return financial.truncate(value || 0);
  },

  normalizeMoneyPrecision: (value: number, decimals = 2): number => {
    const safeDecimals = financial.clampDecimals(decimals, 0, 10);
    return financial.truncateTo(value || 0, safeDecimals);
  },

  /**
   * Normaliza quantidades para 2 casas decimais.
   */
  normalizeQuantity: (value: number): number => {
    return financial.round(value || 0);
  },

  /**
   * Normaliza quantidades com precisão configurável.
   */
  normalizeQuantityPrecision: (value: number, decimals = 2): number => {
    const safeDecimals = financial.clampDecimals(decimals, 0, 10);
    return financial.roundTo(value || 0, safeDecimals);
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
   * Máscara decimal com escala configurável (digitação por deslocamento à esquerda).
   * Ex.: scale=2 e entrada "1000" -> "10,00"
   */
  maskDecimal: (value: string, fractionDigits = 2): string => {
    const scale = financial.clampDecimals(fractionDigits, 0, 10);
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: scale,
        maximumFractionDigits: scale,
      }).format(0);
    }

    const divisor = scale > 0 ? 10 ** scale : 1;
    const numberValue = parseInt(digits, 10) / divisor;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
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
