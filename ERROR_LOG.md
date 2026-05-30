# 📓 Nhật Ký Lỗi & Bài Học Kinh Nghiệm (Error Log)

Dưới đây là danh sách các lỗi đã gặp trong quá trình phát triển dự án **GenzTech**, nguyên nhân và cách khắc phục để tránh lặp lại.

---

## 🚀 Mẫu ghi chép (Template)
- **Ngày phát hiện**: YYYY-MM-DD
- **Vấn đề**: Mô tả ngắn gọn lỗi.
- **Nguyên nhân**: Tại sao lỗi xảy ra? (Logic, API, Database, UI...)
- **Giải pháp**: Cách đã xử lý.
- **Bài học**: Điều cần lưu ý để không lặp lại.

---

## 🛠 Danh sách lỗi đã xử lý

### 1. Lỗi hiển thị báo cáo Telegram (Ví dụ)
- **Vấn đề**: Báo cáo gửi về Telegram bị trống hoặc không cập nhật số liệu mới nhất.
- **Nguyên nhân**: Hàm `fetchAndSendAllReports` không xử lý hết các trường hợp token hết hạn hoặc tài khoản quảng cáo bị vô hiệu hóa.
- **Giải pháp**: Thêm khối `try...catch` chi tiết cho từng tài khoản và kiểm tra trạng thái token trước khi gọi API.
- **Bài học**: Luôn log lại lỗi cụ thể từ API của Meta để biết chính xác nguyên nhân (400, 401, hay 403).

### 2. Lỗi giao diện Dashboard bị đè lớp (Overlap)
- **Vấn đề**: Các tab trong Dashboard hiển thị chồng chéo lên nhau khi chuyển tab.
- **Nguyên nhân**: Thiếu đóng thẻ `</div>` hoặc CSS `display: none` chưa được áp dụng triệt để cho các container ẩn.
- **Giải pháp**: Kiểm tra lại cấu trúc DOM và sử dụng một hàm `switchTab` tập trung để ẩn tất cả các view trước khi hiện view mới.
- **Bài học**: Sử dụng công cụ Inspect Element để kiểm tra cấu trúc thẻ HTML khi có lỗi dàn trang.

### 3. Lỗi Chatbot trên Landing Page không phản hồi
- **Vấn đề**: Khung chat trên `index.html` không gửi được tin nhắn, báo lỗi 404.
- **Nguyên nhân**: File `index.html` gọi đến `/api/chat` nhưng `server.js` chưa định nghĩa route này.
- **Giải pháp**: Đã thêm `app.post('/api/chat', ...)` vào `server.js` để gọi OpenAI API.
- **Bài học**: Luôn kiểm tra sự đồng nhất giữa Frontend (URL gọi API) và Backend (Route xử lý).

3. **Lỗi: Mất định dạng báo cáo Ads và các tính năng nâng cao (Chatbot, Sheets)**
- **Nguyên nhân**: Đồng bộ nhầm bản code cũ từ local lên Railway, ghi đè lên bản "xịn" nhất.
- **Giải pháp**: Tìm lại commit "hoàng kim" `b191b4d` và thực hiện phục hồi toàn bộ (`checkout`) các file `server.js`, `ads.html`, `index.html`.
- **Bài học**: Luôn xác định rõ commit ID của các bản ổn định (Golden Version). Trước khi dọn dẹp code số lượng lớn, hãy đảm bảo đã có bản backup hoặc commit gần nhất.

---

> [!IMPORTANT]
> **TRẠNG THÁI HỆ THỐNG HIỆN TẠI (STABLE):**
> - **Thông báo Ads Telegram**: Đã hoạt động chuẩn xác (Full HTML, phân cấp Campaign > AdSet > Ad). **KHÔNG ĐƯỢC CHỈNH SỬA.**
> - **Báo cáo Campaign**: Dữ liệu đồng bộ và hiển thị đã ổn định. **KHÔNG ĐƯỢC THAY ĐỔI LOGIC.**
> - Mọi thay đổi tiếp theo chỉ tập trung vào phần giao diện (UI) hoặc các tính năng mới được yêu cầu, tuyệt đối không động vào code lõi của Notification Engine trong `server.js`.

---
4. **Dọn dẹp giao diện**: Gỡ bỏ các mục "Dữ liệu AI" và "Cấu hình Chatbot" khỏi menu theo yêu cầu để giao diện gọn gàng hơn.

---

> [!TIP]
> Hãy cập nhật file này ngay khi bạn vừa giải quyết xong một lỗi "khó nhằn" nhé!
