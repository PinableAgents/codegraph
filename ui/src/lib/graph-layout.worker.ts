import { calculateLayout } from './graph-layout-runner';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: calculateLayout(data.kind, data.payload, data.options) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
