export type ListOptions = {
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  statusId?: string;
  typeId?: string;
  approvalStatus?: string;
  branchId?: string;
  clientId?: string;
  departmentId?: string;
  sort?: string;
};

export type PagedResult<TEntity> = { items: TEntity[]; total: number };

export interface CrudRepository<TEntity, TInput> {
  list(options?: ListOptions): Promise<TEntity[]>;
  listPage(options?: ListOptions): Promise<PagedResult<TEntity>>;
  getById(id: string): Promise<TEntity | null>;
  create(input: TInput): Promise<TEntity>;
  update(id: string, input: Partial<TInput>): Promise<TEntity>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<TEntity>;
}
