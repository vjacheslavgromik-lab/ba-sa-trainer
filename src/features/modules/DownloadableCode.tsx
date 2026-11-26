import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { downloadText } from "../../shared/downloadText";

const TYPES: Record<string, string> = {
  yaml: "application/yaml",
  yml: "application/yaml",
  json: "application/json",
  xml: "application/xml",
  wsdl: "application/xml",
};

/** Блок кода, который представляет собой готовый документ: подпись с именем файла и кнопка «Скачать». */
export function DownloadableCode({ filename, text, children }: { filename: string; text: string; children: ReactNode }) {
  const ext = filename.split(".").pop() ?? "";
  return (
    <figure className="code-doc">
      <figcaption>
        <span>
          Файл: <code>{filename}</code>
        </span>
        <Button
          type="button"
          variant="secondary"
          aria-label={`Скачать ${filename}`}
          onClick={() => downloadText(filename, text.endsWith("\n") ? text : `${text}\n`, TYPES[ext] ?? "text/plain")}
        >
          Скачать файл
        </Button>
      </figcaption>
      <pre>{children}</pre>
    </figure>
  );
}
