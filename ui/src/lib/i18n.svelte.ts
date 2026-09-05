export type Locale = 'zh-CN' | 'en';

const storageKey = 'codegraph.ui.locale';
const localeListeners = new Set<() => void>();

const visibleCopy: Record<string, string> = {
  'Nothing selected': '未选择任何内容',
  'Where to start': '从哪里开始',
  'All entry points ›': '所有入口点 ›',
  'The map could not be built': '无法构建地图',
  'Aggregating the graph by module…': '正在按模块汇总图谱…',
  'Nothing to draw here': '这里没有可绘制的内容',
  Flow: '调用流',
  'Which path to draw': '选择要绘制的路径',
  'The flow could not be built': '无法构建调用流',
  'Following the calls…': '正在跟踪调用…',
  'Nothing to follow yet': '暂无可跟踪内容',
  'No path between them': '两者之间没有路径',
  'No such view': '没有此视图',
  'the start': '起点',
  'Loading…': '正在加载…',
  'Called by': '被调用于',
  Calls: '调用',
  'open its current source': '打开当前源代码',
  'Imported by': '被导入于',
  generated: '生成文件',
  'read its current source': '阅读当前源代码',
  Imports: '导入',
  'Dead code': '死代码',
  'Reading the graph…': '正在读取图谱…',
  exported: '已导出',
  'The screens could not be read': '无法读取界面',
  'Reading screens and transitions…': '正在读取界面和跳转…',
  'No screen navigation in this graph': '此图谱中没有界面导航',
  'Transition — the destination is written at the call': '跳转——目标在调用处写明',
  "Destination inferred from a helper's return value": '目标由辅助函数的返回值推断',
  'Goes back up the picture (returning) — leaves the top of its box, arrives at the bottom of the other': '回到图的上游（返回）——从自身框顶端离开，到达另一框底端',
  'A screen — its path and the component that renders it': '一个界面——其路径和渲染它的组件',
  'The entry screen; each row down is one more transition away': '入口界面；每向下一行就多经过一次跳转',
  'Nothing reaches it from the entry (bottom band)': '入口无法到达它（底部带）',
  'What happens here →': '这里会发生什么 →',
  'Opens from': '打开自',
  'Goes to': '前往',
  'No navigation leaves this screen.': '没有导航离开此界面。',
  Screens: '界面',
  clear: '清除',
  'Most connected': '连接最多',
  'Entry points': '入口点',
  'Draw a flow': '绘制调用流',
  'a symbol it reaches': '它能到达的符号',
  'Draw the flow': '绘制调用流',
  Cancel: '取消',
  'Search results': '搜索结果',
  'Searching…': '正在搜索…',
  Trail: '路径',
  'Read as flow': '按调用流阅读',
  'Save trail': '保存路径',
  Clear: '清除',
  'Name this trail': '命名此路径',
  'How a request reaches the handler': '请求如何到达处理函数',
  'Download SVG': '下载 SVG',
  'Blast radius': '影响范围',
  'What would need re-checking if this changed': '如果这里变更，需要重新检查什么',
  Members: '成员',
  'Type hierarchy': '类型层级',
  'supertypes above · subtypes below': '超类型在上 · 子类型在下',
  Outline: '大纲',
  'in source order': '按源代码顺序',
  'Architecture map': '架构地图',
  Showing: '显示',
  files: '文件',
  'no files in the index for this module': '索引中没有此模块的文件',
  nothing: '无',
  'File view mode': '文件视图模式',
  Source: '源代码',
  'This viewer cannot draw steps': '此查看器无法绘制步骤',
  'The host it runs in has not wired the steps question. The Screens and Flow views still work.': '当前宿主没有接入步骤查询功能；界面和调用流视图仍可使用。',
  'What happens from where?': '从哪里发生什么？',
  'The steps could not be read': '无法读取步骤',
  'Walking from the anchor…': '正在从锚点追踪…',
  'This has no body to read in order': '这里没有可按顺序阅读的主体',
  'What it sets in motion →': '它会启动什么 →',
  'Start here →': '从这里开始 →',
  'Open as a flow →': '以调用流打开 →',
  'Arrives from': '到达自',
  'Leads to': '通向',
  'FIRES FROM': '由此触发',
  'and then': '然后',
  WHEN: '当',
  yes: '是',
  no: '否',
  'in order': '按顺序',
  'what it sets in motion': '它会启动什么',
  steps: '步骤',
  links: '连接',
  'Reading saved trails…': '正在读取已保存路径…',
  'Only the first trails in the directory are listed.': '仅列出目录中的前几个路径。',
  Export: '导出',
};

const translations = {
  'zh-CN': {
    'a11y.home': 'CodeGraph 首页',
    'a11y.indexedProject': '已索引项目',
    'a11y.language': '界面语言',
    'a11y.views': '视图',
    'language.chinese': '中文',
    'language.english': 'EN',
    'live.degraded': '实时更新已关闭',
    'live.degradedTitle': '{reason} 此页面不会再自动刷新，请在同步后重新加载。',
    'live.stopped': '非实时',
    'live.stoppedTitle': '与 CodeGraph UI 的连接已断开且不再重试。请聚焦此标签页以重试，或重新加载页面。',
    'nav.dead': '死代码',
    'nav.entry': '入口点',
    'nav.flow': '调用流',
    'nav.map': '地图',
    'nav.screens': '界面',
    'nav.steps': '步骤',
    'nav.symbol': '符号',
    'outline.showing': '显示 {shown} / {total} 个符号。',
    'search.label': '搜索符号和文件',
    'search.placeholder': '搜索符号或文件，或询问“execute 如何到达 getFile”——按 / 聚焦',
    'steps.cannotDraw': '此查看器无法绘制步骤',
    'steps.cannotDrawDetail': '当前宿主没有接入步骤查询功能；界面和调用流视图仍可使用。',
    'steps.fromWhere': '从哪里发生什么？',
    'steps.noTargets': '此图谱中没有界面或端点。请从搜索框打开一个符号，再选择',
    'steps.pickEndpoint': '选择一个端点，此视图会绘制它启动的全部内容——处理函数及其之前的调用、对数据库、队列和其他服务的调用，以及它可以发送的每个响应。每个步骤对应一个框，每条指向下一步的路径对应一条箭头，箭头上标出发生该步骤的条件。或者搜索一个符号并选择',
    'steps.pickScreen': '选择一个界面，此视图会绘制它启动的全部内容——处理函数、跨入原生代码的调用、返回的事件、写入的状态以及离开应用的请求。每个步骤对应一个框，每条指向下一步的路径对应一条箭头，箭头上标出发生该步骤的条件。或者搜索一个符号并选择',
    'steps.readingEndpoints': '正在读取端点…',
    'steps.readingScreens': '正在读取界面…',
    'steps.whatHappensHere': '这里会发生什么',
    'toast.indexUpdated': '索引已更新并重新加载',
  },
  en: {
    'a11y.home': 'CodeGraph home',
    'a11y.indexedProject': 'Indexed project',
    'a11y.language': 'Interface language',
    'a11y.views': 'Views',
    'language.chinese': '中文',
    'language.english': 'EN',
    'live.degraded': 'Live updates off',
    'live.degradedTitle': '{reason} This page no longer refreshes itself — reload it after a sync.',
    'live.stopped': 'Not live',
    'live.stoppedTitle': 'Lost the connection to CodeGraph UI and stopped retrying. Focus this tab to try again, or reload the page.',
    'nav.dead': 'Dead code',
    'nav.entry': 'Entry points',
    'nav.flow': 'Flow',
    'nav.map': 'Map',
    'nav.screens': 'Screens',
    'nav.steps': 'Steps',
    'nav.symbol': 'Symbol',
    'outline.showing': 'Showing {shown} of {total} symbols.',
    'search.label': 'Search symbols and files',
    'search.placeholder': 'Search a symbol or file, or ask “how does execute reach getFile” — press / to focus',
    'steps.cannotDraw': 'This viewer cannot draw steps',
    'steps.cannotDrawDetail': 'The host it runs in has not wired the steps question. The Screens and Flow views still work.',
    'steps.fromWhere': 'What happens from where?',
    'steps.noTargets': 'No screens or endpoints in this graph. Open a symbol from the search box and follow',
    'steps.pickEndpoint': 'Pick an endpoint and this view draws everything it sets in motion — its handler and what runs before it, the calls into the database, a queue, another service, and every response it can send — one box per step, an arrow for every way one leads to the next, and on each arrow the condition under which it happens. Or search a symbol and choose',
    'steps.pickScreen': 'Pick a screen and this view draws everything it sets in motion — its handlers, the calls that cross into native code, the events that come back, the state it writes, the requests that leave the app — one box per step, an arrow for every way one leads to the next, and on each arrow the condition under which it happens. Or search a symbol and choose',
    'steps.readingEndpoints': 'Reading endpoints…',
    'steps.readingScreens': 'Reading screens…',
    'steps.whatHappensHere': 'What happens from here',
    'toast.indexUpdated': 'Index updated · reloaded',
  },
} as const;

export type TranslationKey = keyof typeof translations['zh-CN'];
type TranslationValues = Record<string, string | number>;

export function translateVisibleText(text: string, targetLocale: Locale): string {
  if (targetLocale !== 'zh-CN') return text;
  const summary = /^(\d[\d,]*) symbols · (\d[\d,]*) edges · (\d[\d,]*) files indexed$/.exec(text);
  if (summary) return `${summary[1]} 个符号 · ${summary[2]} 条边 · 已索引 ${summary[3]} 个文件`;
  return visibleCopy[text] ?? text;
}

function isLocale(value: string | null): value is Locale {
  return value === 'zh-CN' || value === 'en';
}

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey);
    return isLocale(saved) ? saved : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

let locale = $state<Locale>(readLocale());

function translate(key: TranslationKey, values: TranslationValues = {}): string {
  return translations[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

export function assertTranslationKeys(): void {
  const chinese = Object.keys(translations['zh-CN']).sort();
  const english = Object.keys(translations.en).sort();
  if (chinese.length !== english.length || chinese.some((key, index) => key !== english[index])) {
    throw new Error('Translation keys must match for every locale.');
  }
}

export const i18n = {
  get locale(): Locale {
    return locale;
  },
  setLocale(next: Locale): void {
    locale = next;
    for (const listener of localeListeners) listener();
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // 当前会话的语言状态已更新，存储失败无需阻止界面切换。
    }
  },
  t(key: TranslationKey, values?: TranslationValues): string {
    return translate(key, values);
  },
};

export function localize(node: HTMLElement): { destroy: () => void } {
  const textSources = new WeakMap<Text, string>();
  const attributeSources = new WeakMap<Element, Map<string, string>>();
  const attributeNames = ['aria-label', 'placeholder', 'title'];

  const apply = (): void => {
    document.documentElement.lang = locale;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let current: Text | null;
    while ((current = walker.nextNode() as Text | null)) {
      const source = textSources.get(current) ?? current.data;
      textSources.set(current, source);
      const translated = translateVisibleText(source, locale);
      if (current.data !== translated) current.data = translated;
    }
    for (const element of [node, ...node.querySelectorAll('*')]) {
      let sources = attributeSources.get(element);
      for (const name of attributeNames) {
        const currentValue = element.getAttribute(name);
        if (currentValue === null) continue;
        sources ??= new Map();
        const source = sources.get(name) ?? currentValue;
        sources.set(name, source);
        const translated = translateVisibleText(source, locale);
        if (currentValue !== translated) element.setAttribute(name, translated);
      }
      if (sources) attributeSources.set(element, sources);
    }
  };

  const observer = new MutationObserver(apply);
  observer.observe(node, { childList: true, characterData: true, subtree: true });
  const removeListener = (() => {
    localeListeners.add(apply);
    return () => localeListeners.delete(apply);
  })();
  apply();
  return {
    destroy() {
      observer.disconnect();
      removeListener();
    },
  };
}
