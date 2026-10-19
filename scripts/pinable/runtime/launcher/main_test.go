package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestBundleRoot(t *testing.T) {
	for _, location := range []string{"root", "bin"} {
		t.Run(location, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "含 空格 runtime")
			node := "node"
			if runtime.GOOS == "windows" {
				node += ".exe"
			}
			for _, name := range []string{node, "lib/dist/bin/codegraph.js", "bin/launcher", "launcher"} {
				file := filepath.Join(root, filepath.FromSlash(name))
				if err := os.MkdirAll(filepath.Dir(file), 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(file, []byte("fixture"), 0755); err != nil {
					t.Fatal(err)
				}
			}
			executable := filepath.Join(root, "launcher")
			if location == "bin" {
				executable = filepath.Join(root, "bin", "launcher")
			}
			canonical, err := filepath.EvalSymlinks(root)
			if err != nil {
				t.Fatal(err)
			}
			found, err := bundleRoot(executable, "", "1.6.2")
			if err != nil || found != canonical {
				t.Fatalf("got %q, %v", found, err)
			}
			if err := os.Remove(filepath.Join(root, node)); err != nil {
				t.Fatal(err)
			}
			if _, err := bundleRoot(executable, "", "1.6.2"); err == nil {
				t.Fatal("accepted missing bundled Node")
			}
		})
	}
}
func TestEnv(t *testing.T) {
	env := []string{"PATH=unchanged", "CODEGRAPH_TELEMETRY=1", "CODEGRAPH_HOST_PPID=42"}
	result := childEnv(env, 99)
	joined := "\n" + strings.Join(result, "\n") + "\n"
	for _, want := range []string{"PATH=unchanged", "CODEGRAPH_TELEMETRY=1", "DO_NOT_TRACK=1", "CODEGRAPH_HOST_PPID=42", "CODEGRAPH_NO_DOWNLOAD=1"} {
		if !strings.Contains(joined, "\n"+want+"\n") {
			t.Fatalf("missing %s: %v", want, result)
		}
	}
	if len(env) != 3 {
		t.Fatal("mutated caller environment")
	}
	if len(childEnv(nil, 99)) != 4 {
		t.Fatal("defaults missing")
	}
}

func TestManagedBundleRoot(t *testing.T) {
	home := filepath.Join(t.TempDir(), "含 空格 home")
	root := filepath.Join(home, "components", "codegraph", "1.6.2")
	node := "node"
	if runtime.GOOS == "windows" {
		node += ".exe"
	}
	launcher := filepath.Join(home, "bin", "codegraph")
	for _, name := range []string{filepath.Join(root, node), filepath.Join(root, "lib", "dist", "bin", "codegraph.js"), launcher} {
		if err := os.MkdirAll(filepath.Dir(name), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(name, []byte("fixture"), 0755); err != nil {
			t.Fatal(err)
		}
	}
	for _, configured := range []string{"", home} {
		found, err := bundleRoot(launcher, configured, "1.6.2")
		if err != nil {
			t.Fatal(err)
		}
		canonical, err := filepath.EvalSymlinks(found)
		if err != nil {
			t.Fatal(err)
		}
		want, err := filepath.EvalSymlinks(root)
		if err != nil || canonical != want {
			t.Fatalf("got %q, want %q: %v", canonical, want, err)
		}
	}
	for _, version := range []string{"1.6.1", "../1.6.2", "..", "", `C:\other`} {
		if _, err := bundleRoot(launcher, home, version); err == nil {
			t.Fatalf("accepted version %q", version)
		}
	}
	if _, err := bundleRoot(launcher, "relative", "1.6.2"); err == nil {
		t.Fatal("accepted relative home")
	}
	if _, err := bundleRoot(launcher, t.TempDir(), "1.6.2"); err == nil {
		t.Fatal("fell back from explicit missing home")
	}
}
