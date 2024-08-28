import fetch from 'node-fetch'
import {HttpsProxyAgent} from "https-proxy-agent"
import tz from 'moment-timezone'
const timezone = "Europe/Kyiv";
const { getHash }  = require("./hash")

export class ScheduleEvent {
    startTime: tz.Moment
    endTime: tz.Moment
    hash: String
    constructor(startTime: tz.Moment, endTime: tz.Moment) {
        this.startTime = startTime
        this.endTime = endTime
        const input = startTime.format() + endTime.format();
        this.hash = getHash(input)
    }
}

export class DaySchedule {
    events: ScheduleEvent[]
    timeRangeStart: tz.Moment
    timeRangeEnd: tz.Moment
    scheduleInfo: ScheduleInfo
}

class OblenergoResponse {
    current: ScheduleInfo
    graphs: OblenergoGraphs
}

class OblenergoGraphs {
    today: OblenergoSchedule | null
    tomorrow: OblenergoSchedule | null
}

class OblenergoSchedule {
    eventDate: string
    hoursList: OblenergoHourInfo[]
}

class OblenergoHourInfo {
    hour: string
    electricity: number
    description: string
}

export class ScheduleInfo {
    hasQueue: string
    note: string
    queue: number
    subqueue: number
}

const proxyHost = process.env.PROXY_IP;
const proxyPort = parseInt(process.env.PROXY_PORT);
const username = process.env.PROXY_USERNAME
const password = process.env.PROXY_PASS
const proxyAgent = new HttpsProxyAgent(`http://${username}:${password}@${proxyHost}:${proxyPort}`);

export function isScheduleEventsTheSame(eventsA: ScheduleEvent[], eventsB: ScheduleEvent[]): boolean {
    if(eventsA.length != eventsB.length) {
        return false
    }
    for (let i = 0;i<eventsA.length;i++) {
        let eventA = eventsA[i]
        let found = false
        for(let j = 0;j<eventsB.length;j++) {
            if(eventA.hash == eventsB[j].hash) {
                found = true
                break
            }
        }
        if(!found) {
            return false
        }
    }
    return true
}

export async function getScheduleInfo(accountNumber: string | number): Promise<DaySchedule[]> {
    let oblenergoResponse = await fetchOblengergoData(accountNumber)
    let result: DaySchedule[] = []
    const today = oblenergoResponse.graphs.today;
    const todayMoment = tz.tz(timezone);

    if(today != null) {

        result.push({
            events: parseOblenergoToScheduleEvent(today),
            timeRangeStart: todayMoment.clone().hour(0).minute(0).second(0),
            timeRangeEnd: todayMoment.clone().hour(23).minute(59).second(59),
            scheduleInfo: oblenergoResponse.current
        } as DaySchedule)
    }
    const tomorrow = oblenergoResponse.graphs.tomorrow;
    if(tomorrow != null) {
        const tomorrowMoment = todayMoment.clone().add(1, 'days');
        result.push({
            events: parseOblenergoToScheduleEvent(tomorrow),
            timeRangeStart: tomorrowMoment.clone().hour(0).minute(0).second(0),
            timeRangeEnd: tomorrowMoment.clone().hour(23).minute(59).second(59),
            scheduleInfo: oblenergoResponse.current
        } as DaySchedule)
    }
    return result
}

function parseOblenergoToScheduleEvent(graph: OblenergoSchedule): ScheduleEvent[] {
    let arr = []
    let currentDate = graph.eventDate
    let hours = graph.hoursList
    for(let i = 0;i < hours.length;i++) {
        let startHour = hours[i]
        if(startHour.electricity) {
            let k = i
            for(;k + 1 < hours.length && hours[k + 1].electricity;k++){
            }
            let endHour = hours[k]
            i = k
            let obj = new ScheduleEvent(
                tz.tz(`${currentDate} ${startHour.description.split("-")[0]}`, timezone),
                tz.tz(`${currentDate} ${endHour.description.split("-")[1]}`, timezone)
            )
            arr.push(obj)
        }
    }
    return arr

}

async function fetchOblengergoData(accountNumber: string | number): Promise<OblenergoResponse> {
    let bodyString = `accountNumber=${accountNumber}&userSearchChoice=pob&address=`;
    let res = await fetch("https://svitlo.oe.if.ua/GAVTurnOff/GavGroupByAccountNumber", {
        "body": bodyString,
        "headers": {
            "accept": "*/*",
            "accept-language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7,ru-UA;q=0.6,ru;q=0.5",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        "method": "POST",
        "agent": proxyAgent
    });
    return await res.json()
}