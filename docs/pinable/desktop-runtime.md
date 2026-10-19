# Pinable Desktop CodeGraph 运行时交付

## 构建与发布

独立工作流 `.github/workflows/pinable-desktop-runtime.yml` 在 main 提交和 PR 时提前构建、验证六个平台的组件。它生成完整运行时，不生成 Wails 安装包，也不发布上游 npm 包。

在 GitHub Actions 的 **Pinable desktop runtimes** 中手动运行：

- `publish=false`（默认）：全部质量检查和原生验证通过后，提供 `pinable-codegraph-all-platforms` artifact，保留 30 天。
- `publish=true`：仅 main 可发布。创建稳定 GitHub Release，tag 为 `pinable-runtime-v<package-version>-<source-sha前12位>`，保持 `latest=false`，不改变上游 `v*` 发布。

也可以使用 GitHub CLI：

```bash
gh workflow run pinable-desktop-runtime.yml --repo PinableAgents/codegraph --ref main -f publish=true
```

发布前重新验证完整产物集合、源码 SHA、每个目标的 smoke 证据与 SHA256SUMS。只有 main 仍指向该源码时才原子创建新 tag。随后创建 draft、上传资产、复核 tag 和 main、检查 GitHub 返回的每个资产的大小和 SHA256，最后转为稳定 Release。既有 tag、资产均不覆盖；上传失败或竞态保留 draft/已预留 tag，供维护者检查。已发布资产不要删改，应提交新的源码版本后再发布。

## 六平台产物

| 目标 | 压缩包 | 独立启动器 |
| --- | --- | --- |
| darwin-arm64 | `codegraph_darwin_arm64.zip` | `codegraph-launcher_darwin_arm64` |
| darwin-x64 | `codegraph_darwin_amd64.zip` | `codegraph-launcher_darwin_amd64` |
| linux-x64 | `codegraph_linux_amd64.zip` | `codegraph-launcher_linux_amd64` |
| linux-arm64 | `codegraph_linux_arm64.zip` | `codegraph-launcher_linux_arm64` |
| win32-x64 | `codegraph_windows_amd64.zip` | `codegraph-launcher_windows_amd64.exe` |
| win32-arm64 | `codegraph_windows_arm64.zip` | `codegraph-launcher_windows_arm64.exe` |

所有平台统一 ZIP，条目只包含普通文件和目录；内部 npm 链接在打包时解引用，禁止链接指向 bundle 外。压缩包根目录仍为 `codegraph-<target>/`，包含 Node、`lib/dist`、生产依赖、必需原生 kernel、SQLite schema、viewer、WASM grammars、许可证、`runtime.json` 和 `bin/codegraph[.exe]`。

每个目标还有 `codegraph-<target>.json` 和 `codegraph-<target>.smoke.json`。完整集合提供 `codegraph-runtime-manifest.json` 与 `SHA256SUMS`，共 26 个发布文件。清单记录平台、源码、组件版本、合约版本、Node 发行来源及压缩包/启动器的大小和 SHA256；原生 smoke 报告绑定实际测试的两份资产哈希。

Actions 下载的是外层 artifact ZIP，应先解开它。内部表格中的 ZIP 才是组件压缩包。`pinable-codegraph-manifest` artifact 可单独下载清单。

## 首次启用安装契约

生产者清单是 Desktop 锁文件的审核输入，不能直接覆盖 `pinable-desktop/internal/assets/codegraph/component-lock.json`。Desktop 应固定 Release tag、源码 SHA、目标、文件名和哈希；本仓库不自动更新消费者锁，也不实现 Desktop 的首次启用下载逻辑。

消费者安装时核验固定来源、归档与启动器哈希，去掉归档的 `codegraph-<target>/` 外层目录，保持现有布局：

```text
PINABLE_HOME/
  bin/codegraph[.exe]
  components/codegraph/<componentVersion>/
    node[.exe]
    lib/dist/bin/codegraph.js
    lib/kernel/codegraph-kernel.node
    runtime.json
    LICENSE
    LICENSES/
```

独立启动器安装为 `bin/codegraph[.exe]`，Unix 需设置可执行权限。`componentVersion` 为清单中的包版本，构建时写入启动器；源码身份由独立 SHA/hash 锁定。启动器优先使用显式的绝对路径 `PINABLE_HOME`，未设置时从自身 `bin/` 位置推导 home，也支持在完整 bundle 根目录或 `bin/` 中直接执行。显式 home 无效或版本不匹配会失败，不使用系统 Node 或其他安装代替。

启动器直接传递参数、stdio 和退出码。Unix 使用 exec 保留 PID/信号；Windows 在启动 Node 前建立 kill-on-close Job Object，终止启动器会回收 Node，无法建立约束时直接失败。默认关闭遥测和运行时自动下载，保留调用方显式环境设置。组件首次下载、取消、重试、缓存与原子安装由后续 Desktop 改造负责。

## 验证与签名边界

应用构建一次，用 `npm ci --omit=dev --ignore-scripts` 安装锁定生产依赖。六个目标各自在原生 runner 上从 Cargo.lock 构建 kernel 和 Go 启动器。Node 固定为 `.pinable/runtime.json` 中的 v24.21.0，从官方 HTTPS 源下载，并在解压前核对官方 SHASUMS256.txt。该校验不是 GPG 或代码签名验证。

每个目标对实际 ZIP 解压后的文件执行：Node 版本和平台、SQLite/FTS5、原生 kernel 合约与提取、首次索引和增量同步、文件监听、CLI 成功/失败退出码、stdio MCP initialize/tools-list/EOF 退出。还将同一 bundle 移入含中文和空格的 Desktop 布局，使用独立启动器分别验证显式 PINABLE_HOME 和自动推导 home。缺 kernel、viewer/WASM、目标不全、混合源码或 smoke 哈希不符时禁止汇总发布。

`collect` 等待完整 engine/UI 和原生 kernel 质量检查及六平台 smoke 全部通过；只有发布 job 获得 contents:write，使用当前工作流的 GitHub token。Rust stable、Go 1.26.x 和 runner 镜像会更新，清单记录实际工具链，不承诺不同工具链的字节完全一致。

运行时不添加 Pinable Developer ID、notarization 或 Authenticode 签名。官方 Node 可能自带上游签名，不等同整包签名；原生 smoke 也不替代 Gatekeeper、SmartScreen 或 Wails 安装包验收。macOS 两个架构分开交付，Universal 2 Desktop 仍需消费者处理。

## 本地维护

```bash
python -m unittest discover -s scripts/pinable/runtime -p 'test_*.py' -v
(cd scripts/pinable/runtime/launcher && go test ./...)
node --test scripts/pinable/runtime/test-watch-probe.cjs
```

真实打包要求先提交源码。暂存、压缩包与原生构建输出写入被 Git 忽略的 `release/`、`codegraph-kernel/target/`，不会安装到用户 PINABLE_HOME，也不修改已有用户索引和数据。

Windows 保持 Node >=24.21.0，以包含原先 8.3 短路径文件监听崩溃的修复；smoke 使用真实路径监听，不通过关闭监听或规范化 fixture 路径绕过问题。
