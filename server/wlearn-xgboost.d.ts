declare module "@wlearn/xgboost" {
  export class XGBModel {
    static create(params?: Record<string, unknown>): Promise<XGBModel>;
    static load(buffer: Uint8Array): Promise<XGBModel>;
    fit(X: number[][] | { data: Float64Array; rows: number; cols: number }, y: number[] | Float64Array): this;
    predict(X: number[][] | { data: Float64Array; rows: number; cols: number }): Float64Array;
    predictProba(X: number[][] | { data: Float64Array; rows: number; cols: number }): Float64Array;
    score(X: number[][] | { data: Float64Array; rows: number; cols: number }, y: number[] | Float64Array): number;
    save(): Uint8Array;
    getParams(): Record<string, unknown>;
    setParams(params: Record<string, unknown>): this;
    dispose(): void;
  }
}
