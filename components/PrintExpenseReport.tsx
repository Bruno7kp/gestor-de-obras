
import React, { useMemo } from 'react';
import { Project, ProjectExpense, DEFAULT_THEME, ExpenseType } from '../types';
import { financial } from '../utils/math';
import { expenseService } from '../services/expenseService';
import { treeService } from '../services/treeService';

interface PrintExpenseReportProps {
  project: Project;
  expenses: ProjectExpense[];
  stats: any;
  printMode?: 'complete' | 'material' | 'labor';
  dateStart?: string;
  dateEnd?: string;
  showGroups?: boolean;
}

type ReportRow = {
  id: string;
  itemType: 'category' | 'item';
  depth: number;
  type: ExpenseType;
  description: string;
  entityName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: string;
};

type ReportSection = {
  key: ExpenseType;
  title: string;
  rows: ReportRow[];
};

const TYPE_TITLE: Record<ExpenseType, string> = {
  labor: 'Mão de Obra',
  material: 'Suprimentos',
  revenue: 'Entradas',
  other: 'Outros',
};

const TYPE_SHORT: Record<ExpenseType, string> = {
  revenue: 'ENT',
  labor: 'M.O',
  other: 'OUT',
  material: 'MAT',
};

export const PrintExpenseReport: React.FC<PrintExpenseReportProps> = ({ project, expenses, stats, printMode = 'complete', dateStart, dateEnd, showGroups = false }) => {
  const theme = {
    ...DEFAULT_THEME,
    ...project.theme
  };

  const getPaymentSortDate = (expense: ProjectExpense) => {
    const candidate = expense.paymentDate || expense.date || '';
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
  };

  const sortExpensesByPaymentDate = (items: ProjectExpense[]) => {
    const cloned = items.map(item => ({ ...item }));
    const childrenByParent = new Map<string | null, ProjectExpense[]>();

    cloned.forEach(item => {
      const parentKey = item.parentId ?? null;
      if (!childrenByParent.has(parentKey)) {
        childrenByParent.set(parentKey, []);
      }
      childrenByParent.get(parentKey)!.push(item);
    });

    const sortKeyCache = new Map<string, string | null>();

    const resolveSortKey = (expense: ProjectExpense): string | null => {
      const cached = sortKeyCache.get(expense.id);
      if (cached !== undefined) return cached;

      if (expense.itemType === 'item') {
        const key = getPaymentSortDate(expense) || null;
        sortKeyCache.set(expense.id, key);
        return key;
      }

      const children = childrenByParent.get(expense.id) || [];
      let minKey: string | null = null;
      children.forEach(child => {
        const childKey = resolveSortKey(child);
        if (!childKey) return;
        if (!minKey || childKey < minKey) minKey = childKey;
      });

      sortKeyCache.set(expense.id, minKey);
      return minKey;
    };

    cloned.forEach(resolveSortKey);

    const compareSiblings = (a: ProjectExpense, b: ProjectExpense) => {
      const keyA = sortKeyCache.get(a.id) || null;
      const keyB = sortKeyCache.get(b.id) || null;

      if (keyA && keyB && keyA !== keyB) return keyA.localeCompare(keyB);
      if (keyA && !keyB) return -1;
      if (!keyA && keyB) return 1;

      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.description.localeCompare(b.description, 'pt-BR');
    };

    const assignSiblingOrder = (parentId: string | null) => {
      const siblings = [...(childrenByParent.get(parentId) || [])].sort(compareSiblings);
      siblings.forEach((sibling, index) => {
        sibling.order = index;
        assignSiblingOrder(sibling.id);
      });
    };

    assignSiblingOrder(null);
    return cloned;
  };

  const isWithinDateFilter = (expense: ProjectExpense) => {
    if (!dateStart && !dateEnd) return true;
    if (!expense.date) return false;
    if (dateStart && expense.date < dateStart) return false;
    if (dateEnd && expense.date > dateEnd) return false;
    return true;
  };

  const selectedTypes = useMemo<ExpenseType[]>(() => {
    if (printMode === 'material') return ['material'];
    if (printMode === 'labor') return ['labor'];
    return ['labor', 'material', 'revenue', 'other'];
  }, [printMode]);

  const reportItems = useMemo(() => {
    const onlyItems = expenses.filter((expense) => (
      expense.itemType === 'item'
      && selectedTypes.includes(expense.type)
      && isWithinDateFilter(expense)
    ));

    return [...onlyItems].sort((a, b) => {
      const keyA = getPaymentSortDate(a);
      const keyB = getPaymentSortDate(b);
      if (keyA && keyB && keyA !== keyB) return keyA.localeCompare(keyB);
      if (keyA && !keyB) return -1;
      if (!keyA && keyB) return 1;
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.description.localeCompare(b.description, 'pt-BR');
    });
  }, [expenses, selectedTypes, dateStart, dateEnd]);

  const groupedSections = useMemo<ReportSection[]>(() => {
    if (!showGroups) return [];

    return selectedTypes.map((type): ReportSection => {
      const scoped = expenses.filter(expense => expense.type === type);
      const byId = new Map(scoped.map(expense => [expense.id, expense] as const));
      const allowedIds = new Set<string>();

      scoped.forEach(expense => {
        if (expense.itemType !== 'item') return;
        if (!isWithinDateFilter(expense)) return;

        let current: ProjectExpense | undefined = expense;
        while (current) {
          if (allowedIds.has(current.id)) break;
          allowedIds.add(current.id);
          if (!current.parentId) break;
          current = byId.get(current.parentId);
        }
      });

      const filtered = scoped.filter(expense => allowedIds.has(expense.id));
      if (filtered.length === 0) {
        return { key: type, title: TYPE_TITLE[type], rows: [] };
      }

      const sortedByDate = sortExpensesByPaymentDate(filtered);
      const tree = treeService.buildTree(sortedByDate);
      const processed = tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
      const expanded = new Set(sortedByDate.map(expense => expense.id));
      const flattened = treeService.flattenTree(processed, expanded);

      const rows: ReportRow[] = flattened.map(expense => ({
        id: expense.id,
        itemType: expense.itemType,
        depth: expense.depth,
        type: expense.type,
        description: expense.description,
        entityName: expense.entityName || '',
        unit: expense.unit || '',
        quantity: expense.quantity || 0,
        unitPrice: expense.unitPrice || 0,
        amount: expense.amount || 0,
        date: getPaymentSortDate(expense) || expense.date || '',
      }));

      return { key: type, title: TYPE_TITLE[type], rows };
    }).filter(section => section.rows.length > 0);
  }, [showGroups, selectedTypes, expenses, dateStart, dateEnd]);

  const periodLabel = useMemo(() => {
    if (!dateStart && !dateEnd) return null;
    const fmt = (d: string) => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };
    if (dateStart && dateEnd) return `Período: ${fmt(dateStart)} a ${fmt(dateEnd)}`;
    if (dateStart) return `A partir de: ${fmt(dateStart)}`;
    return `Até: ${fmt(dateEnd!)}`;
  }, [dateStart, dateEnd]);

  const reportStats = useMemo(() => expenseService.getExpenseStats(reportItems), [reportItems]);

  const currencySymbol = theme.currencySymbol || 'R$';

  const dynamicStyles = `
    @media print {
      .print-expense-report-area {
        display: block !important;
        position: static !important;
        width: 100% !important;
        background: white !important;
        color: black !important;
        font-family: '${theme.fontFamily}', sans-serif !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .expense-report-container {
        display: block !important;
        padding: 10mm !important;
      }

      .expense-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 5mm;
        page-break-after: auto;
      }

      .expense-table thead {
        display: table-header-group !important;
      }

      .expense-table tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .expense-table th, .expense-table td {
        border: 0.3pt solid ${theme.border} !important;
        padding: 4pt 3pt !important;
        font-size: 6.5pt !important;
        text-align: left;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .expense-table thead th {
        background-color: ${theme.header.bg} !important;
        color: ${theme.header.text} !important;
        font-weight: 900;
        text-transform: uppercase;
        -webkit-print-color-adjust: exact !important;
      }

      .row-revenue { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact !important; }
      .row-labor { background-color: #eff6ff !important; -webkit-print-color-adjust: exact !important; }
      .row-material { background-color: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
      .row-other { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; }

      .kpi-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 3mm !important;
        margin-bottom: 5mm !important;
      }

      .kpi-card {
        padding: 3pt !important;
        border: 0.3pt solid #ddd !important;
        border-radius: 4pt !important;
        text-align: center;
      }

      .signature-area {
        margin-top: 15mm !important;
        display: grid !important;
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 20mm !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .signature-block {
        text-align: center;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .signature-line {
        border-top: 0.3pt solid black !important;
        margin-bottom: 2pt;
      }

      .no-print, button { display: none !important; }
    }
  `;

  return (
    <div className="print-report-area print-expense-report-area bg-white min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      <div className="expense-report-container">
        {/* Header Institucional */}
        <div className="flex justify-between items-end border-b-2 pb-4 mb-6" style={{ borderColor: theme.primary }}>
          <div>
            <h1 className="text-xl font-black uppercase leading-none" style={{ color: theme.primary }}>{project.companyName}</h1>
            <p className="text-[7pt] font-bold text-slate-500 uppercase mt-1">Relatório Consolidado de Financeiro</p>
            <p className="text-[8pt] font-black mt-2 uppercase tracking-tight">{project.name}</p>
            {periodLabel && <p className="text-[7pt] font-bold text-indigo-600 mt-1">{periodLabel}</p>}
            <p className="text-[7pt] font-bold text-slate-500 uppercase mt-1">Exibir grupos: {showGroups ? 'Sim' : 'Não'}</p>
          </div>
          <div className="text-right">
             <p className="text-[7pt] font-bold text-slate-400">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
             <p className="text-[8pt] font-black uppercase text-indigo-600">Gestão de Custos v0.5</p>
          </div>
        </div>

        {/* KPIs Summary */}
        <div className="kpi-grid grid grid-cols-4 gap-4 mb-6">
          <div className="kpi-card p-3 border border-slate-100 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Total Recebido</p>
            <p className="text-[10pt] font-black text-emerald-600">{financial.formatVisual(reportStats.revenue, currencySymbol)}</p>
          </div>
          <div className="kpi-card p-3 border border-slate-100 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Mão de Obra</p>
            <p className="text-[10pt] font-black text-blue-600">{financial.formatVisual(reportStats.labor, currencySymbol)}</p>
          </div>
          <div className="kpi-card p-3 border border-slate-100 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Materiais</p>
            <p className="text-[10pt] font-black text-indigo-600">{financial.formatVisual(reportStats.material, currencySymbol)}</p>
          </div>
          <div className="kpi-card p-3 border border-slate-200 bg-slate-50 rounded-lg">
            <p className="text-[5pt] font-black text-slate-400 uppercase tracking-widest">Saldo Período</p>
            <p className={`text-[10pt] font-black ${reportStats.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {financial.formatVisual(reportStats.profit, currencySymbol)}
            </p>
          </div>
        </div>

        {/* Tabela Principal */}
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Data</th>
              <th style={{ width: '8%' }}>Tipo</th>
              <th style={{ width: '35%' }}>Descrição do Lançamento</th>
              <th style={{ width: '20%' }}>Fornecedor / Entidade</th>
              <th style={{ width: '5%', textAlign: 'center' }}>Qtd</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Unitário</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Líquido</th>
            </tr>
          </thead>
          <tbody>
            {showGroups
              ? groupedSections.map(section => (
                <React.Fragment key={section.key}>
                  <tr>
                    <td colSpan={7} className="font-black uppercase text-[7pt] bg-slate-100" style={{ letterSpacing: '0.08em' }}>
                      {section.title}
                    </td>
                  </tr>
                  {section.rows.map(row => {
                    const rowClass = row.itemType === 'category'
                      ? 'bg-slate-50'
                      : (row.type === 'revenue'
                        ? 'row-revenue'
                        : (row.type === 'labor'
                          ? 'row-labor'
                          : (row.type === 'other' ? 'row-other' : 'row-material')));

                    return (
                      <tr key={row.id} className={rowClass}>
                        <td>{row.itemType === 'item' ? financial.formatDate(row.date) : '—'}</td>
                        <td className="font-bold">{TYPE_SHORT[row.type]}</td>
                        <td style={{ paddingLeft: `${Math.min(row.depth * 8, 48) + 3}px`, fontWeight: row.itemType === 'category' ? 800 : 600 }}>
                          {row.description}
                        </td>
                        <td className="text-slate-600">{row.itemType === 'item' ? (row.entityName || '—') : '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          {row.itemType === 'item' ? `${financial.formatQuantity(row.quantity)} ${row.unit}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.itemType === 'item' ? financial.formatVisual(row.unitPrice, currencySymbol) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }} className="font-bold">{financial.formatVisual(row.amount, currencySymbol)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
              : reportItems.map(e => (
                <tr
                  key={e.id}
                  className={e.type === 'revenue'
                    ? 'row-revenue'
                    : (e.type === 'labor'
                      ? 'row-labor'
                      : (e.type === 'other' ? 'row-other' : 'row-material'))}
                >
                  <td>{financial.formatDate(getPaymentSortDate(e) || e.date)}</td>
                  <td className="font-bold">{TYPE_SHORT[e.type]}</td>
                  <td>{e.description}</td>
                  <td className="text-slate-600">{e.entityName || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{financial.formatQuantity(e.quantity)} {e.unit}</td>
                  <td style={{ textAlign: 'right' }}>{financial.formatVisual(e.unitPrice, currencySymbol)}</td>
                  <td style={{ textAlign: 'right' }} className="font-bold">{financial.formatVisual(e.amount, currencySymbol)}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Rodapé de Assinaturas */}
        <div className="signature-area grid grid-cols-2 gap-20 mt-16">
           <div className="signature-block">
              <div className="signature-line w-full mb-1"></div>
              <p className="text-[7pt] font-black uppercase">Responsável Financeiro</p>
              <p className="text-[6pt] text-slate-400 font-bold uppercase">{project.companyName}</p>
           </div>
           <div className="signature-block">
              <div className="signature-line w-full mb-1"></div>
              <p className="text-[7pt] font-black uppercase">Gestão Operacional</p>
              <p className="text-[6pt] text-slate-400 font-bold uppercase">Conferência e Aprovação</p>
           </div>
        </div>
      </div>
    </div>
  );
};
