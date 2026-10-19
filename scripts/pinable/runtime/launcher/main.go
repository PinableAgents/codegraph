// Pinable's shell-free launcher for the self-contained CodeGraph bundle.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

var componentVersion = "0.0.0-dev"

func bundleRoot(executable, configuredHome, version string) (string, error) {
	real, err := filepath.EvalSymlinks(executable)
	if err != nil {
		return "", err
	}
	dir := filepath.Dir(real)
	home := strings.TrimSpace(configuredHome)
	roots := []string{dir, filepath.Dir(dir)}
	if home != "" {
		if !filepath.IsAbs(home) {
			return "", fmt.Errorf("PINABLE_HOME must be an absolute path")
		}
		// An explicit home must never fall back to a different installation.
		roots = nil
	} else {
		home = filepath.Dir(dir)
	}
	if version == "" || version == "." || version == ".." || strings.ContainsAny(version, `/\:`) {
		return "", fmt.Errorf("invalid component version %q", version)
	}
	roots = append(roots, filepath.Join(home, "components", "codegraph", version))
	for _, root := range roots {
		node := "node"
		if runtime.GOOS == "windows" {
			node += ".exe"
		}
		ok := true
		for _, name := range []string{node, "lib/dist/bin/codegraph.js"} {
			info, err := os.Stat(filepath.Join(root, filepath.FromSlash(name)))
			if err != nil || !info.Mode().IsRegular() {
				ok = false
				break
			}
		}
		if ok {
			return root, nil
		}
	}
	return "", fmt.Errorf("bundled Node and lib/dist/bin/codegraph.js not found for version %s beside %s or in PINABLE_HOME/components/codegraph; extract the matching runtime archive first", version, real)
}

func childEnv(env []string, ppid int) []string {
	out := append([]string(nil), env...)
	// Desktop runtime is private by default; callers may explicitly opt in.
	defaults := map[string]string{"CODEGRAPH_TELEMETRY": "0", "DO_NOT_TRACK": "1", "CODEGRAPH_HOST_PPID": strconv.Itoa(ppid), "CODEGRAPH_NO_DOWNLOAD": "1"}
	for _, entry := range env {
		key, _, _ := strings.Cut(entry, "=")
		for name := range defaults {
			if key == name || (runtime.GOOS == "windows" && strings.EqualFold(key, name)) {
				delete(defaults, name)
			}
		}
	}
	for _, key := range []string{"CODEGRAPH_TELEMETRY", "DO_NOT_TRACK", "CODEGRAPH_HOST_PPID", "CODEGRAPH_NO_DOWNLOAD"} {
		if value, ok := defaults[key]; ok {
			out = append(out, key+"="+value)
		}
	}
	return out
}

func run() int {
	executable, err := os.Executable()
	if err != nil {
		fmt.Fprintln(os.Stderr, "codegraph:", err)
		return 1
	}
	root, err := bundleRoot(executable, os.Getenv("PINABLE_HOME"), componentVersion)
	if err != nil {
		fmt.Fprintln(os.Stderr, "codegraph:", err)
		return 1
	}
	name := "node"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	node := filepath.Join(root, name)
	args := []string{node, "--liftoff-only", "--disable-warning=ExperimentalWarning", filepath.Join(root, "lib", "dist", "bin", "codegraph.js")}
	args = append(args, os.Args[1:]...)
	return execute(node, args, childEnv(os.Environ(), os.Getppid()))
}
func main() { os.Exit(run()) }
