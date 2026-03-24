type ToastTone = "error" | "info";

type WorkspaceLayoutOptions = {
  isPreviewVisible: boolean;
  isTocVisible: boolean;
};

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export const designSystem = {
  appShell:
    "grid h-full grid-rows-[1fr_auto] gap-4 p-[clamp(0.9rem,1.4vw,1.4rem)]",
  workspaceBase: "grid min-h-0 gap-4",
  workspaceLayouts: {
    all:
      "grid-cols-1 xl:grid-cols-[minmax(14rem,15rem)_minmax(0,1.08fr)_minmax(21.25rem,0.88fr)]",
    tocEditor:
      "grid-cols-1 xl:grid-cols-[minmax(14rem,15rem)_minmax(0,1fr)]",
    editorPreview:
      "grid-cols-1 xl:grid-cols-[minmax(0,1.16fr)_minmax(21.25rem,0.84fr)]",
    editorOnly: "grid-cols-1",
  },
  welcomeScreen: "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(20rem,25rem)_minmax(26rem,1fr)]",
  welcomeCard:
    "flex flex-col gap-2 rounded-[var(--radius-panel)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_82%,transparent),color-mix(in_srgb,var(--surface-base)_94%,transparent)),var(--surface-elevated)] p-[clamp(1.3rem,2vw,2rem)] shadow-lifted [backdrop-filter:blur(calc(var(--blur-glass)-2px))]",
  eyebrow:
    "m-0 text-label-upper font-bold tracking-label-upper text-primary uppercase",
  welcomeTitle:
    "m-0 max-w-[12ch] text-[clamp(2.5rem,4vw,var(--text-display-lg))] leading-display-lg tracking-display-lg font-bold",
  welcomeBody:
    "m-0 max-w-[34rem] text-body-lg leading-body-lg text-on-surface-variant",
  welcomeActions: "mt-3 flex flex-wrap gap-3",
  recentFilesHeader: "mb-2 flex items-center justify-between gap-4",
  recentFilesList: "flex flex-col gap-2",
  recentFileItem:
    "flex flex-col items-start gap-1 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--surface-section)_44%,white)] px-4 py-[0.95rem] text-left transition hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--surface-section)_28%,white)]",
  panel:
    "flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-ambient",
  panelToc:
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_72%,transparent),color-mix(in_srgb,var(--surface-section)_98%,transparent)),var(--surface-section)]",
  panelHeader:
    "flex min-h-[var(--panel-header-height)] items-center justify-between gap-4 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_56%,transparent),rgba(255,255,255,0)),var(--surface-section)] px-[1.15rem] py-[0.9rem] text-body-sm font-semibold tracking-[0.02em] text-on-surface-variant",
  panelMeta: "flex min-w-0 items-center gap-3",
  panelContent: "min-w-0",
  preview: "overflow-auto px-[1.35rem] pt-[1.35rem] pb-12",
  footerBar:
    "flex min-h-11 items-center justify-start gap-4 rounded-[var(--radius-card)] bg-glass-surface px-4 py-3 shadow-ambient [backdrop-filter:blur(var(--blur-glass))]",
  footerPath:
    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.88rem] text-on-surface-variant",
  footerPathButton:
    "cursor-copy bg-transparent p-0 text-left transition hover:text-on-surface focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-glow active:opacity-70",
  buttonBase:
    "rounded-[var(--radius-control)] px-4 py-[0.7rem] transition hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus-glow [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-standard)]",
  buttonPrimary:
    "[background-image:var(--button-primary-fill)] text-on-primary shadow-[0_10px_24px_var(--color-primary-shadow)] hover:[background-image:var(--button-primary-fill-hover)]",
  buttonSecondary: "bg-surface-container-high text-on-surface hover:bg-[color-mix(in_srgb,var(--color-surface-container-high)_72%,white)]",
  status:
    "max-w-[32rem] overflow-hidden text-ellipsis whitespace-nowrap text-body-sm font-medium text-on-surface-variant",
  statusDirty: "text-warning",
  toc: "flex flex-col gap-[0.3rem] overflow-auto p-[0.9rem]",
  tocItem:
    "block w-full rounded-[var(--radius-control)] bg-transparent py-2 pr-[0.7rem] text-left text-on-surface no-underline transition hover:bg-active-tint",
  tocEmpty: "m-0 p-2 text-on-surface-variant",
  dialogBackdrop:
    "fixed inset-0 grid place-items-center bg-scrim p-4 [backdrop-filter:blur(var(--blur-soft))]",
  dialogCard:
    "w-full max-w-[26rem] rounded-[var(--radius-panel)] bg-[color-mix(in_srgb,var(--surface-glass-strong)_92%,white)] p-[1.35rem] shadow-dialog",
  dialogTitle: "m-0 text-headline-lg leading-headline-lg tracking-headline-lg font-bold",
  dialogBody: "mt-[0.85rem] mb-0 text-on-surface-variant leading-body-lg",
  dialogActions: "mt-5 flex justify-end gap-2",
  toastBase:
    "fixed right-[1.4rem] bottom-[1.4rem] z-50 max-w-[min(28rem,calc(100vw-2.8rem))] rounded-[var(--radius-card)] px-4 py-[0.9rem] shadow-lifted [backdrop-filter:blur(calc(var(--blur-glass)-2px))]",
  toastByTone: {
    info: "bg-[color-mix(in_srgb,var(--surface-glass-strong)_92%,white)] text-on-surface",
    error: "bg-error text-on-error",
  } satisfies Record<ToastTone, string>,
  previewUriCard:
    "inline-flex max-w-full items-center gap-3 rounded-[var(--radius-control)] bg-[color-mix(in_srgb,var(--surface-section)_64%,white)] px-[0.9rem] py-3",
  previewUriLabel:
    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-on-surface",
  fileInput: "hidden",
} as const;

export function getWorkspaceLayoutClasses(options: WorkspaceLayoutOptions) {
  const layout = options.isTocVisible
    ? options.isPreviewVisible
      ? designSystem.workspaceLayouts.all
      : designSystem.workspaceLayouts.tocEditor
    : options.isPreviewVisible
      ? designSystem.workspaceLayouts.editorPreview
      : designSystem.workspaceLayouts.editorOnly;

  return joinClasses(designSystem.workspaceBase, layout);
}

export function getButtonClasses(tone: "primary" | "secondary") {
  return joinClasses(
    designSystem.buttonBase,
    tone === "primary" ? designSystem.buttonPrimary : designSystem.buttonSecondary,
  );
}

export function getStatusClasses(isDirty = false) {
  return joinClasses(designSystem.status, isDirty && designSystem.statusDirty);
}

export function getToastClasses(tone: ToastTone) {
  return joinClasses(designSystem.toastBase, designSystem.toastByTone[tone]);
}
