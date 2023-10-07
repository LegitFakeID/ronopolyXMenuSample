import { Service, OnStart, OnInit, Dependency } from "@flamework/core";
import { PartyService } from './Party.Service';
import { MatchService } from './Match.Service';
import { QueueSizes } from "shared/data";
import { Functions } from "server/network";
import { QuestService } from './Data/Quest.Service';
const MemoryStoreService = game.GetService("MemoryStoreService");

@Service({})
/**
 * This service is responsible for creating matches from the queue. Currently check queue is called when a player joins the queue.
 */
export class QuickMatchService implements OnStart{
    private readonly MATCH_TIMEOUT = 600 //seconds

    /**
     * MatchQueue for 4 players games. Stores timestamp to player id.
     */
    private Queue4Player : MemoryStoreSortedMap = MemoryStoreService.GetSortedMap("MatchQueue4");

    /**
     * MatchQueue for 2 players games. Stores timestamp to player id.
     */
    private Queue2Player : MemoryStoreSortedMap = MemoryStoreService.GetSortedMap("MatchQueue4");

    private queues: Record<QueueSizes, MemoryStoreSortedMap> = {
        2: this.Queue2Player,
        4: this.Queue4Player
      };

    /**
     * Stores player id to queueSize at index 0 and timestamp at index 1. Used to remove players from queue.
     */
    private playerToQueueInfo  = new Map<number, [QueueSizes, string]>();

    /**
     * Number of parties to check for a match.
     */
    private readonly QUEUE_BUFFER = 10

    /**
     * Flag to prevent multiple calls to check the queue for a match.
     */
    private flag = false

    constructor(private readonly PartyService : PartyService, private readonly MatchService : MatchService) {}

    onStart() {
        this.connectFunctions()
    }
    //todo: currently defaulting to 2 player queue how to choose? does player choose? or does it depend on party size?
    private connectFunctions() {
        Functions.enqueueQuickMatch.setCallback((player) => {
            return this.joinQueue(player.UserId, 2)
        })

        Functions.dequeueQuickMatch.setCallback((player) => {
            return this.leaveQueue(player.UserId)
        })
    }

    /**
     * Adds a party to the queue, and checks if match can be created.
     * @param leader 
     * @returns 
     */
    private joinQueue(leader : number, size : QueueSizes) : boolean {
        if (!this.PartyService.isLeader(leader)) return false
        if (this.playerToQueueInfo.has(leader)) return false

        //generate timestamp, using player id to prevent duplicates
        const timestamp = tostring(os.time()) + tostring(leader)

        //store timestamp to leader id for sorting
        const [success, message] = pcall(() => {return this.queues[size].SetAsync(timestamp, leader, this.MATCH_TIMEOUT)})
        
        if (!success) {
            warn(message)
            return false
        }

        //store leader id to timestamp for removal
        this.playerToQueueInfo.set(leader, [size, timestamp])

        //check queue, if there is a match, it will be created
        this.checkQueue(size)

        return true
    }

    /**
     * Removes a party from the queue.
     * @param player 
     * @returns 
     */
    private leaveQueue(player : number) : boolean {
        if (!this.playerToQueueInfo.has(player)) return false

        const queueInfo = this.playerToQueueInfo.get(player)
        const [success, message] = pcall(() => {return this.queues[queueInfo![0]].RemoveAsync(queueInfo![1])})

        if (!success) {
            warn(message)
            return false
        }

        this.playerToQueueInfo.delete(player)
        return true
    }

    /**
     * Checks if a match can be created from the queue.
     * @returns 
     */
    private checkQueue(size : QueueSizes) {
        if (this.flag) return
        this.flag = true
        this.checkQueueFlagged(size)
        wait(1)
        this.flag = false
    }

    /**
     * Flagged version of {@link checkQueue}, to prevent multiple calls to check the queue for a match.
     * @returns 
     */
    private checkQueueFlagged(size : QueueSizes) {
        //Get QUEUE_BUFFER parties from queue
        const [success, parties] = pcall(() => {
            return this.queues[size].GetRangeAsync(Enum.SortDirection.Ascending, this.QUEUE_BUFFER) as [string, number][]
        })

        if (!success) return

        const matchPlayers = this.findParties(parties as unknown as [string, number][], size)

        if (!matchPlayers) return

        //create match
        const matchLeader = matchPlayers[0]
        this.MatchService.create(matchLeader)
        
        //remove players from queue
        for (const partyLeader of matchPlayers) {
            if (!this.leaveQueue(partyLeader)) continue //what happens if some leader doesnt join? currently just ignores them
            this.MatchService.join(partyLeader, matchLeader)
        }

        //start match
        this.MatchService.startMatch(matchLeader)

        return 
    }

    /**
     * Used to find subset sum for the parties.
     * @param parties 
     * @param targetSize 
     * @returns 
     */
    private findParties(parties : [string, number][], targetSize : QueueSizes) {
        // Create an array to store the solutions to subproblems
        const canAchieveSize = new Array<boolean>(targetSize + 1, false)
        const partyForSize = new Array<[number, number]>(targetSize + 1, [0, 0]);
      
        // There is always a solution for size 0 (just pick no parties)
        canAchieveSize[0] = true;
      
        // Loop over each party
        for (let i = 0; i < parties.size(); i++) {
            const party = parties[i];
            const leader = party[1]
            const players = this.PartyService.getPlayers(leader)
            const partySize = players.size();
      
            // Check each possible size from the target size down to the party size
            for (let size = targetSize; size >= partySize; size--) {
                // If we can make the current size by adding this party to a smaller size
                if (canAchieveSize[size - partySize]) {
                    // Then we can make the current size
                    canAchieveSize[size] = true;
                    // Remember which party we added
                    partyForSize[size] = [leader, partySize];
                }
            }
        }
      
        // If there's no solution, return null
        if (!canAchieveSize[targetSize]) return;
      
        // Backtrack to find the chosen parties
        const matchPlayers : number[] = [];

        let size = targetSize;
        while (size > 0) {
            // Add the chosen party to the solution
            matchPlayers.push(partyForSize[size][0]);
            // Subtract the party size from the current size
            size -= partyForSize[size][1];
        }
      
        return matchPlayers;
    }
}