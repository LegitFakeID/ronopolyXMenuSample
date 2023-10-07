import { OnStart } from "@flamework/core";
import { Component, BaseComponent } from "@flamework/components";
import { StarterGui } from '@rbxts/services';
import { ButtonState } from "shared/data";
import { SingleButton } from "client/Button";

interface Attributes {}
type MatchUi = typeof StarterGui.Match.MainFrame.MiddleFrame

@Component({
    tag: "Match",
})
export class MatchComponent extends BaseComponent<Attributes, MatchUi> implements OnStart {
    private createButton;
    private joinButton;

    constructor() {
        super();
        this.createButton = this.instance.CustomMatch.PlayButtonsMenu.playButtonMenu.playButtonMenu.Contents.Create.TextButton;
        this.joinButton = this.instance.CustomMatch.PlayButtonsMenu.playButtonMenu.playButtonMenu.Contents.Join.TextButton;
    }

    onStart() {
        const createStates : ButtonState<TextButton>= 
            {
                method: async (button : TextButton) => {
                    this.instance.CustomMatch.Visible = false;
                    this.instance.CreateMatch.Visible = true;
                }
            }
        
        new SingleButton(this.createButton, createStates)

        const joinStates : ButtonState<TextButton>= 
            {
                method: async (button : TextButton) => {
                    this.instance.CustomMatch.Visible = false;
                    this.instance.JoinMatch.Visible = true;
                }
            }
        
        new SingleButton(this.joinButton, createStates)
    }
}