"use client";

export default function ExportButton({ targetId, filename }: { targetId: string; filename: string }) {
  const handleExport = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const el = document.getElementById(targetId);
    if (!el) return;

    // Temporarily hide this button before capture
    const btn = el.querySelector("[data-export-hide]") as HTMLElement | null;
    if (btn) btn.style.visibility = "hidden";

    const canvas = await html2canvas(el, { backgroundColor: "#0d1117", scale: 2, useCORS: true });

    if (btn) btn.style.visibility = "";

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <button
      data-export-hide
      onClick={handleExport}
      className="text-sm text-textSecondary hover:text-textPrimary border border-border rounded-lg px-3 py-1.5 transition-colors"
    >
      Export PNG
    </button>
  );
}
