export type ListOptions = {
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
};

export interface CrudRepository<TEntity, TInput> {
  list(options?: ListOptions): Promise<TEntity[]>;
  getById(id: string): Promise<TEntity | null>;
  create(input: TInput): Promise<TEntity>;
  update(id: string, input: Partial<TInput>): Promise<TEntity>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<TEntity>;
}
