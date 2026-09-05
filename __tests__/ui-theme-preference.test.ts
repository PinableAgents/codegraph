// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Web UI theme preference', () => {
  let host: HTMLElement;
  let dispose: (() => Promise<void>) | undefined;
  let waitForUpdate: () => Promise<void>;
  let storage: Storage;
  let failOnSet = false;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    failOnSet = false;
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '<div id="host"></div>';
    host = document.getElementById('host')!;

    const values = new Map<string, string>();
    storage = {
      get length() {
        return values.size;
      },
      clear() {
        values.clear();
      },
      getItem(key) {
        return values.get(key) ?? null;
      },
      key(index) {
        return [...values.keys()][index] ?? null;
      },
      removeItem(key) {
        values.delete(key);
      },
      setItem(key, value) {
        if (failOnSet) throw new Error('storage unavailable');
        values.set(key, value);
      },
    };
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(async () => {
    await dispose?.();
    dispose = undefined;
    vi.unstubAllGlobals();
  });

  async function renderTopBar(): Promise<HTMLElement> {
    const [{ mount, tick, unmount }, { default: TopBar }] = await Promise.all([
      import('svelte'),
      import('../ui/src/components/TopBar.svelte'),
    ]);
    const mounted = mount(TopBar, { target: host });
    dispose = () => unmount(mounted);
    waitForUpdate = tick;
    await waitForUpdate();
    const group = host.querySelector<HTMLElement>('[role="group"][aria-label="主题"]');
    expect(group).not.toBeNull();
    return group!;
  }

  function button(group: HTMLElement, label: string): HTMLButtonElement {
    const match = [...group.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label
    );
    expect(match, `缺少“${label}”主题按钮`).toBeDefined();
    return match!;
  }

  it('默认跟随系统，并可在三个主题间切换和保存', async () => {
    const group = await renderTopBar();

    expect(button(group, '自动').getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();

    button(group, '亮色').click();
    await waitForUpdate();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(storage.getItem('codegraph.ui.theme')).toBe('light');
    expect(button(group, '亮色').getAttribute('aria-pressed')).toBe('true');

    button(group, '暗色').click();
    await waitForUpdate();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.getItem('codegraph.ui.theme')).toBe('dark');

    button(group, '自动').click();
    await waitForUpdate();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(storage.getItem('codegraph.ui.theme')).toBe('auto');
  });

  it('启动时恢复已保存的主题', async () => {
    storage.setItem('codegraph.ui.theme', 'dark');

    const group = await renderTopBar();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(button(group, '暗色').getAttribute('aria-pressed')).toBe('true');
  });

  it('保存失败时仍切换当前会话主题', async () => {
    const group = await renderTopBar();
    failOnSet = true;

    button(group, '暗色').click();
    await waitForUpdate();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
