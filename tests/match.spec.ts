import { expect, test } from '@playwright/test';

test('two players see a capture, a countdown, and a SHIFT in the library', async ({page}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(()=>{ Math.random=()=>0; });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('radio',{name:'Thư viện'}).check();
  await expect(page.locator('#location')).toHaveText('Thư viện');
  await page.getByRole('button',{name:'Quay sự kiện và bắt đầu'}).click();
  await expect(page.locator('#turn')).toHaveText('Lượt Trắng');
  const move = async (from: string,to: string,next: string) => {
    await page.locator('#piece').selectOption(from);
    await page.locator('#targets').getByRole('button',{name:to,exact:true}).click();
    await expect(page.locator('#turn')).toHaveText(next);
  };
  await move('e2','e4','Lượt Đen');
  await move('d7','d5','Lượt Trắng');
  await move('e4','d5','Lượt Đen');
  await expect(page.locator('#log')).toContainText('exd5');
  await move('g8','f6','Lượt Trắng');
  await expect(page.locator('#event')).toContainText('a8 ↔ b8');
  await expect(page.locator('#event')).toContainText('Còn 2 nước');
  await page.screenshot({ path:testInfo.outputPath('library.png') });
  await move('g1','f3','Lượt Đen');
  await expect(page.locator('#event')).toContainText('Còn 1 nước');
  await move('b8','c6','Lượt Trắng');
  await expect(page.locator('#event')).toContainText('SHIFT đã đổi vị trí.');
  await page.getByRole('button',{name:'Toàn bàn'}).click();
  await expect(page.getByRole('button',{name:'Nhập vai'})).toBeVisible();
  expect(errors).toEqual([]);
});
