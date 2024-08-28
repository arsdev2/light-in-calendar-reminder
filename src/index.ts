import {DaySchedule, isScheduleEventsTheSame} from "./oblenergo";
import {notifyAboutChanges} from "./tgbot";
const { createServer } = require('node:http');
const { getScheduleInfo } = require('./oblenergo')
const calendar = require('./calendar')
const {fs} = require('fs')
const hostname = '0.0.0.0';
const port = 3056;

async function addEvents(calendarId: string, schedule: DaySchedule) {
    let existingEvents = await calendar.getEventsByTimeRange(calendarId, schedule.timeRangeStart, schedule.timeRangeEnd)
    let calendarWasEmpty = existingEvents.length == 0
    if(isScheduleEventsTheSame(existingEvents, schedule.events)) {
        return
    }
    if(!calendarWasEmpty) {
        await calendar.deleteEventsByTimeRange(calendarId, schedule.timeRangeStart, schedule.timeRangeEnd)
    }
    await calendar.addEvents(calendarId, schedule.events)
    if(!calendarWasEmpty) {
        await notifyAboutChanges(schedule.scheduleInfo, schedule.events)
    }
}

async function handleAccountNumber(accountNumber: number) {
    let scheduleInfo = await getScheduleInfo(accountNumber)
    for(let scheduleInfoIndex in scheduleInfo) {
        let schedule = scheduleInfo[scheduleInfoIndex]
        let queueId = schedule.scheduleInfo.queue.toString() + schedule.scheduleInfo.subqueue.toString()
        let calendarId = await calendar.getCalendarId(queueId)
        console.log(calendarId)
        await addEvents(calendarId, schedule)
    }
}

async function parseAccountNumber(url: string) {
    const accountNumberInt = parseInt(url.trim().replace("/", ""));
    if(!isNaN(accountNumberInt)) {
        console.log(accountNumberInt)
        await handleAccountNumber(accountNumberInt)
    }
}

const server = createServer((req: any, res: any) => {
    parseAccountNumber(req.url).then(()=>{
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello World');
    }).catch((err)=> {
        console.error(err)
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/plain')
        res.end("Bad Request")
    })

});
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
