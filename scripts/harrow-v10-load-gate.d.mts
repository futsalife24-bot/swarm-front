export interface LoadRequest {
  readonly id: number;
  readonly version: string;
}

export class LatestRequest {
  begin(version: string): LoadRequest;
  isCurrent(request: LoadRequest): boolean;
}
