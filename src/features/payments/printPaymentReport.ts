export type PrintColumn = {
  label: string;
  align?: "left" | "right";
};

export type PrintReport = {
  title: string;
  subtitle?: string;
  meta?: string[];
  orientation?: "portrait" | "landscape";
  columns: PrintColumn[];
  rows: string[][];
};

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  text?: string,
) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function openPrintWindow(title = "Preparing report") {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to open the print view.");
  popup.opener = null;
  popup.document.title = title;
  popup.document.body.textContent = "Preparing report...";
  return popup;
}

export function openPrintReport(report: PrintReport, target?: Window) {
  const popup = target ?? openPrintWindow(report.title);

  const { document } = popup;
  document.title = report.title;
  document.documentElement.lang = "en";

  const viewport = element(document, "meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  document.head.append(viewport);

  const style = element(document, "style");
  style.textContent = `
    :root { color: #17211b; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2ef; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 58px; padding: 10px 24px; color: white; background: #1f5039; box-shadow: 0 1px 8px rgba(20, 35, 27, .2); }
    .toolbar strong { font-size: 14px; }
    .print-button { border: 1px solid rgba(255,255,255,.5); border-radius: 5px; padding: 8px 14px; color: #173a2b; background: white; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
    main { width: 100%; min-height: calc(100vh - 58px); padding: 24px; background: white; }
    .report-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid #1f5039; }
    h1 { margin: 0; font-size: 21px; line-height: 1.2; }
    .subtitle { margin: 5px 0 0; color: #5e6a63; font-size: 12px; }
    .meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 18px; margin: 0; color: #5e6a63; font-size: 10px; }
    table { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 10px; }
    thead { display: table-header-group; }
    th { padding: 8px 7px; color: #536159; background: #edf3ef; border-bottom: 1px solid #aebbb3; text-align: left; text-transform: uppercase; white-space: nowrap; }
    td { padding: 7px; border-bottom: 1px solid #dce2de; vertical-align: top; }
    tr { break-inside: avoid; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .empty { padding: 48px 12px; color: #6b756f; text-align: center; }
    @page { size: ${report.orientation ?? "landscape"}; margin: 12mm; }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      main { min-height: auto; padding: 0; }
      .report-header { padding-top: 0; }
    }
  `;
  document.head.append(style);

  const toolbar = element(document, "div");
  toolbar.className = "toolbar";
  toolbar.append(element(document, "strong", report.title));
  const printButton = element(document, "button", "Print report");
  printButton.className = "print-button";
  printButton.type = "button";
  printButton.addEventListener("click", () => popup.print());
  toolbar.append(printButton);

  const main = element(document, "main");
  const header = element(document, "header");
  header.className = "report-header";
  const identity = element(document, "div");
  identity.append(element(document, "h1", report.title));
  if (report.subtitle) {
    const subtitle = element(document, "p", report.subtitle);
    subtitle.className = "subtitle";
    identity.append(subtitle);
  }
  header.append(identity);
  if (report.meta?.length) {
    const meta = element(document, "p");
    meta.className = "meta";
    report.meta.forEach((item) => meta.append(element(document, "span", item)));
    header.append(meta);
  }
  main.append(header);

  const table = element(document, "table");
  const tableHead = element(document, "thead");
  const headingRow = element(document, "tr");
  report.columns.forEach((column) => {
    const heading = element(document, "th", column.label);
    if (column.align === "right") heading.className = "right";
    headingRow.append(heading);
  });
  tableHead.append(headingRow);
  table.append(tableHead);

  const tableBody = element(document, "tbody");
  report.rows.forEach((values) => {
    const row = element(document, "tr");
    report.columns.forEach((column, index) => {
      const cell = element(document, "td", values[index] ?? "");
      if (column.align === "right") cell.className = "right";
      row.append(cell);
    });
    tableBody.append(row);
  });
  if (!report.rows.length) {
    const row = element(document, "tr");
    const cell = element(document, "td", "No records to display.");
    cell.className = "empty";
    cell.colSpan = report.columns.length;
    row.append(cell);
    tableBody.append(row);
  }
  table.append(tableBody);
  main.append(table);
  document.body.replaceChildren(toolbar, main);
  popup.focus();
}
