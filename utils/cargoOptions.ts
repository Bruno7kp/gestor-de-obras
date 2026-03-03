export const DEFAULT_AUTONOMOUS_CARGOS = [
  'Carpinteiro',
  'Eletricista',
  'Encanador',
  'Encarregado',
  'Engenheiro',
  'Mestre',
  'Pedreiro',
  'Pintor',
  'Servente',
];

export const mergeCargoOptions = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const key = trimmed.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(trimmed);
  });

  return normalized.sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
