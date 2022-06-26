const puppeteer = require("puppeteer");
const { Cluster } = require('puppeteer-cluster');
(async () => {

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 14,
    timeout: 600 * 1000,
    monitor: false,
    puppeteerOptions: {
      headless: true,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    }
  });

  await cluster.task(async ({ page, data: customTemplateId }) => {
    // const browser = await puppeteer.launch({
    //   headless: false
    // });
    // const context = await browser.createIncognitoBrowserContext();
    // const page = await context.newPage();
    // const page = await browser.newPage();
    //await page.setViewport({width: 1202, height: 960});

    const pitchProdURL = "https://pitch.realtair.com";
    const pitchStagingURL = "https://staging-pitch.realtair.com";  
    const pitchDashboardURL = pitchProdURL;
  
    await Login(page, pitchDashboardURL);
  
    //get custom template id from sheet
    // let customTemplateId = "21268";
  
    await page.goto(
      "https://pitch.realtair.com/custom-template/"+customTemplateId+"/run/edit-custom-template?returnUrl=https://pitch.realtair.com/templates",
      { waitUntil: "domcontentloaded" }
    );
  
    //Declare magic string variables
    const pencilIconClass = ".fa-pencil-alt";
    const submitBtnId = "#main-form-submit";
    const loadingScreenId = "#loader-wrapper";
    const updatingScreenIdName = "#wysiwyg-editor--preloader-underlay";
    const reloadingLoaderCssSelector =
      "#wysiwyg-editor-preloader > div.no-margin.font-white";
    const errorBtnCssSelector = "body > div.rt-toast-container > div > div > div > div > div > div.toast--error__footer > button";
    // const loadingScreenClass = '.no-margin.font-white';
    
    try {
      await page.waitForSelector(reloadingLoaderCssSelector, { visible: true });
      console.log("Loading screen found");
      await page.waitForSelector(reloadingLoaderCssSelector, { hidden: true });
      console.log("Loading screen finished.");
    } catch (error) {
      console.error("Error in loading screen for customtemplate Id: "+customTemplateId);
      console.error(error);
    }
    let compoCount = 0;
    compoCount = await page.$$eval(
      pencilIconClass,
      (compos) => compos.length
    );
    console.log("Number of compos " + compoCount);
    
    if( compoCount !== 0 && compoCount !== null){
      // console.log("Found compos!");
      try {
        await page.waitForSelector(pencilIconClass);
        // console.log("Found edit icong!");
  
      } catch (error) {
        console.error("No pencil icon found for customtemplate Id: "+customTemplateId);
        console.error(error);
      }
      const compoEditButtons = await page.$$(pencilIconClass);
      // console.log("Got edit buttons");
      let compoIndex = 1;
      for (let element of compoEditButtons) {
        await element.click();
        await page.waitForTimeout(3000);
        console.log("click the edit button");
        if(await page.$(errorBtnCssSelector) !== null){
          console.log("Error has occurred when clicking edit button of compo number "+compoIndex+ " of customtemplate Id: "+ customTemplateId);
          // await page.waitForTimeout(10000);
          await page.click(errorBtnCssSelector);
          // console.log("Clicked the error button");
          continue;
        }
        console.log("No error found");

        const iframeClassName = "iframe.custom-sections-modal";
        if(await page.$(iframeClassName) !== null){
          // console.log("Iframe loaded");
          await page.waitForSelector(iframeClassName);
          await page.waitForSelector(loadingScreenId, { hidden: true });
          const elementHandle = await page.$(iframeClassName);
          const frame = await elementHandle.contentFrame();
      
          //Wait for the iframe to pop out and click on the submit button
          let finishedFlag = false;
          while (!finishedFlag) {
            try {
              await Promise.all([
                // await frame.waitForSelector(loadingScreenId),
                // await frame.waitForSelector(loadingScreenId, { hidden: true }),
                await frame.waitForSelector(submitBtnId, { visible: true }),
                await frame.click(submitBtnId),
                await page.waitForTimeout(2000),
              ]);
            } catch (error) {
              console.error("Error in resubmitting component number " + compoIndex+ " in customtemplate Id: "+ customTemplateId);
              console.error(error);
              finishedFlag = true;
            }

            if(await page.$(errorBtnCssSelector) !== null){
              await page.click(errorBtnCssSelector);
            }else{
              await frame.waitForSelector(loadingScreenId),
              await frame.waitForSelector(loadingScreenId, { hidden: true })
            }
            //TODO: Handle what happens when there's an error in resubmitting the component.  
            //check if updating loading screen loads, meaning the cmoponent has been fully submitted.
            if (await page.$(updatingScreenIdName)) {
              finishedFlag = true;
            }
          }
      
          console.log("Finished submitting component number " + compoIndex + "!");
          await page.waitForSelector(updatingScreenIdName, { hidden: true });
  
        }
        compoIndex++;
      }
      console.log("Finished resubmitting all of the components.");
    }

  
    //click on settings tab
    const settingsTabClass = "#settings > i";
    await page.waitForSelector(settingsTabClass);
    console.log("Found settings!");
    try {
      await page.click(settingsTabClass);
    } catch (error) {
      console.error("Error in clicking settings tab in customtemplate Id: "+customTemplateId);
      console.error(error);
    }

    //wait for the left pane loading screen to finish
    const leftPaneCssSelector =
      "#page-wrapper > div > div.full-width.presentation-preview__center.presentation-preview__center--template-editor > div > div > iframe";
    const leftPaneElementHandle = await page.$(leftPaneCssSelector);
    const leftPaneFrame = await leftPaneElementHandle.contentFrame();
    await leftPaneFrame.waitForSelector(loadingScreenId, { visible: true });
    console.log("Left pane loading screen appeared!");
    await leftPaneFrame.waitForSelector(loadingScreenId, { hidden: true });
    console.log("Left pane loading screen gone");
    await page.waitForTimeout(3000);

    //click on the yes enable logo branding
    //TODO: check if logobranding enable checkbox exists
    try{
      await page.click("#LogoBrandingEnabled-true");
    }catch(error){
      console.error("Error in clicking on the enable logo branding checkbox");
      console.error(error);
    }
  
    //click the settings submit button
    try {
      await leftPaneFrame.waitForSelector(".btn.btn-task.btn-form.btn-trans-green.uppercase");
      await leftPaneFrame.click(".btn.btn-task.btn-form.btn-trans-green.uppercase");
      console.log("Clicked settings submit button");
    } catch (error) {
      console.error("Error in clicking settings submit button in customtemplate Id: "+customTemplateId);
      console.error(error);
    }
  
    //wait for the reloading screen button to finish
    await page.waitForSelector(reloadingLoaderCssSelector, { visible: true });
    await page.waitForSelector(reloadingLoaderCssSelector, { hidden: true });
  
    //click the publish button
    const publishBtnCssSelector =
      "#page-wrapper > div > div.presentation-preview-toolbar.full-width.hidden-xs > div > div:nth-child(3) > ul > li:nth-child(3) > a";
    try {
      await Promise.all([
        page.waitForSelector(reloadingLoaderCssSelector, {hidden: true}),
        page.$eval(publishBtnCssSelector, (publishBtn) => {
          publishBtn.click();
        }),
      ]);
      console.log("Clicked publish button.");
    } catch (error) {
      console.error("Error in clicking publish in customtemplate id: "+ customTemplateId);
      console.error(error);
    }

    if(await page.$(errorBtnCssSelector)){
      console.error("Error in publishing in customtemplate id: "+customTemplateId);
    }
    else{
      await page.waitForNavigation();
    }
    // await page.goto(pitchDashboardURL);
  
    // await page.waitForTimeout(5000);
    // await page.screenshot({ path: "example2.png" });
    // await browser.close();    
  });

  cluster.queue(1);
  cluster.queue(4);
  cluster.queue(5);
  cluster.queue(43);
  cluster.queue(46);
  cluster.queue(64);
  cluster.queue(70);
  cluster.queue(72);
  cluster.queue(82);
  cluster.queue(84);



  await cluster.idle();
  await cluster.close();

})();

async function Login(page, pitchDashboardURL) {
  await page.goto(pitchDashboardURL);
  if ((await page.$("#username")) !== null) {
    console.log("Found username field!");
    try {
      await page.type("#username", "erickm@realtair.com");
      await page.type('input[name="password"]', "Y3x5JJfVBJ9ELC4h");

      console.log("Finished typing creds!");
      await Promise.all([page.waitForNavigation()],page.click("#login"));
    } catch (error) {
      console.error("Error in logging in.");
      console.error(error);
    }
  }
  else{
    console.log("Cannot find username field!");
  }
}
