const fs = require('fs');
const path = 'server/index.ts';
const bak = path + '.bak';
fs.copyFileSync(path, bak);
let s = fs.readFileSync(path, 'utf8');
const oldBlock = `  // Start scheduler immediately. It will skip cycles while the model is still training
  // and fire as soon as training completes. Model training runs in parallel.
  void (async () => {
    try {
      // Start scheduler first so the interval timer is registered immediately
      await initPriceScheduler();
    } catch (error) {
      console.error("Scheduler init failed:", error);
    }
  })();

  void (async () => {
    try {
      await initializePricingModel();
      console.log("\\u{1F4B0} Pricing model ready");
    } catch (error) {
      console.error("Pricing model init failed:", error);
    }
  })();\n`;
const newBlock = `  // Start scheduler and model training depending on environment variables.
  // In constrained environments (free builders), set \`DISABLE_SCHEDULER=true\`
  // and/or \`DISABLE_MODEL_TRAINING=true\` to avoid heavy background work.
  const disableScheduler = String(process.env.DISABLE_SCHEDULER || "false").toLowerCase() === "true";
  const disableModelTraining = String(process.env.DISABLE_MODEL_TRAINING || "false").toLowerCase() === "true";

  if (!disableScheduler) {
    void (async () => {
      try {
        // Start scheduler first so the interval timer is registered immediately
        await initPriceScheduler();
      } catch (error) {
        console.error("Scheduler init failed:", error);
      }
    })();
  } else {
    console.log("Scheduler disabled by DISABLE_SCHEDULER=true");
  }

  if (!disableModelTraining) {
    void (async () => {
      try {
        await initializePricingModel();
        console.log("\\u{1F4B0} Pricing model ready");
      } catch (error) {
        console.error("Pricing model init failed:", error);
      }
    })();
  } else {
    console.log("Model training disabled by DISABLE_MODEL_TRAINING=true");
  }
`;
if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
  fs.writeFileSync(path, s, 'utf8');
  console.log('UPDATED');
} else {
  console.log('OLD BLOCK NOT FOUND');
}
