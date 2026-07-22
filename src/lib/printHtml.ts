import { Capacitor, registerPlugin } from "@capacitor/core";

interface HtmlPrintPlugin {
  printHtml(options: { html: string; title?: string }): Promise<{ started: boolean }>;
}

const HtmlPrint = registerPlugin<HtmlPrintPlugin>("HtmlPrint");

function printHtmlInBrowser(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) {
      document.body.removeChild(iframe);
      reject(new Error("Anteprima stampa non disponibile"));
      return;
    }

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    };

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
        cleanup();
        resolve();
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error("Stampa non riuscita"));
      }
    };

    if (doc.readyState === "complete") {
      window.setTimeout(triggerPrint, 250);
    } else {
      iframe.onload = () => window.setTimeout(triggerPrint, 250);
    }

    void title;
  });
}

/** Apre il dialogo di stampa del sistema (Android nativo o browser). */
export async function printHtmlDocument(
  html: string,
  title = "Documento"
): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    await HtmlPrint.printHtml({ html, title });
    return;
  }
  await printHtmlInBrowser(html, title);
}
