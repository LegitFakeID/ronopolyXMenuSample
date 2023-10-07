import { Janitor } from "@rbxts/janitor";
import { ButtonState } from "shared/data";

interface IButton {
    destroy(): void;
    force() : boolean;
}

abstract class Button<T extends GuiButton> implements IButton {
    private debounce = false;
    private janitor = new Janitor();
    protected abstract state: ButtonState<T> | ButtonState<T>[];
    
    constructor(protected button: T) {
        this.janitor.Add(this.button.MouseButton1Click.Connect(() => this.handleClick()), "Disconnect")
        this.janitor.LinkToInstance(this.button, false);
    }

    private async handleClick() {
        if (this.debounce) {
            return;
        }
        this.debounce = true;
        await this.swapState();
        this.debounce = false;
    }

    protected abstract swapState(force? : boolean): Promise<void>;

    abstract force(name?: string): boolean;

    destroy() {
        this.janitor.Destroy();
    }
}

export class SingleButton<T extends GuiButton> extends Button<T> {
    constructor(button: T, protected state: ButtonState<T>) {
        super(button);
    }

    protected async swapState(force?: boolean) {
        if (force || (this.state.condition ? await this.state.condition() : true)) {
            await this.state.method(this.button);
            if (this.state.kill) {
                this.destroy();
            }
        }
    }

    force(name? : string) {
        this.swapState(true);
        return true;
    }
}

export class MultiButton<T extends GuiButton> extends Button<T> {
    private stateIndex = 0;

    constructor(button: T, protected state: ButtonState<T>[]) {
        super(button);
    }

    protected async swapState(force?: boolean) {
        const state = this.state[this.stateIndex];
        if (force || (state.condition ? await state.condition() : true)) {
            await state.method(this.button);
            this.stateIndex = (this.stateIndex + 1) % this.state.size();
            
            if (this.state[this.stateIndex].kill) {
                this.destroy();
            }
        }
    }

    force(name: string) {
        const index = this.state.findIndex(state => state.name === name);
        if (index === -1) {
            warn(`State ${name} not found`);
            return false;
        }

        this.stateIndex = index;
        this.swapState(true);
        return true;
    }
}
