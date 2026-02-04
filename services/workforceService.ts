
import { WorkforceMember, StaffDocument } from '../types';

export const workforceService = {
  /**
   * Valida o status de um documento com base na data atual.
   * Regra: Vencido se data < hoje. Pendente se vencer em menos de 30 dias.
   */
  validateDocumentStatus: (doc: StaffDocument): 'apto' | 'pendente' | 'vencido' => {
    if (!doc.dataVencimento) return 'pendente';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(doc.dataVencimento);
    expiry.setHours(0, 0, 0, 0);

    if (expiry < today) return 'vencido';
    
    // Alerta de proximidade: 30 dias
    const threshold = new Date();
    threshold.setDate(today.getDate() + 30);
    if (expiry <= threshold) return 'pendente';

    return 'apto';
  },

  /**
   * Valida o status global do funcionário baseado em todos os seus documentos.
   */
  getMemberGlobalStatus: (member: WorkforceMember): 'apto' | 'pendente' | 'vencido' => {
    if (!member.documentos || member.documentos.length === 0) return 'apto';
    
    const statuses = member.documentos.map(workforceService.validateDocumentStatus);
    
    if (statuses.includes('vencido')) return 'vencido';
    if (statuses.includes('pendente')) return 'pendente';
    
    return 'apto';
  },

  createMember: (role: WorkforceMember['cargo']): WorkforceMember => ({
    id: crypto.randomUUID(),
    nome: '',
    cpf_cnpj: '',
    empresa_vinculada: '',
    cargo: role,
    documentos: [],
    linkedWorkItemIds: [],
    foto: undefined
  })
};
