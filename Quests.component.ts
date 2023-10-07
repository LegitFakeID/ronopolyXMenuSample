import { OnStart } from "@flamework/core";
import { Component, BaseComponent } from "@flamework/components";
import {Quest } from "shared/data";
import { Events, Functions } from "client/network";
import {ReplicatedStorage, StarterGui} from "@rbxts/services";
import { SingleButton } from "client/Button";
const COMPLETED_QUEST_COLOR = Color3.fromRGB(0, 48, 73);

interface Attributes {}
type QuestsUi = typeof StarterGui.Play.MainFrame.LowerRightFrame.rightUis.quests.Frame.Content

/**
 * Type of a quest element in the UI
 */
type questElement = typeof StarterGui.Play.MainFrame.LowerRightFrame.rightUis.quests.Frame.Content[1]

@Component({
    tag: "Quests",
})

/**
 * Handles the quests UI on right side of play screen
 */
export class QuestsComponent extends BaseComponent<Attributes, QuestsUi> implements OnStart {
    async onStart() {
        this.newQuests(await Functions.getQuests())
        this.updateStatuses(await Functions.getQuestStatuses())
        this.connectEvents();
    }

    /**
     * Connects events to the UI
     */
    private connectEvents() {
        Events.newQuests.connect((quests) => {
            this.newQuests(quests);
        })

        Events.questUpdated.connect((questIndex, status) => {
            this.updateQuest(questIndex, status);
        })
    }

    /**
     * Updates the quests UI with new quests
     * @param quests Array of quests to be displayed
     */
    private newQuests(quests: Array<Quest>) {
        // Remove previous quests (questElems)
        this.instance.GetChildren().forEach((child) => {
            if (child.IsA("Frame")) {
                child.Destroy();
            }
        })

        // Add new quests
        quests.forEach((quest, index) => {
            const questElem = ReplicatedStorage.uiComponents.questUI.Clone()
            questElem.Parent = this.instance
            questElem.Name = tostring(index)
            //const questElem = this.instance.FindFirstChild(index)! as questElement
            questElem.MainFrame.Content.questText.Text = quest.task
            questElem.MainFrame.Content.Rewards.coins.TextLabel.Text = "+" + tostring(quest.reward.coins)
            questElem.MainFrame.Content.Rewards.playPoint.TextLabel.Text = "+" + tostring(quest.reward.stars)
            questElem.MainFrame.Content.progressBar.progress.Size = new UDim2(0, 0, 1, 0)
        })
    }

    /**
     * Updates all quests with corresponding statuses
     * @param statuses Array of quest statuses values to be displayed
     */
    private updateStatuses(statuses: Array<number>) {
        statuses.forEach((status, index) => {
            this.updateQuest(index, status);
        })
    }

    /**
     * Updates a quest with a new status
     * @param questIndex Index of quest to be updated
     * @param status New status of quest
     */
    private updateQuest(questIndex: number, status: number) {
        //Change bar size
        const questElem = this.instance.FindFirstChild(questIndex) as questElement | undefined

        if (questElem === undefined) {
            warn("Quest element at index " + tostring(questIndex) + " not found")
            return;
        }
        questElem.MainFrame.Content.progressBar.progress.Size = new UDim2(status, 0, 1, 0)

        if (status === 1) {
            this.questCompleted(questIndex);
        }
    }

    /**
     * Updates a quest to be completed
     * @param questIndex Index of quest to be completed
     */
    private questCompleted(questIndex: number) {
        const questElem = this.instance.FindFirstChild(questIndex) as questElement | undefined

        if (questElem === undefined) {
            warn("Quest element at index " + tostring(questIndex) + " not found")
            return;
        }

        const buttonUI = questElem.MainFrame.Content.Claim.Claim.TextButton

        const state = {
            condition: () => Functions.claimQuest(questIndex),
            method: async (button : TextButton) => {
                questElem.MainFrame.Shadow.Visible = true;
                questElem.MainFrame.Content.Claim.Claim.claimText.Text = "Claimed";
                questElem.MainFrame.Content.Claim.Claim.claimText.TextColor3 = COMPLETED_QUEST_COLOR
            },
            kill : true
        }

        new SingleButton(buttonUI, state)
    }
}