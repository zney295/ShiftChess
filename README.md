# ShiftChess

Cờ vua 3D chủ đề SHIFT cho GitHub Game Off 2026. Chơi với bot, hai người cùng máy, hoặc online bằng mã phòng/ghép nhanh. Bàn Công viên hoặc Thư viện được chọn ngẫu nhiên.

```sh
npm ci
npm run build
npm start
```

Mở `http://127.0.0.1:48700`. Backend phục vụ cả game và WebSocket. Khi phát triển giao diện dùng thêm `npm run dev`.

Ở chế độ bot, chọn Trắng, Đen hoặc ngẫu nhiên. Mục lịch sử có nút **Hoàn nước** cho ván local và ván bot. Khi đấu bot, thao tác này đưa bàn cờ về lượt trước của người chơi.

Mỗi lượt có 30 giây. Hết giờ lượt, game tự chọn một nước hợp lệ rồi chuyển lượt. Trong ván online, mỗi bên còn có 5 phút tổng và sẽ thua nếu dùng hết. Dùng mã phòng và nút **Xem trận** để theo dõi. Trong ván, nhấn Tab tới bàn cờ, dùng phím mũi tên để chọn ô, rồi nhấn Enter để chọn quân hoặc đi nước. Game tự chuyển sang bàn cờ 2D nếu WebGL không khả dụng.

Bản production hỗ trợ cài như ứng dụng web và chơi local hoặc với bot offline sau lần tải đầu tiên trên HTTPS hoặc localhost. Khi build cho hosting riêng, đặt `SHIFTCHESS_SITE_URL` thành URL công khai của game để bản xem trước chia sẻ có URL ảnh tuyệt đối.

## Luồng chơi

- Menu → chọn chế độ → nhận map và SHIFT chung → xác nhận → chơi → kết quả/tái đấu.
- Bot có Dễ/Thường/Khó, chạy trong Web Worker; tìm nước bằng iterative deepening và mô phỏng SHIFT đã thông báo. Đây là bot riêng cho biến thể, chưa có Elo hoặc sức cờ đã được đo.
- Online: tạo/vào phòng mã 6 ký tự, hai bên sẵn sàng; hoặc ghép nhanh. Máy chủ kiểm tra nước đi, chọn map/SHIFT, đồng bộ trạng thái và kết quả. Tái đấu đổi màu quân.
- Mỗi trận có **một SHIFT chung** (Đổi chỗ, Dịch quân hoặc Đổi kép), công bố cho cả hai trước nước đầu. Không có lõi riêng từng người. SHIFT định kỳ mỗi 3 vòng, đánh dấu ô trước 2 nước. Vua/Tốt không bị dời; sự kiện gây chiếu hoặc không hợp lệ sẽ được bỏ qua.
- Kéo-thả quân hoặc chạm quân rồi chạm ô đích. Chấm và vòng tròn phân biệt ô đi với ô ăn. Bàn giữ hướng cố định, có góc nghiêng và góc nhìn thẳng.
- Các ô SHIFT có chung chữ A hoặc B và màu viền. Mũi tên báo hướng dịch chuyển theo vị trí hiện tại, còn bộ đếm cho biết thời điểm SHIFT.
- Màn chơi chỉ giữ bàn cờ, lượt đi và SHIFT. Hướng dẫn, tọa độ, lịch sử, menu và cài đặt mở riêng. Có EN/VI, âm lượng hiệu ứng/môi trường, đồ họa thấp/cao và toàn màn hình.
- Esc mở menu/đóng bảng; F toàn màn hình; V đổi góc nhìn; M tắt/bật âm; G tọa độ; H lịch sử; ? hướng dẫn. Phím tắt không can thiệp vào ô nhập.

## VPS và bản itch.io

[Hướng dẫn backend/VPS](docs/backend.md): Docker Compose + Caddy HTTPS, SQLite volume, sao lưu, giao thức và giới hạn vận hành. Backend được kiểm tra local; DNS/TLS và image Docker cần kiểm chứng khi đưa lên VPS.

Frontend tĩnh nằm trong `dist/`. Nén **nội dung** thư mục để `index.html` ở gốc ZIP khi upload itch.io. Bot và chơi chung máy chạy độc lập; online cần backend. Khi frontend khác domain, cấu hình `VITE_SERVER_URL` khi build và `ALLOWED_ORIGINS` ở server. Quyền fullscreen phụ thuộc trình duyệt/iframe.

## Kiểm tra

```sh
npm test
npm run test:browser
```

Browser test cần Chromium (`npx playwright install chromium`) hoặc `PLAYWRIGHT_CHANNEL=msedge` khi dùng Edge. Test gồm click trên bàn, SHIFT, bot, phòng hai trình duyệt, reconnect/tái đấu, phím tắt và responsive.

TypeScript, Three.js, chess.js, Vite, Node.js 24.18+, ws và SQLite. Mô hình quân, âm thanh và tranh menu Canvas 2D được tạo bằng mã nguồn. Hiệu ứng tôn trọng thiết lập giảm chuyển động.

Các đầu việc Antigravity tham khảo tại [docs/agy.md](docs/agy.md).
