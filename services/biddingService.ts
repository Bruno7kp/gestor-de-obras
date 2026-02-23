
import { BiddingProcess, Project, CompanyCertificate, DEFAULT_THEME } from '../types';
import { projectService } from './projectService';
import { financial } from '../utils/math';

export const biddingService = {
  createBidding: (): BiddingProcess => ({
    id: crypto.randomUUID(),
    tenderNumber: '000/2024',
    clientName: 'Novo Cliente/Órgão',
    object: 'Descrição da Obra/Serviço',
    openingDate: new Date().toISOString().split('T')[0],
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedValue: 0,
    ourProposalValue: 0,
    status: 'PROSPECTING',
    items: [],
    assets: [],
    bdi: 25
  }),

  convertToProject: (bidding: BiddingProcess, companyName: string): Project => {
    const project = projectService.createProject(
      `${bidding.tenderNumber} - ${bidding.clientName}`,
      companyName,
      null
    );

    return {
      ...project,
      items: bidding.items,
      bdi: bidding.bdi,
      assets: bidding.assets
    };
  },

  getStats: (biddings: BiddingProcess[]) => {
    const totalPipeline = financial.sum(biddings.filter(b => b.status !== 'LOST').map(b => b.ourProposalValue));
    const wonValue = financial.sum(biddings.filter(b => b.status === 'WON').map(b => b.ourProposalValue));
    const openValue = financial.sum(biddings.filter(b => ['PROSPECTING', 'DRAFTING', 'SUBMITTED'].includes(b.status)).map(b => b.ourProposalValue));
    
    const winRate = biddings.length > 0 
      ? (biddings.filter(b => b.status === 'WON').length / biddings.filter(b => ['WON', 'LOST'].includes(b.status) || b.status === 'WON').length || 0) * 100 
      : 0;

    return { totalPipeline, wonValue, openValue, winRate };
  },

  checkCertificateStatus: (cert: CompanyCertificate): 'valid' | 'warning' | 'expired' => {
    if (!cert.expirationDate) return 'valid';

    const today = new Date();
    const exp = new Date(cert.expirationDate);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 15) return 'warning';
    return 'valid';
  },

  hasGlobalAlerts: (certificates: CompanyCertificate[]): boolean => {
    return certificates.some(c => biddingService.checkCertificateStatus(c) !== 'valid');
  }
};
