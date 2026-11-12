# Đầu việc cho AGY

Mở AGY ở thư mục repo. Dùng từng đầu việc bên dưới và xem diff trước khi tiếp tục. Chạy `npm run build` sau mỗi thay đổi.

| Đầu việc | Tệp | Tiêu chí nghiệm thu |
|---|---|---|
| Cảnh và vật liệu | `src/models.ts` | Công viên có đá, cây và ghế. Thư viện có bàn gỗ, đèn, cửa sổ và kệ sách. Quân dễ phân biệt ở cả hai cảnh và hai phía. |
| Luật SHIFT | `src/rules.ts` | Ô giữ nguyên từ lúc báo đến lúc đổi. Kiểm tra khi ô trống, bị tốt/vua chiếm, cú đổi mở đường chiếu, và xe bị dời khỏi ô nhập thành. |
| Quân cờ và bàn tay | `src/models.ts`, `src/stage.ts` | Tay đi vào từ đúng phía, giữ quân qua cú gạt và rút ra sau khi đặt quân. Sáu loại quân dễ nhận ra từ tầm thấp. |
| Âm thanh | `src/audio.ts` | Nghe được sự khác nhau giữa tiếng quân chạm đá và chạm gỗ, âm báo SHIFT tách khỏi tiếng đi quân, nút tắt tiếng áp dụng cả ambience. |
| Camera và hiệu ứng | `src/stage.ts`, `src/main.ts` | Cả Trắng và Đen tự đổi góc nhìn sau lượt. Khi chọn mã, camera theo cung nhảy. Kiểm tra ăn quân và Đổi kép ở hai phía. |

Ví dụ rà soát luật ở chế độ chỉ đọc:

```sh
agy --sandbox --mode plan -p "Review src/rules.ts for invalid SHIFT positions and turn sequencing. Do not modify files. Give reproducible board states for any findings."
```
