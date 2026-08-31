const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('youfi_guest_user', JSON.stringify({ id: '123', email: 'test@youfi.app' }));
    localStorage.removeItem('youfi_logged_out');
  });
  
  console.log("Navigating to dashboard...");
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  console.log("Dashboard loaded.");
  
  await browser.close();
})();
