import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Web UI i18n', () => {
  let storage: Storage;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
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
        values.set(key, value);
      },
    };
    vi.stubGlobal('localStorage', storage);
  });

  it('默认以中文显示固定文案', async () => {
    const { i18n } = await import('../ui/src/lib/i18n.svelte');

    expect(i18n.locale).toBe('zh-CN');
    expect(i18n.t('nav.map')).toBe('地图');
  });

  it('读取已保存的英文偏好', async () => {
    storage.setItem('codegraph.ui.locale', 'en');

    const { i18n } = await import('../ui/src/lib/i18n.svelte');

    expect(i18n.locale).toBe('en');
    expect(i18n.t('nav.map')).toBe('Map');
  });

  it('切换语言后更新翻译并保存偏好', async () => {
    const { i18n } = await import('../ui/src/lib/i18n.svelte');

    i18n.setLocale('en');

    expect(i18n.t('outline.showing', { shown: 2, total: 5 })).toBe('Showing 2 of 5 symbols.');
    expect(storage.getItem('codegraph.ui.locale')).toBe('en');
  });

  it('保存偏好失败时仍切换当前会话语言', async () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const { i18n } = await import('../ui/src/lib/i18n.svelte');

    i18n.setLocale('en');

    expect(i18n.locale).toBe('en');
    expect(i18n.t('nav.map')).toBe('Map');
  });

  it('为中文界面翻译嵌入模板的固定文案', async () => {
    const { translateVisibleText } = await import('../ui/src/lib/i18n.svelte');

    expect(translateVisibleText('Nothing selected', 'zh-CN')).toBe('未选择任何内容');
    expect(translateVisibleText('Nothing selected', 'en')).toBe('Nothing selected');
    expect(translateVisibleText('13 symbols · 46 edges · 593 files indexed', 'zh-CN')).toBe(
      '13 个符号 · 46 条边 · 已索引 593 个文件'
    );
  });
});
