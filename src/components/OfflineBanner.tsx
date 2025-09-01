import React from "react";

export default function OfflineBanner({ savedAt }: { savedAt?: string | null }) {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
      Bạn đang <b>offline</b>. Hiển thị dữ liệu gần nhất đã lưu
      {savedAt ? (
        <>
          {" "}(lúc <span className="font-mono">{new Date(savedAt).toLocaleString("vi-VN")}</span>)
        </>
      ) : null}
      .
    </div>
  );
}
