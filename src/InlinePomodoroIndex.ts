import { Editor, Menu, moment, Plugin } from "obsidian";
import { createInlinePomodoroPlugin } from "@/ui/InlinePomodoro";
import { getDuration } from "@/ui/TimeCircleProgressbar";
import { EditorView } from "@codemirror/view";
import { DEFAULT_POMODORO_SETTINGS, InlinePomodoroSettings, InlinePomodoroSettingTab } from "@/InlinePomodoroSettings";

declare module "obsidian" {
    interface Editor {
        cm: EditorView;
    }
}

const updatePomodoroTime = (editor: any, currentLine: number, index: number, newTimeString: string, markTextLength: number) => {
    editor.replaceRange(newTimeString, {line: currentLine, ch: index}, {line: currentLine, ch: index + markTextLength});
    const currentCursor = editor.getCursor();
    editor.setCursor({line: currentLine, ch: index + newTimeString.length - 1});
    editor.setCursor(currentCursor);
};

const createMenuItem = (menu: Menu, title: string, icon: string, onClick: () => void) => {
    menu.addItem((item: any) => {
        item.setSection('selection-link');
        item.setTitle(title);
        item.setIcon(icon);
        item.onClick(onClick);
    });
};

const handleEditorMenu = (menu: Menu, editor: Editor, plugin: InlinePomodoroPlugin) => {
    const currentLine = editor.getCursor().line;
    const currentLineText = editor.getLine(currentLine);
    const markText = currentLineText.match(/%%\s*?time(\d*)?:(\d{10})(\+(\d{1,4}))?\s*?%%/g);
    if (markText === null) {
        createMenuItem(menu, 'Add pomodoro timer', 'alarm-clock', () => {
            const view = (editor.cm as EditorView);
            let realPos: number;
            const currentLineBlockRef = /\^[A-Za-z0-9-]+$/g.exec(currentLineText);
            if (currentLineBlockRef) {
                const blockRef = currentLineBlockRef[0];
                const index = currentLineText.indexOf(blockRef);
                realPos = editor.posToOffset({line: currentLine, ch: index});
            } else {
                realPos = editor.posToOffset({line: currentLine, ch: currentLineText.length});
            }

            view.dispatch({
                changes: {
                    from: realPos,
                    to: realPos,
                    insert: ` %% time1:${moment().add(getDuration(plugin), 'seconds').format('X')}+0 %% `
                },
                selection: {
                    anchor: realPos + ` %% time1:${moment().add(getDuration(plugin), 'seconds').format('X')}+0 %% `.length,
                    head: realPos + ` %% time1:${moment().add(getDuration(plugin), 'seconds').format('X')}+0 %% `.length
                }
            });
        });
        return;
    }

    const index = currentLineText.indexOf(markText[0]);
    // const isPaused = /\+\d{1,4}/g.test(markText[0]);
    const repeat = /time(\d*)?:/g.exec(markText[0])[1];
    const time = /\d{10}/g.exec(markText[0])[0];
    const duration = /\+(\d{1,4})/g.exec(markText[0])[1];
    if (parseInt(duration) > 0) {
        createMenuItem(menu, 'Resume pomodoro', 'play', () => {
            const newTimeString = `%% time${repeat || '1'}:${moment().add(getDuration(plugin) > parseInt(duration) ? getDuration(plugin) - parseInt(duration) : getDuration(plugin), 'seconds').format('X')}+0 %%`;
            updatePomodoroTime(editor, currentLine, index, newTimeString, markText[0].length);
        });
        return;
    }

    if (parseInt(time) < parseInt(moment().format('X'))) {
        createMenuItem(menu, 'Restart pomodoro', 'rotate-ccw', () => {
            const newTimeString = `%% time${parseInt(repeat) + 1 || '2'}:${moment().add(getDuration(plugin), 'seconds').format('X')}+0 %%`;
            updatePomodoroTime(editor, currentLine, index, newTimeString, markText[0].length);
        });
        return;
    }

    createMenuItem(menu, 'Pause pomodoro', 'pause', () => {
        const newTimeString = `%% time${repeat || '1'}:${time}+${getDuration(plugin) - parseInt(time) + parseInt(moment().format('X'))} %%`;
        updatePomodoroTime(editor, currentLine, index, newTimeString, markText[0].length);
    });
};

export default class InlinePomodoroPlugin extends Plugin {
    settings: InlinePomodoroSettings;
    settingTab: InlinePomodoroSettingTab;

    async onload(): Promise<void> {
        this.settingTab = new InlinePomodoroSettingTab(this.app, this);
        await this.loadSettings();
        this.addSettingTab(this.settingTab);

        this.registerEditorExtension([createInlinePomodoroPlugin(this)]);
        this.app.workspace.on('editor-menu', (menu, editor) => {
            handleEditorMenu(menu, editor, this);
        });
    }

    public async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_POMODORO_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
