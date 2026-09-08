import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const harness=vi.hoisted(()=>({graphs:[] as any[],routes:[] as any[]}));
vi.mock('@antv/g6',()=>({register(){},ExtensionCategory:{EDGE:'edge'},BaseEdge:class{},Polyline:class{},Graph:class{
  events=new Map();data:any;render=vi.fn(async()=>{});draw=vi.fn(async()=>{});destroy=vi.fn();setElementState=vi.fn(async()=>{});
  constructor(){harness.graphs.push(this);}on(name:string,fn:any){this.events.set(name,fn);if(name==='aftertransform')fn();}
  setData(data:any){this.data=data;}updateEdgeData(){}setSize(){}setPlugins(){}getZoom(){return 1;}
  getViewportByCanvas(){return [0,0];}async fitView(){}async zoomTo(){}async translateTo(){}async focusElement(){}
}}));
vi.mock('../ui/src/lib/graph-layout',()=>({requestLayout:(_kind:any,_payload:any,_options:any,done:any)=>{const cancel=vi.fn();harness.routes.push({done,cancel});return cancel;}}));
import {G6Runtime} from '../ui/src/lib/g6-runtime';
import type {GraphScene} from '../ui/src/lib/graph-scene';
const scene=():GraphScene=>({kind:'map',nodes:['a','b'].map((id,i)=>({id,x:i*300,y:0,width:200,height:48,label:id,sub:'',kind:'module'})),edges:[{id:'ab',source:'a',target:'b',originalIds:['ab'],label:'1',width:1.5}],relations:[{id:'ab',source:'a',target:'b'}],groups:[]});
let runtime:G6Runtime;
beforeEach(()=>{
  harness.graphs=[];harness.routes=[];
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
  vi.stubGlobal('getComputedStyle',()=>({getPropertyValue:()=>''}));
  const Observer=class{observe(){}disconnect(){}};vi.stubGlobal('ResizeObserver',Observer);vi.stubGlobal('MutationObserver',Observer);
  runtime=new G6Runtime({clientWidth:1000,clientHeight:800,dataset:{},parentElement:null} as any,{select(){},move(){},viewport(){},error:message=>{if(message)throw new Error(message);}});
});
afterEach(()=>{runtime.destroy();vi.unstubAllGlobals();});
describe('G6 lifecycle and incremental state',()=>{
  it('selection, hover labels and path highlighting do not render or reroute geometry',async()=>{
    const data=scene();await runtime.update(data,new Set(),new Set());
    data.nodes[0]!.selected=true;data.edges[0]!.label='→ 8 · ← 2';data.edges[0]!.hot=true;
    await runtime.update(data,new Set(),new Set(['ab']));
    expect(harness.graphs[0].render).toHaveBeenCalledTimes(1);
    expect(harness.graphs[0].setElementState).toHaveBeenCalled();expect(harness.routes).toHaveLength(0);
  });
  it('cancels stale routing and ignores its late result',async()=>{
    const large=scene();large.edges=Array.from({length:101},(_,i)=>({...large.edges[0]!,id:`e${i}`}));
    const first=runtime.update(large,new Set(),new Set());await Promise.resolve();await Promise.resolve();
    expect(harness.routes).toHaveLength(1);
    const next=scene();next.nodes[0]!.x=777;
    const second=runtime.update(next,new Set(),new Set());
    harness.routes[0].done({});await first;await second;
    expect(harness.routes[0].cancel).toHaveBeenCalledOnce();
    expect(harness.graphs[0].data.nodes[0].style.x).toBe(877);
    expect(harness.graphs[0].render).toHaveBeenCalledOnce();
  });
  it('destroy is idempotent and prevents pending tasks from rendering',async()=>{
    const pending=runtime.update(scene(),new Set(),new Set());runtime.destroy();runtime.destroy();await pending;
    expect(harness.graphs[0].destroy).toHaveBeenCalledOnce();expect(harness.graphs[0].render).not.toHaveBeenCalled();
  });
});
