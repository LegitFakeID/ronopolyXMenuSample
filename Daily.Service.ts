import { Service, OnStart, OnInit } from "@flamework/core";
import { Players } from '@rbxts/services';

@Service({})
export class DailyService implements OnInit {
    private currentDay = 0;
    private rng = new Random();
    private callbacks = new Array<(rng : Random) => void>();
    
    onInit() { 
        //Set seed to current day
        this.checkNewDay()

        //Every time player joins, check if new day
        Players.PlayerAdded.Connect(() => {
            this.checkNewDay()
        })
    }

    getCurrentDay() {
        return this.currentDay
    }

    getRNG() {
        return this.rng.Clone()
    }

    private checkNewDay() { 
        const day = os.date("!*t").yday
        if (this.currentDay === day) return false;

        //Set current day to new day
        this.currentDay = day;

        //Set seed to new day
        this.rng = new Random(day)

        this.notfiyCallbacks()

        return true;
    }

    //notify there is a new day
    private notfiyCallbacks() {
        for (const callback of this.callbacks) {
            callback(this.getRNG())
        }
    }

    //register a callback to be called when there is a new day
    registerCallback(callback : (rng : Random) => void) {
        this.callbacks.push(callback)
    }
}