/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cyril Soulliage. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import { window, StatusBarAlignment, StatusBarItem, OutputChannel } from "vscode";

class Timer {

    /**
     * Frequency of elapse event of the timer in millisecond
     */
    public interval = 1000;

    /**
     * The function to execute on tick.
     * @var function
     */
    // private tick;

    /**
     * A boolean flag indicating whether the timer is enabled.
     *
     * @var boolean
     */
    private enable: boolean = false;

    // Member variable: Hold interval id of the timer
    private handle : NodeJS.Timer;

    /**
     * Class constructor.
     *
     * @return self.
     */
    // constructor(tick: Function) {
    //     this.tick = tick;
    // }

    /**
     * Start the timer.
     */
    public start(): void {
           this.enable = true;
        if (this.enable) {
            this.handle = setInterval(() => {
                // this.tick();
            }, this.interval);
        }
    };

    /**
     * Stop the timer.
     */
     public stop(): void {
        this.enable = false;
        if (this.handle) {
            clearInterval(this.handle);
        }
    };

    /**
     * Dispose the timer.
     */
    public dispose(): void {
        if (this.handle) {
            clearInterval(this.handle);
        }
    }
};

export class TwigcsStatus {

    private statusBarItem: StatusBarItem;
    private documents: string[] = [];
    private processing: number = 0;
    private spinnerIndex = 0;
    private spinnerSquense: string[] = [ "|", "/", "-", "\\" ];
    private timer: Timer;
    private outputChannel: OutputChannel;

    public startProcessing(uri: string) {
        this.documents.push(uri);
        this.processing += 1;
        this.getTimer().start();
        this.getOutputChannel().appendLine( `linting started on: ${uri}` );
        this.getStatusBarItem().show();
    }

    public endProcessing(uri: string) {
        this.processing -= 1;
        let index = this.documents.indexOf(uri);
        if (index !== undefined) {
            this.documents.slice(index, 1);
            this.getOutputChannel().appendLine( `linting completed on: ${uri}` );
        }
        if (this.processing === 0) {
            this.getTimer().stop();
            this.getStatusBarItem().hide();
            this.updateStatusText();
        }
    }

    private updateStatusText() : void{
        let sbar = this.getStatusBarItem();
        let count = this.processing;
        if (count > 0) {
            let spinner = this.getNextSpinnerChar();
            sbar.text = count === 1 ? `$(eye) twigcs is linting 1 document ... ${spinner}` : `$(eye) twigcs is linting ${count} documents ... ${spinner}`;
        } else {
            sbar.text = "";
        }
    }

    private getNextSpinnerChar(): string {
        let spinnerChar = this.spinnerSquense[this.spinnerIndex];
        this.spinnerIndex +=  1;
        if (this.spinnerIndex > this.spinnerSquense.length - 1) {
            this.spinnerIndex = 0;
        }
        return spinnerChar;
    }

    private getTimer(): Timer {
        if (!this.timer) {
            // this.timer = new Timer(()=>{
            //     this.updateStatusText();
            // });
            this.timer.interval = 100;
        }
        return this.timer;
    }

    private getStatusBarItem(): StatusBarItem {
        // Create as needed
        if (!this.statusBarItem) {
            this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        }
        return this.statusBarItem;
    }
    private getOutputChannel(): OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = window.createOutputChannel("twigcs");
        }
        return this.outputChannel;
    }

    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
        if (this.timer) {
            this.timer.dispose();
        }
    }
}
