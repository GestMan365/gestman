export interface Empresa {
  id: string;
  name: string;
  document?: string;
  isActive: boolean;
}

export interface TenantScope {
  empresaId: string;
}
