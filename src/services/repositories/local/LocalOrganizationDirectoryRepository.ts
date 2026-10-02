import {
  departments,
  positions,
} from "../../../features/employees/data/employeeOptions";
import { branches, clients } from "../../lookups/organization";
import type {
  OrganizationBranch,
  OrganizationClient,
  OrganizationDepartment,
  OrganizationDirectory,
  OrganizationPosition,
} from "../../../types/organization";
import type {
  OrganizationDirectoryRepository,
  OrganizationListOptions,
  OrganizationRecordKind,
} from "../OrganizationDirectoryRepository";
import { flushDatabaseStorage, readPersistentItem, writePersistentItem } from "../../server/databaseStorage";

const STORAGE_KEY = "coop_sys_organization_directory";

const seedDirectory: OrganizationDirectory = {
  branches: branches.map((item) => ({ ...item })),
  clients: clients.map((item) => ({ ...item })),
  departments: departments.map((item, index) => ({
    id: item.id,
    code: ["ADM", "FIN", "MEM", "OPS", "IT"][index],
    label: item.label,
    description: "",
    isActive: true,
  })),
  positions: positions.map((item, index) => ({
    id: item.id,
    code: `POS-${String(index + 1).padStart(2, "0")}`,
    label: item.label,
    departmentId: item.departmentId,
    description: "",
    isActive: true,
  })),
};

function readDirectory(): OrganizationDirectory {
  const raw = readPersistentItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as OrganizationDirectory;
  writePersistentItem(STORAGE_KEY, JSON.stringify(seedDirectory));
  return structuredClone(seedDirectory);
}

function upsert<T extends { id: string }>(records: T[], record: T) {
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
}

function ensureUnique(
  directory: OrganizationDirectory,
  collection: keyof OrganizationDirectory,
  id: string,
  code: string,
  label: string,
) {
  const records = directory[collection] as Array<{
    id: string;
    code: string;
    label: string;
  }>;
  if (
    records.some(
      (item) =>
        item.id !== id && item.code.toLowerCase() === code.toLowerCase(),
    )
  )
    throw new Error("Code already exists.");
  if (
    records.some(
      (item) =>
        item.id !== id && item.label.toLowerCase() === label.toLowerCase(),
    )
  )
    throw new Error("Name already exists.");
}

function write(directory: OrganizationDirectory) {
  writePersistentItem(STORAGE_KEY, JSON.stringify(directory));
}

export class LocalOrganizationDirectoryRepository
  implements OrganizationDirectoryRepository
{
  async getDirectory() {
    return readDirectory();
  }
  async listRecords(
    kind: OrganizationRecordKind,
    options: OrganizationListOptions = {},
  ) {
    const directory = readDirectory();
    const source =
      kind === "branch"
        ? directory.branches
        : kind === "client"
          ? directory.clients
          : kind === "department"
            ? directory.departments
            : directory.positions;
    const term = options.search?.trim().toLowerCase() ?? "";
    const records = source
      .filter(
        (item) =>
          options.status === "all" ||
          !options.status ||
          item.isActive === (options.status === "active"),
      )
      .filter(
        (item) =>
          !term ||
          item.label.toLowerCase().includes(term) ||
          item.code.toLowerCase().includes(term),
      )
      .sort((a, b) => a.label.localeCompare(b.label));
    const offset = options.offset ?? 0;
    return {
      items: records.slice(
        offset,
        options.limit ? offset + options.limit : undefined,
      ),
      total: records.length,
    };
  }
  async saveBranch(record: OrganizationBranch) {
    const directory = readDirectory();
    ensureUnique(directory, "branches", record.id, record.code, record.label);
    upsert(directory.branches, record);
    write(directory);
    await flushDatabaseStorage();
  }
  async saveClient(record: OrganizationClient) {
    const directory = readDirectory();
    ensureUnique(directory, "clients", record.id, record.code, record.label);
    upsert(directory.clients, record);
    write(directory);
    await flushDatabaseStorage();
  }
  async saveDepartment(record: OrganizationDepartment) {
    const directory = readDirectory();
    ensureUnique(
      directory,
      "departments",
      record.id,
      record.code,
      record.label,
    );
    upsert(directory.departments, record);
    write(directory);
    await flushDatabaseStorage();
  }
  async savePosition(record: OrganizationPosition) {
    const directory = readDirectory();
    ensureUnique(directory, "positions", record.id, record.code, record.label);
    upsert(directory.positions, record);
    write(directory);
    await flushDatabaseStorage();
  }
}
