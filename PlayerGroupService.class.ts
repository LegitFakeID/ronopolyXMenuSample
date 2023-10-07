import { Functions } from "server/network";
import { Privacy } from "shared/config/gameSettings";
import { IPlayerGroup } from "server/Classes/PlayerGroup/IPlayerGroup.interface";
import { Players} from "@rbxts/services";
import * as ProfileService from "@rbxts/profileservice"

//We are storing the party/match of every player under them
//So when they start match we must delete match for all players!
//When adding party to match we must set party for all players!
/**
 * GeneralService is a class that handles the creation, joining, and leaving of player groups.
 * @abstract
 */
export abstract class PlayerGroupService<T extends IPlayerGroup> {
    /**
     * Map of player id to player group
     */
    private _playerMap = new Map<number, T>();

    protected abstract connectFunctions() : void

    protected connectLeave(): void {
        Players.PlayerRemoving.Connect((player) => {
            this.leave(player.UserId)
        })
    }

    /**
     * Creates a player group for the player, as the leader, if they are not already in a player group
     * @param leader 
     * @returns true if the player group was created, false otherwise
     */
    create(leader : number) : boolean {
        if (this._playerMap.has(leader)) {
            return false
        }

        const obj = this.createObj(leader);

        this._playerMap.set(leader, obj);

        return true
    };

    /**
     * Creates an object of the player group
     * @param leader The leader of the player group
     */
    protected abstract createObj(leader : number) : T;
 
    /**
     * Returns the player group of the player
     * @param key The player id of the player
     * @returns The player group of the player
     */
    protected getObj(key: number) {
        return this._playerMap.get(key)
    }

    /**
     * Returns the players in a player group
     * @param player a player of the player group
     * @returns The players in the player group
     */
    getPlayers(player : number) : Set<number> {
        if (!this._playerMap.has(player)) {
            return new Set<number>()
        }

        return this._playerMap.get(player)!.getPlayers()
    }

    /**
     * Checks if a player is the leader of a player group
     * @param player 
     * @returns true if the player is the leader of a player group, false otherwise
     */
    isLeader(player : number) : boolean {
        if (!this._playerMap.has(player)) {
            return false
        }

        return this._playerMap.get(player)!.getLeader() === player
    }

    /**
     * Checks privacy of player group and calls {@link join} to add player to player group
     * @example 
       //returns true (privacy is public)
       requestJoin(1, 1)
       //returns false (privacy is private)
       requestJoin(1, 2)
     * @param joiner 
     * @param leader 
     * @param password optional password for the player group
     * @returns true if the player joined the player group, false otherwise
     */
    protected requestJoin(joiner : number, leader : number, password? : string) : boolean {
        if (!this.isLeader(leader)) {
            return false
        }

        const obj = this._playerMap.get(leader)!;

        if (obj.getInvited().has(joiner)) {
            return this.join(joiner, leader)
        }

        switch (obj.getPrivacy()) {
            case Privacy.Private:
                //no join
                return false
            case Privacy.FriendsOnly:
                //check friendship
                if (!obj.isFriendOfLeader(joiner)) {
                    return false
                }
                return this.join(joiner, leader)
            case Privacy.Password:
                //check password
                if (password !== obj.getPassword()) {
                    return false
                }
                return this.join(joiner, leader)
            case Privacy.Public:
                //join
                return this.join(joiner, leader)
        }
    }

    /**
     * Checks player group specific requirements and calls {@link addPlayer} to add player to player group
     * @param joiner
     * @param leader
     * @returns true if the player joined the player group, false otherwise
     */
    protected abstract join(joiner: number, leader: number) : boolean

    /**
     * Adds a player to a player group
     * @param joiner 
     * @param leader
     * @returns true if the player joined the player group, false otherwise
     */
    protected addPlayer(joiner : number, leader : number) : boolean {
        if (!this.isLeader(leader)) { //check joining obj (failsafe)
            return false
        }

        //leave current obj
        this.leave(joiner)

        const joiningObj = this._playerMap.get(leader)!; //obj you are joining

        joiningObj.addPlayer(joiner); //join obj
        this._playerMap.set(joiner, joiningObj); //set new obj

        return true
    };


    /**
     * leaves a player group
     * @param player
     * @returns true if the player left the player group, false otherwise
     */
    leave(player : number) : boolean {
        if (!this._playerMap.has(player)) {
            return false
        }

        const obj = this._playerMap.get(player)!;
       
        return obj.removePlayer(player) && this._playerMap.delete(player);
    };    
        
    /**
     * kicks a player from a player group
     * @param caller the player kicking the player
     * @param player the player being kicked
     * @returns true if the player was kicked, false otherwise
     */
    protected kickPlayer(caller : number, player : number) : boolean {
        const obj = this._playerMap.get(player);

        if (obj && obj.getLeader() === caller) {
            obj.removePlayer(player)
            this._playerMap.delete(player)
            return true
        }

        return false
    }

    /**
     * sets the privacy of a player group
     * @param leader 
     * @param privacy the new privacy of the player group
     * @param password the new password of the player group (optional)
     * @returns true if the privacy was set, false otherwise
     */
    protected setPrivacy(leader : number, privacy : Privacy, password? : string) {
        const obj = this.getObj(leader)

        if (obj && obj.getLeader() === leader) {
            if (privacy !== Privacy.Password) {
                obj.setPrivacy(privacy)             
            } else {
                if (password === undefined) {
                    return false
                }
                obj.setPrivacy(privacy)
                obj.setPassword(password)
            }
            return true
        }
        return false
    }

    /**
     * invites a player to a player group, any party member can invite
     * @param leader
     * @param player the player being invited
     * @returns true if the player was invited, false otherwise
     */
    protected invitePlayer(caller : number, player : number) {
        const obj = this.getObj(caller)
        if (obj) {
            obj.invitePlayer(player)
            return true
        }
        return false
    }

    /**
     * sets the password of a player group
     * @param leader
     * @param password the new password of the player group
     * @returns true if the password was set, false otherwise
     */
    protected setPassword(leader : number, password : string) {
        const obj = this.getObj(leader)
        if (obj && obj.getLeader() === leader) {
            obj.setPassword(password)
            return true
        }
        return false
    }
}