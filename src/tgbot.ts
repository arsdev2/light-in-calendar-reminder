const TelegramBot = require('node-telegram-bot-api');
const CHAT_ID = process.env.TG_CHAT_ID
const BOT_TOKEN = process.env.BOT_TOKEN
const bot = new TelegramBot(BOT_TOKEN, {polling: false});
import {ScheduleEvent, ScheduleInfo} from "./oblenergo";

export async function notifyAboutChanges(scheduleInfo: ScheduleInfo, events: ScheduleEvent[]) {
    await bot.sendMessage(CHAT_ID, [`Графіки в ${scheduleInfo.queue}.${scheduleInfo.subqueue} змінились.`].concat(events.map((it) => {
        return [it.startTime.format().replace("T", " "), "  - ", it.endTime.format().replace("T", " ")].join("")
    })).join("\n"))
}