import { Service, OnStart, OnInit, Dependency } from "@flamework/core";
import {NUMBER_OF_QUESTS, Quest, EMPTY_QUEST, QUESTS} from "shared/data"
import { Events, Functions } from "server/network";
import { Players } from '@rbxts/services';
import { IQuestService } from "../../Classes/IQuestService.interface";
import { DataService } from "./Data.Service";
import { DailyService } from "../Daily.Service";
import { ServerSender } from "@flamework/networking/out/events/types";
import { Shuffler } from "server/Classes/Shuffler.class";

/**
 * Handles quest data for a player.
 */
@Service({})
export class QuestService implements OnStart {
    private quests = new Array<Quest>(NUMBER_OF_QUESTS, EMPTY_QUEST);

    constructor(private readonly dataService : DataService, private readonly dailyService : DailyService) {}
    
    onStart() {
        this.quests = Shuffler.shuffle(QUESTS, NUMBER_OF_QUESTS, this.dailyService.getRNG())

        this.dailyService.registerCallback((rng) => this.newDay(rng))
        //may not work in testing, look at player added notes
        Players.PlayerAdded.Connect((player) => {
            this.setStatus(Players.WaitForChild("LegitFakeID") as Player, 0, 0)
            this.resetQuestStatuses(player)
        })

        this.connectFunctions();
        
        this.test()
        
    }

    test() {

        wait(5)

        this.setStatus(Players.WaitForChild("LegitFakeID") as Player, 0, 1)
    }

    private connectFunctions() {
        Functions.getQuests.setCallback((player) => {
            return this.getQuests()
        })

        Functions.getQuestStatuses.setCallback(async (player) => {
            return await this.getAllStatuses(player)
        })

        Functions.claimQuest.setCallback(async (player, index) => {
            return await this.claimQuest(player, index)
        })
    }

    /**
     * Checks if there is a new day, if so assigned new quests to all players.
     * Connected to {@link Players.PlayerAdded} event, so will run every time a player joins.
     */
    private newDay(rng : Random) { 
        //Generate new quests
        this.quests = Shuffler.shuffle(QUESTS, NUMBER_OF_QUESTS, rng)
        Events.newQuests.broadcast(this.quests)

        //Reset quest status for all players
        Players.GetPlayers().forEach((player) => {
            this.resetQuestStatuses(player);
        })
    }

    /**
     * Sets the join day and quest statuses to 0 for a player, if they haven't joined today.
     * @param player 
     */
    private async resetQuestStatuses(player: Player) {
        const currentDay = this.dailyService.getCurrentDay();
        //Check if player has joined today
        if (await this.dataService.get(player, "lastJoinDay") === currentDay) {
            return;
        }

        this.dataService.set(player, "lastJoinDay", currentDay)
        this.dataService.set(player, "questStatuses", new Array<number>(NUMBER_OF_QUESTS,0));
    }

    private getQuests() : Quest[] {
        return this.quests;
    }

    private getQuest(index : number) : Quest {
        return this.quests[index];
    }

    /**
     * Returns all quest statuses for a player.
     * @param player 
     * @returns 
     */
    private async getAllStatuses(player: Player): Promise<number[]> {
        return await this.dataService.get(player, "questStatuses");
    }

    /**
     * Returns the quest status for a specific quest for a player.
     * @param player 
     * @param index 
     * @returns 
     */
    private async getStatus(player: Player, index: number): Promise<number> {
        const status = await this.getAllStatuses(player);
        return status[index];
    }
    
    /**
     * Sets the quest status for a specific quest for a player.
     * @param player 
     * @param index 
     * @param newValue 
     */
    private async setStatus(player: Player, index : number, newValue : number) {
        const status = await this.dataService.get(player, "questStatuses");
        status[index] = newValue;
        this.dataService.set(player, "questStatuses", status);
        Events.questUpdated.fire(player, index, newValue)
    }

    /**
     * Called when a quest is completed.
     * @param player 
     * @param index 
     */
    private async claimQuest(player: Player, index : number) {
        if (await this.getStatus(player, index) !== 1) return false;

        this.dataService.increment(player, "coins", this.quests[index].reward.coins);
        this.dataService.increment(player, "stars", this.quests[index].reward.stars);

        return true
    }
}