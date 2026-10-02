import type { ThemeMode } from "./preview-preferences";
import type { MenuState } from "./menu";

export type PreviewConnection = { ownerLabel: string; previewLabel: string; connectionId: string };
export type PreviewSnapshot = PreviewConnection & {
  sequence: number; documentRevision: number; editSequence: number;
  markdown: string; filePath: string | null; filename: string;
  activeLine: number | null; themeMode: ThemeMode; autoLoadExternalMedia: boolean;
  menuState: MenuState;
};

export function acceptPreviewSnapshot(current: Pick<PreviewSnapshot, "ownerLabel" | "connectionId" | "sequence">, incoming: Pick<PreviewSnapshot, "ownerLabel" | "connectionId" | "sequence">) {
  return current.ownerLabel === incoming.ownerLabel && current.connectionId === incoming.connectionId && incoming.sequence > current.sequence;
}

export function shouldResumePreview(previousEditSequence: number, editSequence: number) {
  return editSequence > previousEditSequence;
}
