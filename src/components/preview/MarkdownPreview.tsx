import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  openExternalUri,
  resolvePreviewUri,
  type ResolvedPreviewUri,
} from "../../lib/external-link";
import { slugifyHeading } from "../../lib/toc";
import { Button } from "../ui";

type MarkdownPreviewProps = {
  markdown: string;
  filePath: string | null;
  isExternalMediaAutoLoadEnabled: boolean;
};

const ALLOWED_MARKDOWN_ELEMENTS = [
  "a",
  "audio",
  "blockquote",
  "br",
  "code",
  "del",
  "details",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "input",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "summary",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
  "video",
] as const;

function getTextContent(children: React.ReactNode): string {
  return Array.isArray(children)
    ? children.map(getTextContent).join("")
    : typeof children === "string" || typeof children === "number"
      ? String(children)
      : "";
}

function getExternalUri(rawUri: string | undefined, filePath: string | null): string | null {
  if (!rawUri) {
    return null;
  }

  const resolved = resolvePreviewUri(rawUri, filePath);
  return resolved.kind === "external" ? resolved.uri : null;
}

async function handleExternalUriActivation(resolved: ResolvedPreviewUri) {
  if (resolved.kind !== "external") {
    return;
  }

  await openExternalUri(resolved.uri);
}

export function MarkdownPreview({
  markdown,
  filePath,
  isExternalMediaAutoLoadEnabled,
}: MarkdownPreviewProps) {
  return (
    <div
      className="markdown-preview"
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
    >
      <div className="markdown-preview__content">
        <ReactMarkdown
          allowedElements={[...ALLOWED_MARKDOWN_ELEMENTS]}
          rehypePlugins={[rehypeRaw]}
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => {
              const id = slugifyHeading(getTextContent(children));
              return <h1 id={id}>{children}</h1>;
            },
            h2: ({ children }) => {
              const id = slugifyHeading(getTextContent(children));
              return <h2 id={id}>{children}</h2>;
            },
            h3: ({ children }) => {
              const id = slugifyHeading(getTextContent(children));
              return <h3 id={id}>{children}</h3>;
            },
            h4: ({ children }) => {
              const id = slugifyHeading(getTextContent(children));
              return <h4 id={id}>{children}</h4>;
            },
            h5: ({ children }) => {
              const id = slugifyHeading(getTextContent(children));
              return <h5 id={id}>{children}</h5>;
            },
            h6: ({ children }) => {
              const id = slugifyHeading(getTextContent(children));
              return <h6 id={id}>{children}</h6>;
            },
            p: ({ children }) => <p>{children}</p>,
            blockquote: ({ children }) => <blockquote>{children}</blockquote>,
            ul: ({ children }) => <ul>{children}</ul>,
            ol: ({ children }) => <ol>{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            pre: ({ children }) => <pre>{children}</pre>,
            code: ({ children }) => <code>{children}</code>,
            em: ({ children }) => <em>{children}</em>,
            strong: ({ children }) => <strong>{children}</strong>,
            del: ({ children }) => <del>{children}</del>,
            hr: () => <hr />,
            br: () => <br />,
            table: ({ children }) => <table>{children}</table>,
            thead: ({ children }) => <thead>{children}</thead>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => <tr>{children}</tr>,
            th: ({ children }) => <th>{children}</th>,
            td: ({ children }) => <td>{children}</td>,
            details: ({ children, open }) => <details open={open}>{children}</details>,
            summary: ({ children }) => <summary>{children}</summary>,
            input: ({ checked, disabled, type }) => (
              <input checked={checked} disabled={disabled} readOnly type={type} />
            ),
            a: ({ children, href }) => {
              const resolved = href
                ? resolvePreviewUri(href, filePath)
                : { kind: "invalid" as const };
              const externalUri = resolved.kind === "external" ? resolved.uri : null;

              return (
                <a
                  data-preview-uri={externalUri ?? undefined}
                  href={externalUri ?? undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleExternalUriActivation(resolved);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }

                    event.preventDefault();
                    void handleExternalUriActivation(resolved);
                  }}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {children}
                </a>
              );
            },
            img: ({ alt, src }) => {
              const externalUri = getExternalUri(src, filePath);

              if (isExternalMediaAutoLoadEnabled && externalUri) {
                return <img alt={alt} src={externalUri} />;
              }

              return (
                <span
                  className="markdown-preview__media-card"
                  data-preview-uri={externalUri ?? undefined}
                >
                  <span>
                    {alt?.trim() || "External media"}
                  </span>
                  <Button
                    disabled={!externalUri}
                    onClick={() => {
                      if (!externalUri) {
                        return;
                      }

                      void openExternalUri(externalUri);
                    }}
                  >
                    Open externally
                  </Button>
                </span>
              );
            },
            video: ({ children, src }) => {
              const externalUri = getExternalUri(src, filePath);

              if (isExternalMediaAutoLoadEnabled && externalUri) {
                return (
                  <video controls src={externalUri}>
                    {children}
                  </video>
                );
              }

              return (
                <span
                  className="markdown-preview__media-card"
                  data-preview-uri={externalUri ?? undefined}
                >
                  <span>External video</span>
                  <Button
                    disabled={!externalUri}
                    onClick={() => {
                      if (!externalUri) {
                        return;
                      }

                      void openExternalUri(externalUri);
                    }}
                  >
                    Open externally
                  </Button>
                </span>
              );
            },
            audio: ({ children, src }) => {
              const externalUri = getExternalUri(src, filePath);

              if (isExternalMediaAutoLoadEnabled && externalUri) {
                return (
                  <audio controls src={externalUri}>
                    {children}
                  </audio>
                );
              }

              return (
                <span
                  className="markdown-preview__media-card"
                  data-preview-uri={externalUri ?? undefined}
                >
                  <span>External audio</span>
                  <Button
                    disabled={!externalUri}
                    onClick={() => {
                      if (!externalUri) {
                        return;
                      }

                      void openExternalUri(externalUri);
                    }}
                  >
                    Open externally
                  </Button>
                </span>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
