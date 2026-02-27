const puppeteer = require('puppeteer');

(async () => {
    console.log('Starting headless browser test...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Capture console messages
    page.on('console', msg => {
        console.log(`[Browser Console ${msg.type().toUpperCase()}]: ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
        console.log(`[Browser PageError]: ${error.message}`);
    });

    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    console.log('Page loaded! Checking if create button exists...');

    // Wait a moment for any async JS initialization
    await new Promise(r => setTimeout(r, 1000));

    const createBtn = await page.$('#create-btn');
    if (!createBtn) {
        console.log('ERROR: #create-btn not found on page!');
    } else {
        // Fill the form
        console.log('Filling out team creation form...');
        await page.type('#team-name-input', 'TestPuppeteerTeam');
        await page.select('#member-count', '3');
        await page.type('#team-password', 'testpass123');

        console.log('Clicking Create Team button...');
        await createBtn.click();

        // Wait for response or error
        await new Promise(r => setTimeout(r, 3000));

        const errorEl = await page.$('#login-error');
        if (errorEl) {
            const isVisible = await page.evaluate(el => el.style.display !== 'none', errorEl);
            if (isVisible) {
                const errText = await page.evaluate(el => el.textContent, errorEl);
                console.log(`[UI Error Message Visible]: ${errText}`);
            }
        }

        const teamTitle = await page.$('#team-title');
        if (teamTitle) {
            const text = await page.evaluate(el => el.textContent, teamTitle);
            console.log(`[UI Success state]: Found team title: ${text}`);
        }
    }

    await browser.close();
    console.log('Test finished.');
})();
