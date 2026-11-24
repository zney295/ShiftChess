# Thiết kế giao diện ShiftChess

Giao diện lấy cảm hứng từ bàn cờ gỗ khảm đồng. Những khung lớn dùng gỗ tối có cạnh bắt sáng, họa tiết ô cờ nhẹ và góc khảm. Nút chính có mặt đồng sáng và gờ chìm khi nhấn. Ô nhập và dải tab nằm trong rãnh tối để nhìn rõ điểm nhập liệu và lựa chọn hiện hành.

## Màu và chữ

| Thành phần | Màu | Vai trò |
| --- | --- | --- |
| Gỗ óc chó | `#2b211c` | Mặt khung, chuyển xuống nâu sẫm ở đáy |
| Giấy ngà | `#f8f0e3` | Tiêu đề và nội dung chính |
| Chữ phụ | `#b8a99a` | Nhãn, mô tả, hướng dẫn |
| Đồng | `#f3c776` → `#d99b3e` | Hành động chính, điểm focus, nhịp SHIFT |
| Ngọc bảo | `#4fb88a` | Kết nối thành công |
| Đỏ rượu | `#d45b5b` | Lỗi và mất kết nối |

Tiêu đề dùng Fraunces hoặc kiểu chữ serif dự phòng. Nhãn, nút và nội dung dùng Inter hoặc sans-serif hệ thống. Đồng hồ và phần trăm âm lượng dùng số có chiều rộng đều. Mã phòng viết hoa, giãn chữ để dễ đọc và chép.

## Bố cục và trạng thái

```text
Màn chính:   ShiftChess / mô tả / Chơi / Hướng dẫn + Cài đặt
Chọn chế độ: [Hai người] [Đấu với máy] [Trực tuyến]
Trực tuyến:  tên → tìm đối thủ / ◆ phòng riêng ◆ / tạo, nhập, tham gia hoặc xem
Báo SHIFT:   tên hiệu ứng / bàn + chu kỳ / luật chính / 3 dòng luật / hành động
Cài đặt:     tiêu đề + đóng / nút nhanh có nhãn / 3 tab / nội dung tab cuộn riêng
```

- Ba thẻ chế độ có biểu tượng cùng kích thước, nội dung căn trái và nút cuối hàng. Trên màn nhỏ, các thẻ chuyển thành một cột.
- Trong màn trực tuyến, tách tìm đối thủ khỏi thao tác phòng riêng bằng đường khảm hình thoi. Trạng thái kết nối có cả dấu chấm lẫn chữ. Ô mã phòng có nhãn luôn thấy được.
- Khung SHIFT tách bàn và chu kỳ thành hai nhãn. Luật chính nằm trong ô nền lõm có cạnh đồng. Ba dòng bên dưới lần lượt nói về thời điểm đánh dấu, quân được bảo vệ và đồng hồ. Trạng thái chờ đối thủ nằm ngay trước hàng nút xác nhận.
- Thanh SHIFT trong trận dùng chỉ báo đồng cho tiến độ. Hai cặp tọa độ giữ màu riêng trùng với dấu trên bàn cờ.
- Thông báo hết giờ và mất kết nối mở đầu bằng tên sự kiện, tiếp theo là điều vừa xảy ra với ván. Toast dùng màu đồng cho thông tin và đỏ cho cảnh báo. Lỗi toàn màn hình xuất hiện ngay dưới nút tương ứng trong Cài đặt.
- Hai nút nhanh có nhãn theo hành động hiện tại, chẳng hạn Bật tiếng hoặc Thoát toàn màn hình. Dùng phím mũi tên để chuyển tab. Tab hiện hành có nền đồng, phần nội dung cuộn riêng.

## Màn giới thiệu (Briefing Modal)

Màn giới thiệu là trạm dừng bắt buộc trước khi quân cờ đầu tiên di chuyển, đóng vai trò định hình nhận thức chiến thuật cho người chơi về luật SHIFT của ván đấu hiện tại.

```text
┌────────────────────────────────────────────────────────┐
│  SHIFT · [TÊN HIỆU ỨNG]                                │
│  [Bản đồ: Thư viện/Công viên]   [Chu kỳ: Mỗi 5 lượt (10 nước)]│
│  ┌──────────────────────────────────────────────────┐  │
│  │ Luật chính: Câu tóm tắt cơ chế cốt lõi (1 câu)   │  │
│  └──────────────────────────────────────────────────┘  │
│  • Báo trước: Ô mục tiêu phát sáng và ký hiệu trước.  │
│  • An toàn: Vua/Tốt được giữ vị trí, né nước phạm quy. │
│  • Thời gian: 30 giây mỗi lượt đi.                     │
│  [Chờ đối thủ xác nhận...] (chỉ có khi chơi trực tuyến)│
│  [Rời phòng]                      [Bắt đầu ván / Enter]│
└────────────────────────────────────────────────────────┘
```

1. **Khung chứa và chất liệu:** Hộp thoại nổi dùng nền gỗ óc chó viền chỉ đồng kép, phủ bóng mờ nhẹ lên bàn cờ 3D phía sau.
2. **Tiêu đề và huy hiệu (Badges):**
   - Tiêu đề chính viết hoa chữ serif: `SHIFT · [TÊN HIỆU ỨNG]`.
   - Cặp nhãn huy hiệu khảm đồng: nhãn trái chỉ bối cảnh bàn cờ (`Công viên` / `Thư viện`), nhãn phải chỉ nhịp kích hoạt (`Định kỳ mỗi 3 vòng / 6 nước` hoặc `Cuối ván ở vòng 12`).
3. **Ô quy tắc nổi bật (Rule Callout):** Đặt trong rãnh chìm viền đồng màu ngà, hiển thị câu mô tả trực diện cơ chế chỉ trong một hơi thở (ví dụ: *"Đổi vị trí quân trên hai ô được đánh dấu. Quân có thể chuyển sang ô trống"*).
4. **Ba gạch đầu dòng chuẩn mực:**
   - *Thời điểm cảnh báo:* Đánh dấu rõ ô A, B trước 2 nước để người chơi tính toán.
   - *Quy tắc an toàn:* Giữ an toàn cho Vua, tự động hủy bỏ bước dịch chuyển nếu tạo ra thế chiếu bất hợp lệ.
   - *Quy tắc thời gian:* Đồng hồ 30 giây mỗi lượt kèm cơ chế đi tự động tránh đứng ván.
5. **Hành vi theo chế độ chơi:**
   - *Hai người cùng máy & Đấu với bot:* Nút "Bắt đầu ván" nhận focus mặc định, bấm `Enter` hoặc `Space` vào trận ngay.
   - *Trực tuyến:* Nút chuyển thành "Sẵn sàng". Dòng trạng thái hiển thị "Đang chờ đối thủ xác nhận…". Trận đấu chỉ bắt đầu khi cả hai bên cùng xác nhận đồng thuận với luật SHIFT.

## Thông báo mở đầu ván (Start Splash Banner)

Ngay khi đóng Màn giới thiệu, một dải banner động lướt qua trung tâm bàn cờ để khắc sâu luật chơi vào tâm trí người đấu:

1. **Dải ruy-băng động (Splash):** Hiển thị giữa bàn cờ trong 1.5 – 1.8 giây với nội dung: `⚡ SHIFT: [TÊN HIỆU ỨNG] · [MÔ TẢ NGẮN] ⚡`. Kèm âm thanh báo hiệu nhẹ (`shiftWarning`).
2. **Thu gọn vào HUD:** Sau khi lướt qua, banner thu nhỏ và đáp xuống thanh công cụ **Shift Widget** ở góc màn hình.
3. **Nhịp đếm tiến độ:** 6 chấm tròn (Pips) bằng đồng sáng dần theo từng nước đi, chuyển sang trạng thái cảnh báo nhấp nháy khi còn 2 nước cuối trước nhịp SHIFT.

## Danh mục các loại SHIFT

Mỗi ván đấu chỉ chọn **duy nhất 1 loại SHIFT** (ngẫu nhiên hoặc theo phòng) để giữ tính trong sáng, chặt chẽ và chiều sâu tính toán của cờ vua. *(Chưa áp dụng cơ chế Đổi kép để tránh làm loạn thế cờ).*

| Loại SHIFT | Biểu tượng | Mô tả cơ chế | Tác động chiến thuật & Quy tắc biến dạng | Luật bảo vệ & An toàn |
| --- | :---: | --- | --- | --- |
| **Đổi chỗ (Swap)** *(Mặc định)* | `⇄` | Hai ô cờ được đánh dấu sẽ tráo đổi vị trí quân cho nhau khi đến chu kỳ (báo trước 2 nước). | **Biến dạng Mã ↔ Tượng:** Khi hoán đổi, nếu dính phải Mã hoặc Tượng đổi sang màu ô đối lập, quân đó sẽ tự chuyển hóa: Mã ↔ Tượng. | Không tráo Vua và Tốt; tự động bỏ qua nếu tạo ra thế chiếu bất hợp lệ. |
| **Dịch quân (Slide)** | `→` | Một quân cờ tự động trượt sang ô trống được liên kết trong cặp đánh dấu khi đến nhịp. | Mở đường đột kích bất ngờ cho Xe và Hậu mà không tốn lượt đi chính của người chơi. | Chỉ kích hoạt khi đúng 1 trong 2 ô có quân; Vua không bị dịch chuyển. |
| **Đảo phe (Turn Hijack)** | `🎭` | Xuất hiện **đúng 1 lần duy nhất** trước nước thứ 30. Khi kích hoạt, người chơi giành quyền điều khiển quân của đối thủ trong **đúng 1 lượt**. | **Xoay 3D tức thì:** Bàn cờ tự động xoay 180° sang góc nhìn đối phương. Dùng 1 nước để phá thế phối hợp, dời quân chắn hoặc phá vỡ cấu trúc tốt của địch. | **Chống chiếu bí oan:** Không được hiến Vua đối phương. Mọi nước đi trong lượt này **không được phép tạo thế chiếu tướng ngay sau shift** (vô hiệu hóa chiếu tướng tức thì). Sau 1 lượt, bàn cờ xoay trở lại bình thường. |

Đồ trang trí dùng CSS và biểu tượng SVG nội tuyến. Các màn hình giữ điểm nối hiện có với game và bản dịch tiếng Việt, tiếng Anh. Kiểm tra trên màn 16:9, màn hẹp, với bàn phím và chế độ giảm chuyển động.

[Brief thiết kế ShiftChess trên Gemini](https://share.gemini.google/ravIfkZEeKY1)
