from pathlib import Path
import json
import subprocess

FORK='d01ad7ad7fe5db5d3cc6745f9eb8877efbf6c4fa'
UPSTREAM='7639c787e48be92ea4ca83c5c014d8dd480de470'
def git(*args):
    return subprocess.check_output(['git',*args])
assert git('rev-parse','HEAD').decode().strip()==FORK
assert git('rev-parse','MERGE_HEAD').decode().strip()==UPSTREAM
assert git('diff','--name-only','--diff-filter=U').decode().splitlines()==[
    '__tests__/mcp-daemon.test.ts','package-lock.json','src/ui-server/api/map.ts',
    'ui/src/components/map/ModuleNode.svelte']
base=git('merge-base',FORK,UPSTREAM).decode().strip()
# Both branches now use the identical real-attachment barrier. The only fork
# delta was these three lines, now present upstream with equivalent comments.
p='__tests__/mcp-daemon.test.ts'
old=git('show',f'{base}:{p}').decode()
ours=git('show',f'{FORK}:{p}').decode()
barrier="    // The proxy answers initialize locally and the pidfile precedes listen.\n    // Wait for an actual daemon handshake before opening the raw client.\n    await waitFor(() => server.stderr.some((l) => l.includes('Attached to shared daemon')), 10000);\n"
assert ours.count(barrier)==1 and ours.replace(barrier,'')==old
upstream=git('show',f'{UPSTREAM}:{p}')
assert b"await waitFor(() => server.stderr.some((l) => l.includes('Attached to shared daemon')), 10000);" in upstream
Path(p).write_bytes(upstream)

# Merge lockfile data structurally, not by choosing an entire dependency tree.
# Independent dependency additions survive; an actual conflicting value stops.
missing=object()
def merge(b,o,t,path=''):
    if o==t or t==b: return o
    if o==b: return t
    # Pinable removed XYFlow and its unused d3-selection dependency. Upstream
    # only removed that package's peer flag; do not restore the deleted graph stack.
    if path=='/packages/node_modules/d3-selection' and o is missing:
        assert t=={k:v for k,v in b.items() if k!='peer'}
        return missing
    if all(isinstance(v,dict) for v in (b,o,t)):
        out={}
        for k in dict.fromkeys([*o,*t,*b]):
            v=merge(b.get(k,missing),o.get(k,missing),t.get(k,missing),path+'/'+k)
            if v is not missing: out[k]=v
        return out
    raise RuntimeError('Unreviewed lockfile value conflict at '+path)
p='package-lock.json'
b,o,t=[json.loads(git('show',f'{rev}:{p}')) for rev in (base,FORK,UPSTREAM)]
lock=merge(b,o,t)
lock['packages']['ui']['version']=json.loads(Path('ui/package.json').read_text())['version']
for name,record in o['packages'].items():
    if name not in ('','ui'):
        assert name in lock['packages'], 'Lost fork dependency '+name
        for key in ('version','resolved','integrity'):
            assert lock['packages'][name].get(key)==record.get(key), (name,key)
assert lock['packages']['ui']['dependencies']['@antv/g6']=='5.1.1'
assert lock['version']==lock['packages']['']['version']=='1.6.1'
Path(p).write_text(json.dumps(lock,ensure_ascii=False,indent=2)+'\n')

# Keep fork test filtering before the budget and upstream chain IDs/labels.
p=Path('src/ui-server/api/map.ts');s=p.read_text()
start=s.index('<<<<<<< HEAD');end=s.index('>>>>>>> '+UPSTREAM,start)+len('>>>>>>> '+UPSTREAM)
assert s.count('<<<<<<< HEAD')==s.count('>>>>>>> '+UPSTREAM)==1
s=s[:start]+'''    if (!includeTests && file.test) continue;
    const at = moduleIdFor(file.path, root, depth, passThrough);
    if (at === null) continue;
    assigned.set(file.path, at);
    labelOf.set(at.id, at.label);'''+s[end:]
p.write_text(s)

# Pinable replaced this legacy renderer with G6. G6 already consumes the
# module label and retains the full module ID. Do not resurrect dead code.
subprocess.run(['git','rm','--','ui/src/components/map/ModuleNode.svelte'],check=True)

p=Path('__tests__/ui-workbench-api.test.ts')
p.write_text(p.read_text()+'''

it.each([false, true])('upstream compact module labels retain Pinable test filtering (bounded=%s)', (bounded) => {
  const prefix = 'src/main/java/org/example/app';
  const files = [`${prefix}/App.ts`, `${prefix}/core/a.ts`, `${prefix}/services/b.ts`];
  for (const file of files) {
    q.upsertFile({ path: file, language: 'typescript', contentHash: 'x', size: 1,
      modifiedAt: 1, indexedAt: 1, nodeCount: 1 });
    q.insertNodes([{ ...n(file), filePath: file }]);
  }
  q.insertEdges([{ source: files[1]!, target: files[2]!, kind: 'calls', confidence: 1 }]);
  for (let i = 0; i < 405; i++) {
    q.upsertFile({ path: `src/tests/group${i}/unit.test.ts`, language: 'typescript',
      contentHash: 'test', size: 1, modifiedAt: 1, indexedAt: 1, nodeCount: 1 });
  }
  const result = buildMap(cg, root, new URLSearchParams({
    root: 'src', depth: '2', tests: '0', bounded: bounded ? '1' : '0',
  }));
  expect(result.budget?.exceeded).not.toBe(true);
  expect(result.modules.map(module => module.id).sort()).toEqual([
    `${prefix}/(root files)`, `${prefix}/core`, `${prefix}/services`,
  ].sort());
  expect(result.modules.find(module => module.id === `${prefix}/core`)?.label)
    .toBe('src/main/…/app/core');
  expect(result.modules.every(module => !module.test)).toBe(true);
  expect(result.links).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: `${prefix}/core`, target: `${prefix}/services`, count: 1 }),
  ]));
  const withTests = buildMap(cg, root, new URLSearchParams('root=src&depth=2&tests=1&bounded=1'));
  expect(withTests.budget?.exceeded).toBe(true);
});
''')
p=Path('__tests__/ui-package.test.ts')
p.write_text(p.read_text()+'''

it('G6 keeps upstream compact module labels without changing full-path selection IDs', async () => {
  const { graphScene } = await import('../ui/src/lib/graph-adapters');
  const id = 'src/main/java/org/example/app/core';
  const module = { id, label: 'src/main/…/app/core', files: 2, symbols: 3 };
  const scene = graphScene('map', [{ id, type: 'module', position: { x: 0, y: 0 },
    data: { layout: { module, width: 240, height: 64 } } }], []);
  expect(scene.nodes).toHaveLength(1);
  expect(scene.nodes[0]).toMatchObject({ id, label: module.label, width: 240, height: 64 });
});
''')
p=Path('FORK.md')
s=p.read_text();anchor='在本仓库中使用 Node 22.5+（低于 25）：\n'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'\n自上游 1.6.1 同步起，浏览器 UI 入口需要显式设置 `CODEGRAPH_UI=1`；`ui`、`web` 和多项目工作区均适用。macOS/Linux 使用 `export CODEGRAPH_UI=1`，PowerShell 使用 `$env:CODEGRAPH_UI = \'1\'`。未设置时上游入口会提示浏览器 UI 尚未发布，后端索引与 MCP 不受影响。现有 G6 工作台没有删除。\n')
p.write_text(s)
files=['__tests__/mcp-daemon.test.ts','package-lock.json','src/ui-server/api/map.ts',
       '__tests__/ui-workbench-api.test.ts','__tests__/ui-package.test.ts','FORK.md']
subprocess.run(['git','add','--',*files],check=True)
subprocess.run(['node','scripts/pinable/sync-upstream.mjs','--finish'],check=True)
subprocess.run(['git','diff','--cached','--check'],check=True)
print('Reviewed merge tree:',git('write-tree').decode().strip())
