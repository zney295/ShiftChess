import { expect, test, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';

async function fitsScreen(page: Page, selectors: string[]) {
  const {width,height}=page.viewportSize()!;
  for (const selector of selectors) {
    const bounds=await page.locator(selector).boundingBox();
    expect(bounds,selector).not.toBeNull();
    expect(bounds!.x,selector).toBeGreaterThanOrEqual(0);
    expect(bounds!.y,selector).toBeGreaterThanOrEqual(0);
    expect(bounds!.x+bounds!.width,selector).toBeLessThanOrEqual(width+1);
    expect(bounds!.y+bounds!.height,selector).toBeLessThanOrEqual(height+1);
  }
  expect(await page.evaluate(()=>({
    width:document.scrollingElement!.scrollWidth,
    height:document.scrollingElement!.scrollHeight,
  }))).toEqual({width,height});
}

test('click the piece and destination, then continue on a compact screen', async ({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/');
  await fitsScreen(page,['#start','#locale']);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.getByRole('button',{name:'Chuyển sang tiếng Việt'}).click();
  await page.getByRole('button',{name:'Bắt đầu',exact:true}).click();
  await expect(page.locator('#start-screen')).toBeHidden();
  await expect(page.getByRole('heading',{name:'Quay bản đồ'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Vào ván'})).toBeHidden();
  for (const viewport of [{width:320,height:480},{width:667,height:375}]) {
    await page.setViewportSize(viewport);
    await fitsScreen(page,['#random-title','#wheel','#spin','#back']);
  }
  await page.setViewportSize({width:1280,height:720});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'Quay',exact:true}).click();
  await expect(page.getByRole('button',{name:'Vào ván'})).toBeHidden();
  await expect(page.locator('#roll')).toHaveText(/^(Công viên|Thư viện)$/);
  await expect(page.locator('#random-screen')).not.toContainText(/Đổi chỗ|Dịch quân|Đổi kép/);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button',{name:'Vào ván'}).click();
  await expect(page.locator('#turn')).toHaveText('Lượt Trắng');
  await expect(page.locator('#shift-heading')).toHaveText('Luật ngẫu nhiên');
  await expect(page.locator('#random-screen')).toBeHidden();

  const canvas=(await page.locator('canvas').boundingBox())!;
  const camera=new PerspectiveCamera(47,canvas.width/canvas.height,.1,80);
  async function clickWorld(x: number,y: number,z: number) {
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    camera.updateMatrixWorld();
    const pos=new Vector3(x,y,z).project(camera);
    await page.mouse.click(canvas.x+(pos.x+1)*canvas.width/2,canvas.y+(1-pos.y)*canvas.height/2);
  }
  camera.position.set(0,5.9,8.65);
  camera.lookAt(0,.26,0);
  await clickWorld(.5,.73,2.5); // Head of the pawn on e2.
  await expect(page.locator('#piece')).toHaveValue('e2');
  camera.position.set(.465,2.054,5.3);
  camera.lookAt(.365,.254,.45);
  await clickWorld(.5,.004,.5); // e4 tile.
  await expect(page.locator('#turn')).toHaveText('Lượt Đen');
  await page.getByRole('button',{name:'Toàn bàn'}).click();
  await expect(page.getByRole('button',{name:'Nhập vai'})).toBeVisible();
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.locator('#turn')).toHaveText('Black to move');

  for (const viewport of [{width:360,height:640},{width:320,height:480},{width:667,height:375}]) {
    await page.setViewportSize(viewport);
    await fitsScreen(page,['canvas','#view','#settings','#event','#piece','#target','#confirm-move','#locale']);
  }
  await page.locator('#piece').selectOption('e7');
  await page.locator('#target').selectOption('e5');
  await page.getByRole('button',{name:'Move',exact:true}).click();
  await expect(page.locator('#turn')).toHaveText('White to move');

  await page.getByRole('button',{name:'New game'}).click();
  await expect(page.locator('canvas')).toBeHidden();
  await fitsScreen(page,['#start','#locale']);
  await page.setViewportSize({width:320,height:480});
  await fitsScreen(page,['#start','#locale']);
});
