import { useMemo } from "react";
import { openExternalUri } from "../../lib/external-link";
import { renderPreviewHtml } from "../../lib/preview-renderer";

type MarkdownPreviewProps = {
  markdown: string;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
};

export function MarkdownPreview({
  markdown,
  filePath,
  isExternalMediaAutoLoadEnabled,
}: MarkdownPreviewProps) {
  const previewHtml = useMemo(() => {
    return renderPreviewHtml({
      filePath,
      isExternalMediaAutoLoadEnabled,
      markdown,
    });
  }, [filePath, isExternalMediaAutoLoadEnabled, markdown]);

  return (
    <div
      className="markdown-preview"
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const openButton = target.closest<HTMLElement>("[data-preview-open-uri]");
        const openUri = openButton?.dataset.previewOpenUri;
        if (openUri) {
          event.preventDefault();
          void openExternalUri(openUri);
          return;
        }

        const uriElement = target.closest<HTMLElement>("[data-preview-uri]");
        const previewUri = uriElement?.dataset.previewUri;
        if (!previewUri) {
          return;
        }

        event.preventDefault();
        void openExternalUri(previewUri);
      }}
      onAuxClick={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const uriElement = target.closest<HTMLElement>("[data-preview-uri]");
        const previewUri = uriElement?.dataset.previewUri;
        if (!previewUri) {
          return;
        }

        event.preventDefault();
        void openExternalUri(previewUri);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const openButton = target.closest<HTMLElement>("[data-preview-open-uri]");
        const openUri = openButton?.dataset.previewOpenUri;
        if (openUri) {
          event.preventDefault();
          void openExternalUri(openUri);
          return;
        }

        const uriElement = target.closest<HTMLElement>("[data-preview-uri]");
        const previewUri = uriElement?.dataset.previewUri;
        if (!previewUri) {
          return;
        }

        event.preventDefault();
        void openExternalUri(previewUri);
      }}
    >
      <div
        className="markdown-preview__content"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </div>
  );
}
