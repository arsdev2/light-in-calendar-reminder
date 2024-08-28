import {ScheduleEvent} from "./oblenergo"
const fs = require('fs')
const path = require('path');
const process = require('process');
const {Auth, google} = require('googleapis');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const CALENDARS_PATH = path.join(process.cwd(), 'calendars.json')
import tz from 'moment-timezone'
import {calendar_v3} from "googleapis";
import Schema$Event = calendar_v3.Schema$Event;

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
];

let auth: any = null;
let calendar: any | null = null;

async function checkAuth() {
    if(auth != null) return
    let credentialsString = process.env.GOOGLE_API_CREDS
    await fs.writeFileSync(CREDENTIALS_PATH, credentialsString)
    let gAuth = new Auth.GoogleAuth({
        scopes: SCOPES,
        keyFile: CREDENTIALS_PATH,
    })
    auth = await gAuth.getClient();
    calendar = google.calendar({version: 'v3', auth});
}

export async function addEvents(calendarId: string, events: ScheduleEvent[]) {
    await checkAuth()
    for(let eventIndex in events) {
        let event = events[eventIndex]
        if((await checkForDeletedStatusEvent(calendarId, event))) {
            await calendar.events.insert( {
                calendarId: calendarId,
                requestBody: {
                    summary: "Не буде світла",
                    start: {
                        dateTime: event.startTime.format(),
                        timeZone: "Europe/Kyiv"
                    },
                    end: {
                        dateTime: event.endTime.format(),
                        timeZone: "Europe/Kyiv"
                    },
                    id: event.hash,
                    sendUpdates: "none"
                }
            } )
        }
    }
}

/**
 * Returns true if event should be inserted, false otherwise
 * @param calendarId
 * @param event
 */
async function checkForDeletedStatusEvent(calendarId: string, event: ScheduleEvent) {
    try {
        let gEvent = await calendar.events.get( {
                calendarId: calendarId,
                eventId: event.hash
            }
        )
        if(gEvent.data.status === "cancelled") {
            await calendar.events.update({
                calendarId: calendarId,
                eventId: event.hash,
                requestBody: {
                    summary: "Не буде світла",
                    start: {
                        dateTime: event.startTime.format(),
                        timeZone: "Europe/Kyiv"
                    },
                    end: {
                        dateTime: event.endTime.format(),
                        timeZone: "Europe/Kyiv"
                    },
                    status: "confirmed",
                    sendUpdates: "none"
                }
            })
        } else {
            console.log("Event already exists")
        }
        return false
    }catch (e) {
        return true
    }
}

export async function deleteEventsByTimeRange(calendarId: string, fromTimeRange: tz.Moment, toTimeRange: tz.Moment) {
    await checkAuth()
    let gEvents = await calendar.events.list({
            calendarId: calendarId,
            timeMin: fromTimeRange.format(),
            timeMax: toTimeRange.format()
        }
    ).data?.items
    if(!gEvents) {
        return
    }
    for(let i = 0;i < gEvents.length;i++) {
        let gEvent = gEvents[i]
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: gEvent.id
        })
    }
}

export async function getEventsByTimeRange(calendarId: string, fromTimeRange: tz.Moment, toTimeRange: tz.Moment): Promise<ScheduleEvent[]> {
    await checkAuth()
    let oldGEvents = await calendar.events.list({
            calendarId: calendarId,
            timeMin: fromTimeRange.format(),
            timeMax: toTimeRange.format()
        }
    )
    return oldGEvents.data.items.map((el: Schema$Event) => {
        const startTime = el.start?.dateTime;
        const startTimeZone = el.start?.timeZone;
        const endTime = el.end?.dateTime;
        const endTimeZone = el.end?.timeZone;
        return new ScheduleEvent(
            tz.tz(startTime, startTimeZone),
            tz.tz(endTime, endTimeZone)
        );
    })
}


async function createCalendar(title: string) {
    await checkAuth()
    let res = await calendar.calendars.insert({
        requestBody: {
            summary: title
        }
    })
    console.log(res)
    console.log(res.data)
    return res.data.id
}

async function addMyself(calendarId: string) {
    await checkAuth()
    let res = await calendar.acl.insert({
        calendarId: calendarId,
        requestBody: {
            role: "owner",
            scope: {
                type: "user",
                value: "senjka4@gmail.com"
            }
        }
    })
    console.log(res)
}

export async function getCalendarId(queueId: string): Promise<string> {
    const calendarsJson = JSON.parse(fs.readFileSync(CALENDARS_PATH))
    if(calendarsJson[queueId]) {
        return calendarsJson[queueId]
    } else {
        let newCalendarId = await createCalendar(`Черга ${queueId.charAt(0)}.${queueId.charAt(1)}`)
        await addMyself(newCalendarId)
        calendarsJson[queueId] = newCalendarId
        await fs.writeFileSync(CALENDARS_PATH, JSON.stringify(calendarsJson))
        return newCalendarId
    }
}