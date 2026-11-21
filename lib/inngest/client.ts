import { Inngest } from "inngest";
export const inngest = new Inngest({
  id:"ai-vid",
  isDev:process.env.INNGEST_DEV==="1",
  eventKey:process.env.INNGEST_EVENT_KEY,
});

