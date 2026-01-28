export interface IApiResponse<T> {
  value: T[];
  nextLink?: string;
}
