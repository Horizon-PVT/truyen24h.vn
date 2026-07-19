# TRUYEN24H OPERATOR PHASE 2: MANUAL QA CHECKLIST

Tài liệu này hướng dẫn Owner/Developer kiểm thử thủ công và tự động các tính năng thuộc **Phase 2: Owner Draft Queue + Safe Publish** của hệ thống vận hành AI truyện dịch/blog Truyen24h.vn.

---

## 1. Kiểm thử tự động (Smoke Tests)

Chạy các scripts smoke test để đảm bảo tất cả API routes đáp ứng tiêu chuẩn an toàn P0, không dùng `x-admin-email` giả mạo và yêu cầu Firebase Admin token hợp lệ.

```bash
# 1. Chạy security smoke test tổng thể hệ thống
node scripts/security-smoke-tests/security-smoke.mjs

# 2. Chạy smoke test riêng cho Operator Phase 2
node scripts/security-smoke-tests/operator-smoke.mjs
```

---

## 2. Luồng Kiểm thử Thủ công (Manual QA Flow)

### Kịch bản 1: Chuẩn bị Draft AI và Xem Báo cáo
1. **Bước 1**: Đăng nhập tài khoản Admin vào trang `/admin` (Sử dụng Google Auth có email nằm trong `ADMIN_EMAILS` hoặc `ADMIN_ALLOWED_EMAILS` trong file `.env.local`).
2. **Bước 2**: Truy cập vào trang **Duyệt Draft AI** tại URL `/admin/operator-drafts`.
3. **Bước 3**: Xác minh banner trên cùng hiển thị báo cáo Operational Report đầy đủ:
   - *Tổng số Draft*
   - *Chờ Duyệt (NEEDS_REVIEW)*
   - *Đã Duyệt (APPROVED)*
   - *Điểm chất lượng trung bình*
   - *Tổng số Blockers*
4. **Bước 4**: Thử thay đổi các bộ lọc:
   - Lọc theo **Loại**: Story, Chapter, Blog.
   - Lọc theo **Trạng thái**: DRAFT, NEEDS_REVIEW, APPROVED, PUBLISHED, REJECTED.

---

### Kịch bản 2: Quy trình Phê duyệt (Approve / Reject / Needs Fix)
1. **Bước 1**: Click chọn một Draft bất kỳ có trạng thái `NEEDS_REVIEW`.
2. **Bước 2**: Xác minh Panel Preview bên phải hiện đầy đủ thông tin:
   - Điểm Quality Score, danh sách Blockers (nếu có), Warnings (nếu có).
   - Nội dung bản xem trước (Content Preview).
   - Metadata đính kèm (slug, targetCollection, tags...).
3. **Bước 3**: **Kiểm thử Yêu cầu sửa (Needs Fix)**:
   - Gõ ghi chú vào ô Textarea: *"Nội dung thiếu phần kết, cần AI sinh thêm."*
   - Click nút **Yêu cầu sửa (Needs Fix)**.
   - Xác minh trạng thái Draft chuyển sang `NEEDS_FIX`. Ghi chú được lưu vào collection `operator_reviews`.
4. **Bước 4**: **Kiểm thử Phê duyệt (Approve)**:
   - Chọn lại Draft đó hoặc Draft khác, bấm **Phê duyệt (Approve)**.
   - Xác minh trạng thái Draft chuyển thành `APPROVED`. Nút **Xuất bản ngay (Publish)** sẽ xuất hiện.

---

### Kịch bản 3: Quy trình Xuất bản An toàn (Publish)
1. **Bước 1**: Chọn một Draft có trạng thái `APPROVED` (ví dụ: một Draft truyện hoặc chương).
2. **Bước 2**: Bấm nút **Xuất bản ngay (Publish)**.
3. **Bước 3**: Xác minh sau khi load:
   - Trạng thái Draft chuyển sang `PUBLISHED`.
   - Nút **Thu hồi (Rollback MVP)** xuất hiện.
4. **Bước 4**: Kiểm tra trực tiếp Database (Firestore):
   - Nếu draft type là `blog`: Có document mới được tạo trong `blog_posts` với ID tương ứng `targetDocId`.
   - Nếu draft type là `story`: Có novel mới xuất hiện trong `novels` với ID tương ứng `targetDocId`.
   - Nếu draft type là `chapter`: Có chapter mới được tạo tại `novels/{targetParentId}/chapters/c{chapterNumber}`. Novel cha tại `novels/{targetParentId}` được tự động cập nhật `latestChapterNumber` và `lastUpdated`.
5. **Bước 5**: Kiểm tra log trong collection `operator_publish_logs` có chứa log xuất bản chứa thông tin người thực hiện, thời gian, và đích đến.

---

### Kịch bản 4: Thu hồi Nội dung (Rollback MVP)
1. **Bước 1**: Chọn Draft vừa xuất bản ở Kịch bản 3 (Trạng thái `PUBLISHED`).
2. **Bước 2**: Bấm nút **Thu hồi (Rollback MVP)** và xác nhận hộp thoại xác nhận.
3. **Bước 3**: Xác minh sau khi thu hồi:
   - Trạng thái Draft được khôi phục về `APPROVED`.
   - Kiểm tra Firestore:
     - Blog post tương ứng trong `blog_posts` có trường `hidden: true` và `published: false` và `status: 'DRAFT'`.
     - Novel tương ứng trong `novels` có trường `status: 'Tạm ẩn'` và `hidden: true` và `isPrivate: true`.
     - Chapter tương ứng trong `chapters` có trường `hidden: true` and `isPrivate: true` and `published: false`.
   - Có bản ghi log rollback mới trong collection `operator_rollback_logs` liên kết với `publishLogId`.

---

## 3. Bản đồ các Collections Firestore sử dụng

| Tên Collection | Quyền Client SDK | Ghi chú |
| :--- | :--- | :--- |
| `operator_drafts` | **CẤM HOÀN TOÀN** | Lưu trữ nội dung nháp chờ duyệt sinh bởi AI |
| `operator_reviews` | **CẤM HOÀN TOÀN** | Lưu vết lịch sử phê duyệt, từ chối, yêu cầu sửa và ghi chú |
| `operator_publish_logs` | **CẤM HOÀN TOÀN** | Lưu vết lịch sử xuất bản của các draft |
| `operator_rollback_logs` | **CẤM HOÀN TOÀN** | Lưu vết lịch sử thu hồi nội dung |

---
*Mọi thay đổi trên đây đều đã được bảo vệ thông qua backend API được bảo mật bằng Firebase Authentication bearer tokens.*
