const puppeteer = require("puppeteer");
const { Cluster } = require("puppeteer-cluster");
require("dotenv").config();
//console.log(process.env);

const fs = require("fs");
let dataArray;

//Configure
const inputFilePath = "CustomTemplateIdList.csv";
const outputFilePath = "done.csv";
const numberOfBots = 1;
const debugMode = false;
const taskTimeOut = 1200 * 1000; //in milliseconds
const retryLimit = 1; //how many retries if a task fails
const botUsername = process.env.REALTAIR_USERNAME;
const botPassword = process.env.REALTAIR_PASSWORD;

GetInputFromFile();
// console.table(dataArray);

(async () => {
  //Initialize puppeteer-cluster settings
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: numberOfBots,
    timeout: taskTimeOut,
    retryLimit: retryLimit,
    monitor: debugMode,
    puppeteerOptions: {
      headless: debugMode,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        //'--single-process', // <- this one doesn't works in Windows
        "--disable-gpu",
      ],
    },
    workerCreationDelay: 60000,
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

    await GotoTemplatePage(page, customTemplateId);

    //Declare magic string variables
    const pencilIconClass = ".fa-pencil-alt";
    const submitBtnId = "#main-form-submit";
    const loadingScreenId = "#loader-wrapper";
    const updatingScreenIdName = "#wysiwyg-editor--preloader-underlay";
    const reloadingLoaderCssSelector =
      "#wysiwyg-editor-preloader > div.no-margin.font-white";
    const errorBtnCssSelector =
      "body > div.rt-toast-container > div > div > div > div > div > div.toast--error__footer > button";
    // const loadingScreenClass = '.no-margin.font-white';

    //try {
    await page.waitForSelector(reloadingLoaderCssSelector, { visible: true });
    // console.log("Loading screen found");
    await page.waitForSelector(reloadingLoaderCssSelector, {
      hidden: true,
      timeout: 120000,
    });
    // console.log("Loading screen finished.");
    //} catch (error) {
    //  console.error("Error in loading screen for customtemplate Id: "+customTemplateId);
    //  console.error(error);
    //}
    let compoCount = 0;
    compoCount = await page.$$eval(pencilIconClass, (compos) => compos.length);
    // console.log("Number of compos " + compoCount);

    if (compoCount !== 0 && compoCount !== null) {
      // console.log("Found compos!");
      try {
        await page.waitForSelector(pencilIconClass);
        // console.log("Found edit icong!");
      } catch (error) {
        console.error(
          "No pencil icon found for customtemplate Id: " + customTemplateId
        );
        console.error(error);
      }
      const compoEditButtons = await page.$$(pencilIconClass);
      // console.log("Got edit buttons");
      let compoIndex = 1;
      for (let element of compoEditButtons) {
        try {
          await element.click();
          await page.waitForTimeout(5000);
          // console.log("click the edit button");
        } catch (error) {
          console.error(
            "Error in clicking the compo edit button in custom template id: " +
              customTemplateId
          );
          console.error(error);
        }

        if ((await page.$(errorBtnCssSelector)) !== null) {
          console.log(
            "Error has occurred when clicking edit button of compo number " +
              compoIndex +
              " of customtemplate Id: " +
              customTemplateId
          );
          try {
            await page.click(errorBtnCssSelector);
          } catch (error) {
            console.error(
              "Error in clicking the error button in custom template id: " +
                customTemplateId
            );
            console.error(error);
          }
          compoIndex++;
          continue;
        }
        // console.log("No error found");

        const iframeClassName = "iframe.custom-sections-modal";
        if ((await page.$(iframeClassName)) !== null) {
          // console.log("Iframe loaded");
          let elementHandle;
          let frame;
          try {
            await page.waitForSelector(iframeClassName);
            await page.waitForSelector(loadingScreenId, { hidden: true });
            elementHandle = await page.$(iframeClassName);
            frame = await elementHandle.contentFrame();
          } catch (error) {
            console.error(
              "Error waiting for component frame in componentId: " +
                customTemplateId
            );
            console.error(error);
          }

          //Wait for the iframe to pop out and click on the submit button
          let finishedFlag = false;
          while (!finishedFlag) {
            //try {

            await frame.waitForSelector(loadingScreenId, { timeout: 120000 });
            //await frame.waitForSelector(loadingScreenId, { hidden: true });
            await frame.waitForSelector(submitBtnId, { visible: true });
            await frame.$eval(submitBtnId, (submitBtn) => {
              submitBtn.click();
            });
            // await frame.waitForSelector(loadingScreenId);
            // await frame.waitForSelector(loadingScreenId, { hidden: true });
            await page.waitForTimeout(3000);

            //} catch (error) {
            //  console.error("Error in resubmitting component number " + compoIndex+ " in customtemplate Id: "+ customTemplateId);
            //   console.error(error);
            //   finishedFlag = true;
            // }

            //check for error modal
            if ((await page.$(errorBtnCssSelector)) !== null) {
              //console.log("error modal detected!");
              try {
                await page.click(errorBtnCssSelector);
              } catch (error) {
                console.error(
                  "Error in clicking the error button in custom template id: " +
                    customTemplateId
                );
                console.error(error);
              }
            } else {
              //console.log("no error modal detected.");
              //try {
              await frame.waitForSelector(loadingScreenId);
              await frame.waitForSelector(loadingScreenId, {
                hidden: true,
                timeout: 120000,
              });
              //} catch (error) {
              //  console.error("Error in waiting for the loading screen in custom template id: " + customTemplateId);
              //  console.error(error);
              //}
            }

            //check if updating loading screen loads, meaning the cmoponent has been fully submitted.
            if (await page.$(updatingScreenIdName)) {
              // console.log("Finished updating");
              finishedFlag = true;
            }
          }

          //try {
          console.log(
            "Finished submitting component number " +
              compoIndex +
              "! In custom template id: " +
              customTemplateId
          );
          //await page.waitForSelector(updatingScreenIdName);
          //console.log("Found updating screen!");
          await page.waitForSelector(updatingScreenIdName, {
            hidden: true,
            timeout: 120000,
          });
          //console.log("Updating screen closed!");
          //} catch (error) {
          //  console.error("Error in waiting for the updating screen in custom template id: "+customTemplateId);
          //  console.error(error);
          //}
          //console.log("Checking for errors");

          //check if error modal appears after updating
          if ((await page.$(errorBtnCssSelector)) !== null) {
            //console.log("error modal detected!");
            try {
              await page.click(errorBtnCssSelector);
            } catch (error) {
              console.error(
                "Error in clicking the error button in custom template id: " +
                  customTemplateId
              );
              console.error(error);
            }
          }
          //console.log("Done checking for errors");
        }
        compoIndex++;
      }
      // console.log("Finished resubmitting all of the components.");
    }

    //click on settings tab
    //await UpdateCustomTemplateSettings(page, customTemplateId, loadingScreenId, reloadingLoaderCssSelector);

    //click the publish button
    //await PublishChanges(page, reloadingLoaderCssSelector, customTemplateId);
    await PublishChanges(
      page,
      reloadingLoaderCssSelector,
      customTemplateId,
      errorBtnCssSelector
    );

    //click on save changes button
    //await SaveChanges(page);
    // console.log("Saved changes!");
    // await page.waitForSelector("#page-wrapper > div > div.presentation-preview-toolbar.full-width.hidden-xs > div > div:nth-child(3) > ul > li:nth-child(2) > a",{ hidden: true});

    try {
      await page.waitForSelector("#wysiwyg-editor-preloader", { hidden: true });
      await page.waitForTimeout(5000);
    } catch (error) {
      console.error(
        "Error in final loading screen in custom template id: " +
          customTemplateId
      );
      console.error(error);
    }

    try {
      fs.writeFileSync(outputFilePath, customTemplateId.toString() + "\n", {
        flag: "a",
      });
    } catch (error) {
      console.error(
        "Error in writing the custom template Id to the done file in custom template id: " +
          customTemplateId
      );
      console.error(error);
    }

    console.log("Finished saving custom template id: " + customTemplateId);

    // await page.goto(pitchDashboardURL);

    // await page.waitForTimeout(5000);
    // await page.screenshot({ path: "example2.png" });
    // await browser.close();
  });

  //load the tasks
  // dataArray.forEach(customTemplateId => {
  //   cluster.queue(customTemplateId);
  // });

  cluster.queue(18895); //prod
  //cluster.queue(6529); //local
  //cluster.queue(6585); //staging

  //Error handling when task cannot be completed
  cluster.on("taskerror", (err, data, willRetry) => {
    if (willRetry) {
      console.warn(
        `Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`
      );
      fs.writeFileSync(
        outputFilePath,
        `First Error in custom template id ${data}. Error : ${err.message}\n`,
        { flag: "a" }
      );
    } else {
      console.error(`Failed to crawl ${data}: ${err.message}`);
      try {
        fs.writeFileSync(
          outputFilePath,
          `Final Error in custom template id ${data}. Error : ${err.message}\n`,
          { flag: "a" }
        );
      } catch (error) {
        console.error(
          "Can't write on outputfile for customtemplate id: " + customTemplateId
        );
      }
    }
  });

  await cluster.idle();
  await cluster.close();
})();

async function GotoTemplatePage(page, customTemplateId) {
  try {
    const url = `https://pitch.realtair.com/custom-template/${customTemplateId}/run/edit-custom-template?returnUrl=https://pitch.realtair.com/templates`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    //console.log("Going to template editor");
  } catch (error) {
    console.error(
      "Error navigating to templates page in custom template id: " +
        customTemplateId
    );
    console.error(error);
  }
}

function GetInputFromFile() {
  try {
    dataArray = fs
      .readFileSync(inputFilePath) //prod
      //dataArray = fs.readFileSync('staging-ct-id.csv') //staging
      .toString("UTF8")
      .split(/\r?\n/);
  } catch (e) {
    console.log("Error:", e.stack);
  }
}

async function PublishChanges(
  page,
  reloadingLoaderCssSelector,
  customTemplateId,
  errorBtnCssSelector
) {
  const publishBtnCssSelector =
    "#page-wrapper > div > div.presentation-preview-toolbar.full-width.hidden-xs > div > div:nth-child(3) > ul > li:nth-child(3) > a";
  try {
    await Promise.all([
      page.waitForSelector(reloadingLoaderCssSelector, { hidden: true }),
      page.$eval(publishBtnCssSelector, (publishBtn) => {
        publishBtn.click();
      }),
    ]);
    console.log("Clicked publish button.");
  } catch (error) {
    console.error(
      "Error in clicking publish in customtemplate id: " + customTemplateId
    );
    console.error(error);
  }

  if (await page.$(errorBtnCssSelector)) {
    console.error(
      "Error in publishing in customtemplate id: " + customTemplateId
    );
  } else {
    await page.waitForNavigation();
  }
}

async function PublishChanges(
  page,
  reloadingLoaderCssSelector,
  customTemplateId
) {
  const publishBtnCssSelector =
    "#page-wrapper > div > div.presentation-preview-toolbar.full-width.hidden-xs > div > div:nth-child(3) > ul > li:nth-child(3) > a";
  try {
    await Promise.all([
      page.waitForSelector(reloadingLoaderCssSelector, { hidden: true }),
      page.$eval(publishBtnCssSelector, (publishBtn) => {
        publishBtn.click();
      }),
    ]);
    console.log("Clicked publish button.");
  } catch (error) {
    console.error(
      "Error in clicking publish in customtemplate id: " + customTemplateId
    );
    console.error(error);
  }
}

async function CheckForErrorModal(
  page,
  errorBtnCssSelector,
  customTemplateId,
  frame,
  loadingScreenId
) {
  if ((await page.$(errorBtnCssSelector)) !== null) {
    //console.log("error modal detected!");
    try {
      await page.click(errorBtnCssSelector);
    } catch (error) {
      console.error(
        "Error in clicking the error button in custom template id: " +
          customTemplateId
      );
      console.error(error);
    }
  } else {
    //console.log("no error modal detected.");
    try {
      await frame.waitForSelector(loadingScreenId);
      await frame.waitForSelector(loadingScreenId, { hidden: true });
    } catch (error) {
      console.error(
        "Error in waiting for the loading screen in custom template id: " +
          customTemplateId
      );
      console.error(error);
    }
  }
}

async function SaveChanges(page) {
  const saveChangesBtnCssSelector =
    "#page-wrapper > div > div.presentation-preview-toolbar.full-width.hidden-xs > div > div:nth-child(3) > ul > li:nth-child(2) > a";
  try {
    await page.waitForSelector(saveChangesBtnCssSelector);
    // console.log("Found Save Button!");
  } catch (error) {
    console.error(
      "Error in looking for the save button in custom template id: " +
        customTemplateId
    );
  }

  try {
    await page.$eval(saveChangesBtnCssSelector, (saveBtn) => {
      saveBtn.click();
    });
    console.log("clicked on save button");
  } catch (error) {
    console.error("Error in saving in customtemplate id: " + customTemplateId);
    console.error(error);
  }
}

async function Login(page, pitchDashboardURL) {
  await page.goto(pitchDashboardURL);
  if ((await page.$("#username")) !== null) {
    // console.log("Found username field!");
    try {
      await page.type("#username", botUsername);
      await page.type('input[name="password"]', botPassword);
      const loginBtnId = "#login";
      await page.waitForSelector(loginBtnId);
      // console.log("Finished typing creds!");
      await Promise.all([
        page.waitForNavigation(),
        page.keyboard.press("Enter"),
      ]);
    } catch (error) {
      console.error(
        "Error in logging in custom template id: " + customTemplateId
      );
      console.error(error);
    }
  } else {
    console.log(
      "Cannot find username field in custom template id: " + customTemplateId
    );
  }
}

async function UpdateCustomTemplateSettings(
  page,
  customTemplateId,
  loadingScreenId,
  reloadingLoaderCssSelector
) {
  const settingsTabClass = "#settings > i";
  await page.waitForSelector(settingsTabClass);
  //console.log("Found settings!");
  try {
    await page.click(settingsTabClass);
  } catch (error) {
    console.error(
      "Error in clicking settings tab in customtemplate Id: " + customTemplateId
    );
    console.error(error);
  }

  //wait for the left pane loading screen to finish
  const leftPaneCssSelector =
    "#page-wrapper > div > div.full-width.presentation-preview__center.presentation-preview__center--template-editor > div > div > iframe";
  const leftPaneElementHandle = await page.$(leftPaneCssSelector);
  const leftPaneFrame = await leftPaneElementHandle.contentFrame();
  await leftPaneFrame.waitForSelector(loadingScreenId, { visible: true });
  //console.log("Left pane loading screen appeared!");
  await leftPaneFrame.waitForSelector(loadingScreenId, { hidden: true });
  //console.log("Left pane loading screen gone");
  await page.waitForTimeout(3000);

  //click on the yes enable logo branding
  //TODO: check if logobranding enable checkbox exists
  const enableLogoBrandingCheckBoxId = "#LogoBrandingEnabled-true";
  if ((await leftPaneFrame.$(enableLogoBrandingCheckBoxId)) !== null) {
    try {
      await leftPaneFrame.click(enableLogoBrandingCheckBoxId);
    } catch (error) {
      console.error("Error in clicking on the enable logo branding checkbox");
      console.error(error);
    }
  }

  //click the settings submit button
  try {
    await leftPaneFrame.waitForSelector(
      ".btn.btn-task.btn-form.btn-trans-green.uppercase"
    );
    await leftPaneFrame.click(
      ".btn.btn-task.btn-form.btn-trans-green.uppercase"
    );
    console.log("Clicked settings submit button");
  } catch (error) {
    console.error(
      "Error in clicking settings submit button in customtemplate Id: " +
        customTemplateId
    );
    console.error(error);
  }

  //wait for the reloading screen button to finish
  await page.waitForSelector(reloadingLoaderCssSelector, { visible: true });
  await page.waitForSelector(reloadingLoaderCssSelector, { hidden: true });
}
