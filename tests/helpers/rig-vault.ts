// A small in-memory vault for the rig snapshot tests: notes and files by path, folders from the paths, create / process / read, no modify (a test fails if code rewrites a file).
import { TFile, TFolder } from "obsidian";

export function rigVault(initial: Record<string, string>) {
  const files = new Map<string, string>(Object.entries(initial));
  const folders = new Set<string>();
  const created: string[] = [];
  const parent = (p: string): string => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
  const file = (p: string): TFile => { const name = p.split("/").pop()!; const dot = name.lastIndexOf("."); return new TFile({ path: p, basename: dot < 0 ? name : name.slice(0, dot), extension: dot < 0 ? "" : name.slice(dot + 1), name } as never); };
  const get = (p: string): TFile | TFolder | null => {
    if (files.has(p)) return file(p);
    if (folders.has(p) || [...files.keys()].some(k => k.startsWith(p + "/"))) return new TFolder({ path: p, children: [...files.keys()].filter(k => parent(k) === p).map(file) });
    return null;
  };
  const app: any = {
    vault: {
      getAbstractFileByPath: get,
      cachedRead: async (f: TFile) => files.get(f.path)!,
      read: async (f: TFile) => files.get(f.path)!,
      create: async (p: string, text: string) => { if (files.has(p)) throw new Error("File already exists."); files.set(p, text); created.push(p); return file(p); },
      createFolder: async (p: string) => { folders.add(p); },
      process: async (f: TFile, fn: (d: string) => string) => { files.set(f.path, fn(files.get(f.path)!)); },
    },
    metadataCache: { getFirstLinkpathDest: (t: string) => [...files.keys()].find(k => k === t || k.endsWith("/" + t)) ? get([...files.keys()].find(k => k === t || k.endsWith("/" + t))!) as TFile : null },
    fileManager: { generateMarkdownLink: (f: TFile) => `[[${f.path}]]` },
  };
  return { app, files, created, file };
}
