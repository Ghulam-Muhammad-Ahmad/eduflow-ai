import { ReactNode } from "react";
import { format } from "date-fns";
import type { WorksheetTemplate } from "@/types/worksheet";
import { cn } from "@/lib/utils";

interface WorksheetTemplateLayoutProps {
  template: WorksheetTemplate;
  children: ReactNode;
  /** Optional title to show in header (when template.layout.header.showTitle) */
  title?: string;
  /** Optional className for the wrapper */
  className?: string;
  /** Ref for the content area (e.g. for PDF export) */
  contentRef?: React.RefObject<HTMLDivElement>;
  /** When true, used for print/PDF so we don't add interactive padding */
  forPrint?: boolean;
}

export function WorksheetTemplateLayout({
  template,
  children,
  title,
  className,
  contentRef,
  forPrint,
}: WorksheetTemplateLayoutProps) {
  const { layout, styles } = template;
  const marginStyle = {
    marginTop: layout.margins.top,
    marginBottom: layout.margins.bottom,
    marginLeft: layout.margins.left,
    marginRight: layout.margins.right,
  };

  return (
    <div
      className={cn("worksheet-print-root", className)}
      style={{
        fontFamily: styles.fontFamily,
        color: styles.primaryColor,
        ...marginStyle,
      }}
    >
      {layout.header.showTitle && title && (
        <header className="border-b pb-2 mb-4" style={{ borderColor: styles.primaryColor }}>
          <h1
            className="font-bold"
            style={{
              fontSize: styles.headingSize,
              color: styles.primaryColor,
            }}
          >
            {title}
          </h1>
          {layout.header.showDate && (
            <p className="text-sm opacity-80 mt-1">
              {format(new Date(), "PPP")}
            </p>
          )}
        </header>
      )}

      <div
        ref={contentRef}
        className={cn(!forPrint && "min-h-[200px]")}
        style={{ marginBottom: layout.footer.showPageNumber || layout.footer.customText ? 24 : 0 }}
      >
        {children}
      </div>

      {(layout.footer.showPageNumber || layout.footer.customText) && (
        <footer
          className="text-xs opacity-70 pt-2 border-t"
          style={{ borderColor: styles.primaryColor }}
        >
          {layout.footer.customText && <span>{layout.footer.customText}</span>}
          {layout.footer.showPageNumber && layout.footer.customText && " · "}
          {layout.footer.showPageNumber && <span>Page 1</span>}
        </footer>
      )}
    </div>
  );
}
