# ShiftChess

Biến thể cờ vua 3D cho GitHub Game Off 2026, chủ đề **SHIFT**. Hai người chơi trên cùng một máy, mặc định nhìn từ phía của mình. Chọn quân để camera theo quân khi đi hoặc ăn.

```sh
npm ci
npm run dev
npm run build
```

Mở URL Vite in ra. Bản build nằm trong `dist/`. Nén các tệp **bên trong** thư mục này để `index.html` nằm ở gốc ZIP khi tải lên itch.io.

- Chọn Công viên hoặc Thư viện. Hai cảnh thay đổi bàn, đạo cụ, ánh sáng và âm thanh.
- Chọn Định kỳ (mỗi 3 vòng), Cuối ván (vòng 12 nếu ván còn tiếp diễn) hoặc bốc ngẫu nhiên chế độ.
- Vòng quay chọn Đổi chỗ, Dịch quân hoặc Đổi kép. Game báo các ô một vòng trước. Đến hạn, hiệu ứng áp dụng lên quân đang ở ô đã đánh dấu. Tốt và vua không bị dời. Nếu thế cờ trước hoặc sau hiệu ứng có vua bị chiếu, sự kiện bị bỏ qua.
- Click vào bàn cờ hoặc chọn quân và ô theo tọa độ. Dùng **Toàn bàn** để xem thế cờ. Khi ăn quân, bàn tay nhấc quân lên, gạt quân đối phương rồi đặt quân xuống.

TypeScript + Three.js + Vite. `chess.js` kiểm tra luật cờ chuẩn, còn `src/rules.ts` điều phối lịch và kiểm tra thế cờ SHIFT. Mô hình, vân gỗ và âm thanh trong bản này đều được tạo từ mã nguồn. Phần hình ảnh và bàn tay hiện là mẫu dựng hình cho bản thử.

Chạy `npm test` để kiểm tra luật. Với Chromium đã cài qua `npx playwright install chromium`, chạy `npm run test:browser` để thử luồng hai người chơi.

## Làm việc với Antigravity

Trong thư mục repo, chạy `agy --sandbox` rồi dùng một đầu việc trong [docs/agy.md](docs/agy.md). Mỗi đầu việc ghi rõ tệp liên quan và cách kiểm tra trước khi gộp.
