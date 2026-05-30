# GENZTECH Design System 🚀

Tài liệu này chứa toàn bộ mã nguồn CSS và tư duy thiết kế của Landing Page **GENZTECH MARKETING**.

## 1. Bảng màu chủ đạo (Design Tokens)
```css
:root {
    --primary: #2D88FF;        /* Xanh Meta sáng - Điểm nhấn công nghệ */
    --success: #10B981;        /* Xanh lục - Chỉ số tăng trưởng tích cực */
    --bg-base: #000000;        /* Đen sâu - Nền tảng Apple Minimalist */
    --bg-surface: #0B0C10;     /* Xám bề mặt - Dành cho thẻ (Card) */
    --text-primary: #ffffff;   /* Trắng tinh khiết - Nội dung chính */
    --text-secondary: #a1a1a6; /* Xám Apple - Nội dung phụ */
}
```

## 2. Các thành phần cốt lõi
- **Hero Section**: Sử dụng typography lớn (`clamp`), gradient text và tối giản hoàn toàn để tạo sự tập trung.
- **Bento Grid**: Hệ thống lưới linh hoạt (Large: 66%, Small: 34%) lấy cảm hứng từ trang giới thiệu iPhone.
- **Dashboard Mockup**: Sử dụng SVG Animation để mô phỏng dữ liệu CTR/ROI thời gian thực mà không cần dùng ảnh nặng.
- **Glassmorphism**: Các hiệu ứng mờ và viền mỏng (`border: 1px solid rgba(255,255,255,0.1)`) tạo chiều sâu.

## 3. Tối ưu Mobile
- Chuyển đổi toàn bộ lưới về dạng `flex-direction: column`.
- Ẩn bớt các menu phụ để giữ độ sạch của giao diện.
- Scale Dashboard xuống 40% để vừa khít màn hình điện thoại mà không bị vỡ.

---
*File source thực thi: [index.css](index.css)*
