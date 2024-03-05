import { App, debounce, PluginSettingTab, Setting } from "obsidian";
import InlinePomodoroPlugin from "@/InlinePomodoroIndex";

export interface InlinePomodoroSettings {
    pomodoroMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;

    pushNotification: boolean;
    secretKey: string;
}


export const DEFAULT_POMODORO_SETTINGS: InlinePomodoroSettings = {
    pomodoroMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,

    pushNotification: false,
    secretKey: '',
};

export class InlinePomodoroSettingTab extends PluginSettingTab {
    plugin: InlinePomodoroPlugin;

    constructor(app: App, plugin: InlinePomodoroPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    updateSettings(key: any, value: any) {
        this.plugin.settings = {
            ...this.plugin.settings,
            [key]: value,
        };
        this.applySettingsUpdate();
    }

    debounceApplySettingsUpdate = debounce(
        async () => {
            await this.plugin.saveSettings();
        },
        100,
        true,
    );

    debounceDisplay = debounce(
        async () => {
            await this.display();
        },
        200,
        true,
    );

    applySettingsUpdate() {
        this.debounceApplySettingsUpdate();
    }

    async display() {
        await this.plugin.loadSettings();

        const {containerEl} = this;
        const settings = this.plugin.settings;

        containerEl.empty();

        const setting = new Setting(containerEl)
            .setName('Pomodoro duration')
            .setDesc('The duration of a single pomodoro');

        settings.pomodoroMinutes !== 25 && setting.addExtraButton((button) => {
            button
                .setTooltip('Reset to default')
                .setIcon('reset')
                .onClick(async () => {
                    this.updateSettings('pomodoroMinutes', DEFAULT_POMODORO_SETTINGS.pomodoroMinutes);
                    this.debounceDisplay();
                });
        });

        setting.addSlider((slider) => {
            slider
                .setLimits(1, 60, 1)
                .setDynamicTooltip()
                .setValue(settings.pomodoroMinutes)
                .onChange(async (value) => {
                    this.updateSettings('pomodoroMinutes', value);
                    this.debounceDisplay();
                });
        });


        this.showNotification(containerEl, settings);
    }

    showNotification(containerEl: HTMLElement, settings: InlinePomodoroSettings) {
        new Setting(containerEl).setName('Push notification').setDesc('Enable push notification for pomodoro').addToggle((toggle) => {
            toggle.setValue(settings.pushNotification).onChange(async (value) => {
                this.updateSettings('pushNotification', value);
                this.debounceDisplay();
            });
        });

        if (settings.pushNotification) {
            new Setting(containerEl).setName('ServerChan Secret key').setDesc('Secret key for push notification, based on ServerChan').addText((text) => {
                text.inputEl.type = 'password';
                text.setValue(settings.secretKey).onChange(async (value) => {
                    this.updateSettings('secretKey', value);
                    this.debounceDisplay();
                });
            });
        }
    }
}
