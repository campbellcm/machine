import { createDemoData } from "../src/lib/demo/data";
const data = createDemoData();
console.log(
  `Demo seed validated: ${data.teammates.length} teammates, ${data.posts.length} posts, ${data.clicks.length} clicks, ${data.conversions.length} conversions, 1 challenge.`,
);
console.log(
  "M0 fixtures are generated deterministically in memory on app startup. No database is connected or modified.",
);
