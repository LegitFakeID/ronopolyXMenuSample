import { Service, OnStart, OnInit, Dependency } from "@flamework/core";
import { Functions } from "server/network";
import {GameSettings} from "shared/config/gameSettings";
import {IMatch} from "server/Classes/PlayerGroup/Match/IMatch.interface";
import { Match } from "../Classes/PlayerGroup/Match/Match.class";
import {PlayerGroupService} from "./PlayerGroupService.class";
import { PartyService } from "./Party.Service";
//does remote work
/**
 * MatchService is a class that handles the creation, joining, leaving and **starting** of matches.
 * @extends PlayerGroupService
 */
@Service({})
export class MatchService extends PlayerGroupService<IMatch> implements OnStart{
    constructor(private readonly partyService : PartyService) {
        super()
    }

    onStart() {
        this.connectFunctions()
        this.connectLeave()
    }

    protected connectFunctions() {
        Functions.joinMatch.setCallback((player, leader, password) => {
            return this.requestJoin(player.UserId, leader, password)
        })

        Functions.leaveMatch.setCallback((player) => {
            return this.leave(player.UserId)
        })

        Functions.createMatch.setCallback((player) => {
            return this.create(player.UserId)
        })

        Functions.startMatch.setCallback((player) => {
            return this.startMatch(player.UserId)
        })

        Functions.kickPlayerMatch.setCallback((player, kicked) => {
            return this.kickPlayer(player.UserId, kicked)
        })

        Functions.setSettingsMatch.setCallback((player, settings) => {
            return this.setSettings(player.UserId, settings)
        })

        Functions.setPrivacyMatch.setCallback((player, privacy, password) => {
            return this.setPrivacy(player.UserId, privacy, password)
        })

        Functions.setPasswordMatch.setCallback((player, password) => {
            return this.setPassword(player.UserId, password)
        })

        Functions.invitePlayerMatch.setCallback((player, invited) => {
            return this.invitePlayer(player.UserId, invited)
        })

        return true
    }

    protected override createObj(leader : number) {
        const match = new Match(leader)

        for (const member of this.partyService.getPlayers(leader)) {
            this.addPlayer(member, leader)
        }

        return match
    }
    
    /**
     * Checks if joiner is party leader and calls {@link addPlayer} on all party members
     * @param joiner 
     * @param leader 
     * @returns true if all party members joined the player group, false otherwise
     */
    join(joiner : number, leader : number) : boolean {
        if (!this.partyService.isLeader(joiner)) return false
        
        let flag = true
        
        for (const member of this.partyService.getPlayers(joiner)) {
            flag = flag && this.addPlayer(member, leader)
        }

        return flag
    }

    /**
     * sets the settings of the match
     * @param leader 
     * @param settings the new {@link GameSettings} of the match
     * @returns true if the settings were successfully set, false otherwise
     */
    private setSettings(leader : number, settings : GameSettings) : boolean {
        const match = this.getObj(leader)
        if (match && match.getLeader() === leader) {
            match.setSettings(settings)
            return true
        }

        return false
    }

    /**
     * starts the match
     * @param leader 
     * @returns true if the match was successfully created, false otherwise
     */
    startMatch(leader : number) {
        const match = this.getObj(leader)
        if (match && match.getLeader() === leader) {
            match.startMatch()
            for (const player of match.getPlayers()) {
                this.leave(player)
                //leave party
                this.partyService.leave(player)
            }
            return true
        }

        return false
    }
}