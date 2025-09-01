# ap-truyendich — UI Spec

## 1) Brand & Tone
- Mục tiêu: rõ ràng, dễ thao tác trên di động, màu **xanh dương** chủ đạo (thân thiện y tế).
- Tránh quá nhiều chi tiết, tập trung đọc nhanh trong ca trực.

## 2) Màu sắc (Tailwind tương ứng)
- Primary (blue): `#0EA5E9` (tailwind `sky-500`)
- Primary Dark: `#0284C7` (sky-600)
- Primary Light: `#7DD3FC` (sky-300)
- Surface: `#F8FAFC` (slate-50)
- Text: `#0F172A` (slate-900)
- Success: `#16A34A` (green-600)
- Warning: `#D97706` (amber-600)
- Danger: `#DC2626` (red-600)

## 3) Typography
- Font chính: Inter (fallback: system-ui, -apple-system, Segoe UI, Roboto)
- Size: Mobile-first
  - H1: 20–22px/semibold (Header app)
  - Body: 16px
  - Nút chính “Bắt đầu truyền”: 18px/bold

## 4) Components cốt lõi
- **Primary Button**: nền primary, text trắng, radius lớn (rounded-xl), height ≥ 48px
- **Input**: border 1px slate-300, focus ring sky-500
- **Checkbox**: rõ nhãn “Nhận thông báo qua email”
- **Card ca đang truyền**: đồng hồ đếm **lớn**, dự kiến kết thúc, nút Hủy (danger)
- **Lịch sử**: mục gọn, hiển thị trạng thái (completed/canceled)

## 5) Layout
- Mobile-first, cuộn dọc, 4 vùng rõ rệt:
  1) Header
  2) Form nhập liệu
  3) Danh sách Active
  4) Lịch sử
- Footer: “Sử dụng cho Điều dưỡng An Phước”

## 6) Icon
- Bộ icon: **Tabler Icons** hoặc **Lucide** (đường nét rõ, nhẹ)
  - Login: `brand-google`
  - Start: `player-play`
  - Cancel: `x`
  - History: `history`
  - Logout: `logout`

## 7) Trạng thái & Phản hồi
- Nút “Bắt đầu truyền” — màu xanh dương nổi bật
- Khi countdown về 0: popup + âm thanh (alarm.mp3), chuyển xuống Lịch sử
- Hủy: chuyển ngay xuống Lịch sử, **không** bật thông báo/âm thanh/email

## 8) Accessibility
- Tương phản ≥ 4.5:1
- Kích thước mục tiêu chạm ≥ 44×44px
