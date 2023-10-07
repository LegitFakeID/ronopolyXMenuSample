import { OnStart, Service } from "@flamework/core";
import { IDataService } from "../../Classes/IDataService.interface";
import ProfileService from "@rbxts/profileservice";
import { DataName, DataTemplate, PlayerProfile, DefaultData } from "shared/data";
import EventEmitter from "@rbxts/task-event-emitter";
import { Profile } from "@rbxts/profileservice/globals";
import {Players} from "@rbxts/services"
import { Events, Functions } from "server/network";
import { Janitor } from "@rbxts/janitor";

/**
 * Handles data for a player.
 */
@Service({})
export class DataService implements OnStart, IDataService {
    /**
     * The datastore itself.
     */
	private readonly store = ProfileService.GetProfileStore("TestData", DefaultData);

    /**
     * Map of player to profile.
     */
	private readonly profiles = new Map<Player, PlayerProfile>();

    /**
     * Event that fires when a profile is added.
     */
	private readonly profileAdded = new EventEmitter<[player: Player, profile: Profile<DataTemplate>]>();

    onStart() {
        Players.PlayerAdded.Connect((player) => {
            // Load profile, loads default if it doesn't exist
            const profile = this.store.LoadProfileAsync(tostring(player.UserId), "ForceLoad");
            if (profile) {
                profile.AddUserId(player.UserId) //for gdpr compliance
                profile.Reconcile() //fill in missing values with default from template
                profile.ListenToRelease(() => {
					this.profiles.delete(player);
					player.Kick("Data loaded in another server");
				});
                if (player.IsDescendantOf(Players)) {
					this.profiles.set(player, profile); //add to map
                    this.profileAdded.emit(player, profile); //fire event
				} else {
					profile.Release(); //player left before profile loaded
				}
            } else {
				player.Kick("Couldn't load data, multiple sources");
			}
        })

        Players.PlayerRemoving.Connect((player) => {
			Promise.delay(0).then(() => {
				const profile = this.profiles.get(player); 
                if (profile) {
                    profile.Release(); 
                }
                this.profiles.delete(player);
		    })
        })

        this.connectFunctions()
    }

    private connectFunctions() {
        Functions.getCoins.setCallback((player) => {
            return this.get(player, "coins")
        })
    }

    /**
     * Returns players profile as a promise. Needed if player just joined and profile is not loaded yet.
     * @param player 
     * @returns the player's profile
     */
    waitForProfile(player: Player) {
		return new Promise<PlayerProfile>((resolve, reject, onCancel) => {
            //if profile already exists, return it
			const existingProfile = this.profiles.get(player);
			if (existingProfile) return resolve(existingProfile);

            //if player is not in game, reject
			if (!player.Parent) reject("Player is not in game");

			const waitForJanitor = new Janitor();

            //if player leaves, reject
			waitForJanitor.Add(
				Players.PlayerRemoving.Connect((leavingPlayer) => {
                    if (leavingPlayer === player) {
                        waitForJanitor.Destroy();
                        reject("Player left");
                    }
                }),
			);

            //if profile is added, resolve
			waitForJanitor.Add(
				this.profileAdded.subscribe((profilePlayer, profile) => {
					if (profilePlayer === player) {
						waitForJanitor.Destroy();
						resolve(profile);
					}
				}),
			);
            
            //if cancelled, destroy janitor
			onCancel(() => waitForJanitor.Destroy());
		});
	}

    /**
     * Used to get all the data of a player.
     * @param player 
     * @returns the player's data
     */
	private async getAll(player: Player) {
		const profile = await this.waitForProfile(player);
		return profile.Data;
	}

    /**
     * Get the data under {@link DataName} for a player. 
     * @param player 
     * @param dataName 
     * @returns the data under {@link DataName} for a player
     */
	async get<T extends DataName>(player: Player, dataName: T): Promise<DataTemplate[T]> {
		const data = await this.getAll(player)
		return data[dataName]
	}
    
    /**
     * Set the data under {@link DataName} for a player to {@link newValue}.
     * @param player 
     * @param dataName 
     * @param newValue 
     * @returns The new value of the data, if it was set successfully, otherwise the old value.
     */
	async set<T extends DataName>(player: Player, dataName: T, newValue: DataTemplate[T]) {
		const profile = await this.waitForProfile(player);
		profile.Data[dataName] = newValue;
		return profile.Data[dataName]; //changed used to be newValue, could be changed to a check if it was set successfully
	}

    /**
     * Increments a number under {@link DataName} for a player by {@link incrementAmount}.
     * @param player 
     * @param dataName 
     * @param incrementAmount 
     * @returns The new value of the data, if it was set successfully, otherwise the old value.
     */
    async increment<T extends ExtractKeys<DataTemplate, number>>(player: Player, dataName: T, incrementAmount: number): Promise<DataTemplate[T]> {
        const profile = await this.waitForProfile(player);
        profile.Data[dataName] += incrementAmount;

        if (dataName === "coins") {
            Events.coinsUpdated(player, profile.Data[dataName])
        }
        
        return profile.Data[dataName];
    }
}