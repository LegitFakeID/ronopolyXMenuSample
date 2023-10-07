import { Dependency, OnStart } from "@flamework/core";
import { Component, BaseComponent, Components } from "@flamework/components";
import { StarterGui, ReplicatedStorage } from '@rbxts/services';
import { ButtonState, Crate, ShopItem } from '../../shared/data';
import { Functions } from "client/network";
import { CrateButton } from "client/ItemButton";
import { SingleButton } from "client/Button";

interface Attributes {}
type CratesShopUi = typeof StarterGui.Shop.MainFrame.MiddleFrame.Shop.Crates
type crateUi = typeof ReplicatedStorage.uiComponents.crateUI

const enum CrateType {
    Unassigned,
    Daily,
    Weekly,
    Event
}

@Component({
    tag: "CratesShop",
})
export class CratesShopComponent extends BaseComponent<Attributes, CratesShopUi> implements OnStart {
    //connect daily, weekly, event buttons to crate info
    //on crate info, get component from crate frame and use method in crate
    private crateButtons : CrateButton[];
    private crateType : CrateType = CrateType.Unassigned;

    constructor() {
        super();
        this.crateButtons = this.instance.GetChildren().filter((child) => child.IsA("Frame") && child.Name !== "Frame").map((child) => {
            const childUi = child as crateUi;
            return new CrateButton(childUi, childUi.Frame.TextLabel, undefined, childUi.Price.TextLabel);
        })

        const dailyStates : ButtonState<TextButton> = 
            {
                method : async (button : TextButton) => {
                    this.setCrates(CrateType.Daily, await Functions.getDailyCrates())
                }
            }
        new SingleButton(this.instance.Frame.Daily.Frame.TextButton, dailyStates)

        const weeklyStates : ButtonState<TextButton> = 
            {
                method : async (button : TextButton) => {
                    this.setCrates(CrateType.Weekly, await Functions.getWeeklyCrates())
                }
            }
        new SingleButton(this.instance.Frame.Weekly.Frame.TextButton, weeklyStates)

        const eventStates : ButtonState<TextButton> = 
            {
                method : async (button : TextButton) => {
                    this.setCrates(CrateType.Event, await Functions.getEventCrates())
                }
            }
        new SingleButton(this.instance.Frame.Event.Frame.TextButton, eventStates)
    }

    async onStart() {       
        this.setCrates(CrateType.Daily, await Functions.getDailyCrates())
    }

    async setCrates(crateType : CrateType, crateInfos : Crate[]) { 
        if (this.crateType === crateType) return     

        for (let i = 0; i < crateInfos.size(); i++) {
            this.crateButtons[i].set(crateInfos[i])
        }
        this.crateType = crateType
    }
}
