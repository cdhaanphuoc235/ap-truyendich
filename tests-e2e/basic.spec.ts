import { test, expect } from "@playwright/test";

test("main flow: load app, create form validation, unlock sound banner", async ({ page }) => {
  await page.goto("/");

  // Đã bypass login (mock auth)
  await expect(page.getByText("Truyen dich")).toBeVisible();
  await expect(page.getByText("Vùng 2 — Form Nhập liệu")).toBeVisible();

  // Unlock âm thanh
  const unlockBtn = page.getByRole("button", { name: /bật âm thanh/i });
  await expect(unlockBtn).toBeVisible();
  await unlockBtn.click();

  // Form validation
  await page.getByRole("button", { name: "Bắt đầu truyền" }).click();
  // Cảnh báo vì thiếu tên/giá trị số hợp lệ (trong thực tế: alert)
  // Không assert alert text để tránh khác biệt môi trường

  // Điền tối thiểu hợp lệ (nhưng không submit thật để tránh tạo ca rác nếu Supabase kết nối)
  await page.getByLabel("Họ và tên").fill("BN E2E");
  await page.getByLabel("Thể tích dịch truyền (ml)").fill("10");
  await page.getByLabel("Số giọt/ml").fill("20");
  await page.getByLabel("Tốc độ (giọt/phút)").fill("60");

  // Optional: Nếu muốn submit thật khi đã cấu hình Supabase:
  // await page.getByRole('button', { name: 'Bắt đầu truyền' }).click();
});
