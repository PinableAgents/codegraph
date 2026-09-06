import { calculateLayout } from './graph-layout-runner';
export function requestLayout<T>(kind: 'map' | 'map-compact' | 'steps' | 'screens' | 'flow', payload: unknown, options: unknown, done: (result: T) => void, fail: (error: string) => void): () => void {
  if (typeof Worker === 'undefined') {
    // 嵌入式宿主与测试环境没有 Worker，输入仍由调用方先做预算检查。
    try { done(calculateLayout(kind, payload, options as Record<string, unknown>) as T); }
    catch (error) { fail(String(error)); }
    return () => {};
  }
  const worker = new Worker(new URL('./graph-layout.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.error) fail(data.error);
    else done(data.result as T);
    worker.terminate();
  };
  worker.onerror = (event) => { fail(event.message || '布局计算失败'); worker.terminate(); };
  worker.postMessage({ kind, payload, options });
  return () => worker.terminate();
}
