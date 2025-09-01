import React from "react";

export default function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 grid place-items-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-5">
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        <div className="text-slate-700">{children}</div>
        <div className="mt-4 flex justify-end">
          <button
            className="bg-brand-500 hover:bg-brand-600 text-white rounded-xl px-4 py-2"
            onClick={onClose}
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
