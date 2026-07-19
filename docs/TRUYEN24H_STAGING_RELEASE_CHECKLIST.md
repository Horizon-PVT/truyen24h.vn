# TRUYEN24H STAGING RELEASE CHECKLIST

Tài liệu này hướng dẫn quy trình kiểm tra an toàn và chuẩn bị deploy staging cho Truyen24h.vn (Phase 2.5: Release Candidate Safety Guard).

---

## 1. Trước deploy staging

### 1.1. Kiểm thử kỹ thuật & Build
- [ ] **Build pass**: Chạy build offline thành công và không phát sinh lỗi biên dịch.
  ```bash
  npm.cmd run build
  ```
- [ ] **Lint pass**: Không còn lỗi lint nghiêm trọng nào cản trước build.
  ```bash
  npm.cmd run lint
  ```
- [ ] **Security smoke pass**: Toàn bộ 22/22 kiểm tra bảo mật tĩnh phải vượt qua.
  ```bash
  node scripts/security-smoke-tests/security-smoke.mjs
  ```
- [ ] **Operator smoke pass**: Toàn bộ các kiểm tra vận hành (bao gồm cả visibility guard mới) phải vượt qua.
  ```bash
  node scripts/security-smoke-tests/operator-smoke.mjs
  ```

### 1.2. Môi trường & Quy tắc bảo mật
- [ ] **Firestore Rules**: Đảm bảo file `firestore.rules` đã được deploy lên môi trường staging và được test kỹ (kiểm tra phân quyền đọc/ghi ví dụ: block client viết trực tiếp coin/transaction).
- [ ] **Admin Login Test**: Kiểm tra xem cơ chế đăng nhập Admin bằng Firebase Auth kết hợp Machine Token có hoạt động trơn tru trên môi trường staging hay không.

### 1.3. Tính năng & Bảo mật dữ liệu (QA checklist)
- [ ] **Operator Draft Queue Test**: Tạo nội dung nháp giả lập bằng AI studio và gửi vào Owner Draft Queue.
- [ ] **Publish Test**: Thử phê duyệt (Approve) rồi Xuất bản (Publish) nội dung giả đó. Đảm bảo nút publish hoạt động chính xác và disabled khi chapter thiếu novel cha.
- [ ] **Rollback Test**: Thực hiện rollback nội dung đã xuất bản trên giao diện Admin.
- [ ] **Public Page Visibility Test**: 
  - Đảm bảo nội dung vừa bị rollback **KHÔNG** xuất hiện ở các trang public (`/`, `/tim-kiem`, `/blog`).
  - Đảm bảo không thể truy cập trực tiếp bằng URL của truyện/chương đã rollback (`/truyen/[slug]`, `/doc/[slug]/[chapter_id]`, `/blog/[slug]`).
- [ ] **Sitemap Index Filter Test**: Tải sitemap (`/sitemap.xml` hoặc `sitemap.ts`) để đảm bảo không chứa các URL của truyện/chương/blog bị rollback hoặc hidden/private.
- [ ] **PayOS Sandbox Configuration**: Tuyệt đối không test payment trên production. Đảm bảo cấu hình PayOS đã ở chế độ Sandbox (Test) với client credentials phù hợp.

---

## 2. Quy tắc tuyệt đối KHÔNG ĐƯỢC LÀM

- **Không test payment thật**: Không thực hiện thanh toán bằng tiền thật trên cổng thanh toán khi chưa cấu hình Sandbox hoàn tất.
- **Không xóa dữ liệu thật**: Tránh hoàn toàn việc sử dụng lệnh `delete` trực tiếp hoặc hard-delete trên Firestore staging/production. Mọi hành động xóa đều phải thông qua soft delete (`hidden: true` / `status: 'Tạm ẩn'`).
- **Không deploy Production**: Tuyệt đối không tự ý deploy lên nhánh main/production trước khi Owner dự án phê duyệt chính thức bằng văn bản hoặc kết quả Staging QA được ký duyệt.
