# Backend ShiftChess

Backend Node.js 24.18+ phục vụ cả bản web đã build và WebSocket `/socket`. Chạy một process cho một VPS. Không cần nhà cung cấp ghép trận hay tài khoản bên ngoài.

## Chạy local

```sh
npm ci
npm run build
npm start
```

Mở `http://127.0.0.1:48700`. Hai tab hoặc hai trình duyệt có thể tạo/vào phòng bằng mã hoặc ghép nhanh. Tên người chơi là tên khách; không phải tài khoản đã xác minh. Không có xếp hạng/Elo.

Để thử hai thiết bị trong LAN, đặt `HOST=0.0.0.0` trước `npm start`, mở địa chỉ IP máy chủ ở cổng 48700 và cho phép cổng này qua firewall. Khi chạy Vite/preview cục bộ, giao diện dùng cổng backend 48700; trên cùng domain VPS nó tự dùng `/socket` và `wss:` nếu trang dùng HTTPS.

## VPS bằng Docker Compose

1. Trỏ DNS A/AAAA của domain về VPS. Mở cổng TCP 80/443 và tùy chọn UDP 443. Cổng game 48700 chỉ ở mạng Docker.
2. Cài Docker Engine và Compose plugin. Clone repo, tạo `.env` cùng thư mục `compose.yaml`:

```dotenv
DOMAIN=chess.example.com
```

3. Chạy:

```sh
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 game
```

Caddy cấp HTTPS và chuyển tiếp WebSocket. Mở `https://chess.example.com`. Container game chạy bằng user `node`, lưu SQLite ở volume `game-data`. Health check ở `/health`. Log có xoay vòng; không ghi token phiên hay toàn bộ nội dung người chơi gửi. `SIGTERM`/`SIGINT` đóng socket, giữ snapshot và thoát; phiên được khôi phục khi server mở lại. Sau restart, người chơi có 60 giây để kết nối lại.

Nếu frontend được nhúng hoặc host riêng trên itch.io, cần thêm **đúng origin của iframe game** vào biến `EXTRA_ORIGINS`, bắt đầu bằng dấu phẩy. Không dùng `*`. Khi build frontend riêng, đặt `VITE_SERVER_URL=wss://chess.example.com/socket`; hoặc nhập địa chỉ trong phần Kết nối máy chủ. Không cần làm bước này khi frontend và backend cùng domain VPS.

`TRUST_PROXY=1` chỉ dùng khi game nằm sau reverse proxy tin cậy như Compose này; không publish trực tiếp cổng game trong cấu hình đó. Origin check hạn chế truy cập từ trang khác, không thay thế token phiên.

## Cập nhật và sao lưu

```sh
git pull
docker compose up -d --build
```

Một game process sở hữu một SQLite DB. Không tăng replica hoặc chạy PM2 cluster trên cùng DB: sảnh chờ và socket có chủ sở hữu trong bộ nhớ. Muốn nhiều node cần thêm dịch vụ điều phối room và presence dùng chung.

Để sao lưu nhất quán, dừng game rồi copy cả thư mục dữ liệu khỏi container, sau đó khởi động lại:

```sh
docker compose stop game
docker compose cp game:/app/data ./shiftchess-backup
docker compose start game
```

Giữ bản sao lưu ngoài VPS. Khi restore, dừng game trước khi chép dữ liệu và giữ quyền đọc/ghi của user `node` (UID 1000). Không dùng `docker compose down -v` nếu cần giữ dữ liệu. Các phòng chỉ được giữ tối đa 4 giờ và bị thu hồi sau khi người chơi rời/hết thời gian reconnect; DB phục vụ khôi phục trận đang chạy, không phải kho lịch sử lâu dài.

## Engine và giao thức

- `src/rules.ts`: luật cờ + SHIFT; snapshot gồm FEN, số nước, SHIFT đã thông báo và bộ đếm lặp thế cờ.
- `server/engine.mjs`: chuyển trạng thái `waiting → briefing → playing → ended`, kiểm tra lượt, revision, nước đi, phong cấp, đầu hàng và tái đấu.
- `server/index.mjs`: WebSocket, mã phòng, hàng đợi ghép nhanh, token phiên, giới hạn kết nối, heartbeat, static HTTP, vòng đời phòng.
- `server/store.mjs`: SQLite WAL; commit snapshot trước khi phát trạng thái cho client. Token ngẫu nhiên 192 bit; DB chỉ chứa SHA-256 digest.

Client gửi `create {name}`, `join {name,code}`, `quick {name}`, `resume {token}`, `ready`, `accept`, `move {from,to,promotion?,revision}`, `resign`, `rematch` hoặc `leave`. Client không gửi FEN, cặp ô SHIFT, bên thắng hoặc màu quân để server tin theo.

Server trả `session {token,color,playerId}`, `room {room,move?,settlement?}` hoặc `error {key}`. Mỗi nước hợp lệ tăng `revision`; lặp lại hoặc gửi revision cũ bị từ chối. Màu quân đổi khi cả hai đồng ý tái đấu. Hai người phải xác nhận cùng SHIFT trước khi đi nước đầu. Map và SHIFT do server bốc bằng RNG của hệ điều hành; vị trí SHIFT được báo trước đúng 2 nước.

Heartbeat 30 giây; hết heartbeat thì ngắt socket. Trận tạm dừng khi một bên ngắt kết nối, bên còn lại thắng nếu quá 60 giây. Nếu cả hai đều offline khi hết hạn thì thu hồi phòng. Phòng chờ ghép nhanh chỉ ghép với người đang kết nối trong hàng đợi. Giới hạn mặc định: 200 phòng, 400 kết nối, 16 kết nối/IP, 60 lần upgrade/IP/phút, 50 message/socket/10 giây, payload 4 KiB. Client quá chậm bị ngắt khi buffer vượt 256 KiB. Đây là giới hạn bảo vệ, không phải cam kết tải đã benchmark trên VPS.

## Kiểm chứng

`npm test`: luật SHIFT, snapshot, bot tìm chiếu hết, từ chối nước sai/lượt sai, đồng bộ hai người, tái đấu, timeout, khôi phục sau restart và token lưu dạng băm.

`npm run test:browser`: chơi local bằng click, layout nhỏ/ngang, bot, hai trình duyệt tạo/vào phòng, xác nhận SHIFT, đi quân, reload/reconnect, tái đấu, phím tắt và fullscreen. Cần Chromium đã cài; có thể đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge.

Docker/Caddy cần kiểm tra lại trên VPS có DNS/TLS thật. Chưa có tài khoản, chống bot bằng CAPTCHA, lưu lịch sử dài hạn, spectate, đồng hồ thi đấu hoặc nhiều server.
