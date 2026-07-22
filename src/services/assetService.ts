import { isDemoAuthMode } from "@/services/supabaseClient";
import type { Asset, AssetDraft } from "@/types/assets";

const QA_PREFIX = "QA-AUTO-ATIVO";
const STORAGE_PREFIX = "gestman365.demo.assets";
const SEED_VERSION = "1";

export class AssetServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetServiceError";
  }
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function storageKey(empresaId: string): string {
  return `${STORAGE_PREFIX}.${empresaId}`;
}

function seedKey(empresaId: string): string {
  return `${storageKey(empresaId)}.seed-version`;
}

function createSeedAssets(empresaId: string): Asset[] {
  const createdAt = "2026-07-21T12:00:00.000Z";
  return [
    {
      id: "qa-auto-ativo-mot-001",
      empresaId,
      plantaId: "planta-demo",
      setorId: "Produção",
      localId: "Linha de produção 01",
      tag: "QA-AUTO-ATIVO-MOT-001",
      name: "Motor Elétrico da Esteira 01",
      description: "Motor elétrico trifásico da esteira principal.",
      category: "Motor elétrico",
      manufacturer: "Fabricante QA",
      model: "MOT-15CV",
      serialNumber: "QA-MOT-001",
      status: "OPERANDO",
      criticality: "ALTA",
      responsible: "Equipe de Manutenção",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "qa-auto-ativo-bom-001",
      empresaId,
      plantaId: "planta-demo",
      setorId: "Envase",
      localId: "Sala de bombas",
      tag: "QA-AUTO-ATIVO-BOM-001",
      name: "Bomba Centrífuga de Processo 01",
      description: "Bomba de transferência do processo de envase.",
      category: "Bomba centrífuga",
      manufacturer: "Fabricante QA",
      model: "BCP-010",
      serialNumber: "QA-BOM-001",
      status: "EM_MANUTENCAO",
      criticality: "CRITICA",
      responsible: "Equipe de Manutenção",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "qa-auto-ativo-cmp-001",
      empresaId,
      plantaId: "planta-demo",
      setorId: "Utilidades",
      localId: "Casa de compressores",
      tag: "QA-AUTO-ATIVO-CMP-001",
      name: "Compressor de Ar 01",
      description: "Compressor principal da rede de ar comprimido.",
      category: "Compressor",
      manufacturer: "Fabricante QA",
      model: "CMP-40",
      serialNumber: "QA-CMP-001",
      status: "PARADO",
      criticality: "MEDIA",
      responsible: "Utilidades",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function isAsset(value: unknown): value is Asset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Asset>;
  return Boolean(
    typeof candidate.id === "string" &&
    typeof candidate.empresaId === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.criticality === "string" &&
    typeof candidate.isActive === "boolean" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function readAssets(empresaId: string): Asset[] {
  const storage = browserStorage();
  if (!storage) return createSeedAssets(empresaId);

  if (storage.getItem(seedKey(empresaId)) !== SEED_VERSION) {
    const seeded = createSeedAssets(empresaId);
    storage.setItem(storageKey(empresaId), JSON.stringify(seeded));
    storage.setItem(seedKey(empresaId), SEED_VERSION);
    return seeded;
  }

  const raw = storage.getItem(storageKey(empresaId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isAsset)) return parsed;
  } catch {
    // A demo session can be recovered without affecting production data.
  }

  const seeded = createSeedAssets(empresaId);
  storage.setItem(storageKey(empresaId), JSON.stringify(seeded));
  return seeded;
}

function writeAssets(empresaId: string, assets: Asset[]): void {
  browserStorage()?.setItem(storageKey(empresaId), JSON.stringify(assets));
}

function requireDemoMode(): void {
  if (!isDemoAuthMode) {
    throw new AssetServiceError(
      "O backend de Ativos ainda não foi configurado para este ambiente. Nenhum dado remoto foi alterado."
    );
  }
}

function normalizedTag(tag: string): string {
  return tag.trim().toUpperCase();
}

export const assetService = {
  qaPrefix: QA_PREFIX,

  async list(empresaId: string): Promise<Asset[]> {
    requireDemoMode();
    return readAssets(empresaId).map(asset => ({ ...asset }));
  },

  async create(empresaId: string, draft: AssetDraft): Promise<Asset> {
    requireDemoMode();
    const assets = readAssets(empresaId);
    const tag = normalizedTag(draft.tag);
    if (assets.some(asset => normalizedTag(asset.tag) === tag)) {
      throw new AssetServiceError("Já existe um ativo com esta TAG nesta empresa.");
    }

    const now = new Date().toISOString();
    const asset: Asset = {
      id: `demo-${Date.now()}-${tag.toLowerCase()}`,
      empresaId,
      tag,
      name: draft.name.trim(),
      description: draft.description?.trim(),
      category: draft.category?.trim(),
      manufacturer: draft.manufacturer?.trim(),
      model: draft.model?.trim(),
      serialNumber: draft.serialNumber?.trim(),
      setorId: draft.sectorId?.trim(),
      localId: draft.locationId?.trim(),
      status: draft.status,
      criticality: draft.criticality,
      isActive: draft.status !== "INATIVO",
      createdAt: now,
      updatedAt: now
    };
    writeAssets(empresaId, [...assets, asset]);
    return { ...asset };
  },

  async update(empresaId: string, id: string, draft: AssetDraft): Promise<Asset> {
    requireDemoMode();
    const assets = readAssets(empresaId);
    const current = assets.find(asset => asset.id === id && asset.empresaId === empresaId);
    if (!current) throw new AssetServiceError("Ativo não encontrado nesta empresa.");

    const tag = normalizedTag(draft.tag);
    if (assets.some(asset => asset.id !== id && normalizedTag(asset.tag) === tag)) {
      throw new AssetServiceError("Já existe um ativo com esta TAG nesta empresa.");
    }

    const updated: Asset = {
      ...current,
      tag,
      name: draft.name.trim(),
      description: draft.description?.trim(),
      category: draft.category?.trim(),
      manufacturer: draft.manufacturer?.trim(),
      model: draft.model?.trim(),
      serialNumber: draft.serialNumber?.trim(),
      setorId: draft.sectorId?.trim(),
      localId: draft.locationId?.trim(),
      status: draft.status,
      criticality: draft.criticality,
      isActive: draft.status !== "INATIVO",
      updatedAt: new Date().toISOString()
    };
    writeAssets(empresaId, assets.map(asset => asset.id === id ? updated : asset));
    return { ...updated };
  },

  async inactivate(empresaId: string, id: string): Promise<Asset> {
    requireDemoMode();
    const assets = readAssets(empresaId);
    const current = assets.find(asset => asset.id === id && asset.empresaId === empresaId);
    if (!current) throw new AssetServiceError("Ativo não encontrado nesta empresa.");
    const updated: Asset = {
      ...current,
      status: "INATIVO",
      isActive: false,
      updatedAt: new Date().toISOString()
    };
    writeAssets(empresaId, assets.map(asset => asset.id === id ? updated : asset));
    return { ...updated };
  },

  async cleanupQaAssets(empresaId: string): Promise<number> {
    requireDemoMode();
    const assets = readAssets(empresaId);
    const retained = assets.filter(asset => !normalizedTag(asset.tag).startsWith(QA_PREFIX));
    writeAssets(empresaId, retained);
    return assets.length - retained.length;
  }
};
