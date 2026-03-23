import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { slugifyHeading } from "../../lib/toc";

type MarkdownPreviewProps = {
  markdown: string;
};

function getTextContent(children: React.ReactNode): string {
  return Array.isArray(children)
    ? children.map(getTextContent).join("")
    : typeof children === "string" || typeof children === "number"
      ? String(children)
      : "";
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  return (
    <div className="preview markdown-body">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => {
            const id = slugifyHeading(getTextContent(children));
            return (
              <h1 id={id} {...props}>
                {children}
              </h1>
            );
          },
          h2: ({ children, ...props }) => {
            const id = slugifyHeading(getTextContent(children));
            return (
              <h2 id={id} {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const id = slugifyHeading(getTextContent(children));
            return (
              <h3 id={id} {...props}>
                {children}
              </h3>
            );
          },
          h4: ({ children, ...props }) => {
            const id = slugifyHeading(getTextContent(children));
            return (
              <h4 id={id} {...props}>
                {children}
              </h4>
            );
          },
          h5: ({ children, ...props }) => {
            const id = slugifyHeading(getTextContent(children));
            return (
              <h5 id={id} {...props}>
                {children}
              </h5>
            );
          },
          h6: ({ children, ...props }) => {
            const id = slugifyHeading(getTextContent(children));
            return (
              <h6 id={id} {...props}>
                {children}
              </h6>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
