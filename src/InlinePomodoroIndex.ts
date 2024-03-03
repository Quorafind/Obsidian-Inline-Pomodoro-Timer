import { moment, Plugin } from "obsidian";
import { createInlinePomodoroPlugin } from "@/ui/InlinePomodoro";
import { POMODORO_DURATION } from "@/ui/TimeCircleProgressbar";
import { EditorView } from "@codemirror/view";

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

export default class InlinePomodoroPlugin extends Plugin {

    async onload(): Promise<void> {
        this.registerEditorExtension([createInlinePomodoroPlugin(this)]);

        this.app.workspace.on('editor-menu', (menu, editor) => {
            const currentLine = editor.getCursor().line;
            const currentLineText = editor.getLine(currentLine);
            const markText = currentLineText.match(/%%\s*?time(\d*)?:(\d{10})(\+(\d{1,4}))?\s*?%%/g);
            if (markText === null) {
                menu.addItem((item) => {
                    item.setSection('selection-link');
                    item.setTitle('Add pomodoro timer');
                    item.setIcon('alarm-clock');
                    item.onClick(() => {
                        const view = (editor.cm as EditorView);
                        let realPos = 0;
                        const currentLineBlockRef = /\^[A-Za-z0-9-]{1,}$/g.exec(currentLineText);
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
                                insert: ` %% time1:${moment().add(1500, 'seconds').format('X')}+0 %% `
                            },
                            selection: {
                                anchor: realPos + ` %% time1:${moment().add(1500, 'seconds').format('X')}+0 %% `.length,
                                head: realPos + ` %% time1:${moment().add(1500, 'seconds').format('X')}+0 %% `.length
                            }
                        });
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
                menu.addItem((item) => {
                    item.setSection('selection-link');
                    item.setTitle('Resume pomodoro');
                    item.setIcon('play');
                    item.onClick(() => {
                        const newTimeString = `%% time${repeat || '1'}:${moment().add(POMODORO_DURATION > parseInt(duration) ? POMODORO_DURATION - parseInt(duration) : POMODORO_DURATION, 'seconds').format('X')}+0 %%`;
                        // editor.replaceRange(newTimeString, {line: currentLine, ch: index}, {
                        //     line: currentLine,
                        //     ch: index + markText[0].length
                        // });
                        // const currentCursor = editor.getCursor();
                        // editor.setCursor({line: currentLine, ch: index + newTimeString.length - 1});
                        // editor.setCursor(currentCursor);
                        updatePomodoroTime(editor, currentLine, index, newTimeString, markText[0].length);
                    });
                });
                return;
            }

            if (parseInt(time) < parseInt(moment().format('X'))) {
                menu.addItem((item) => {
                    item.setSection('selection-link');
                    item.setTitle('Restart pomodoro');
                    item.setIcon('rotate-ccw');
                    item.onClick(() => {
                        const newTimeString = `%% time${parseInt(repeat) + 1 || '2'}:${moment().add(1500, 'seconds').format('X')}+0 %%`;
                        // editor.replaceRange(newTimeString, {line: currentLine, ch: index}, {
                        //     line: currentLine,
                        //     ch: index + markText[0].length
                        // });
                        // const currentCursor = editor.getCursor();
                        // editor.setCursor({line: currentLine, ch: index + newTimeString.length - 1});
                        // editor.setCursor(currentCursor);
                        updatePomodoroTime(editor, currentLine, index, newTimeString, markText[0].length);
                    });
                });
                return;
            }


            menu.addItem((item) => {
                item.setSection('selection-link');
                item.setTitle('Pause pomodoro');
                item.setIcon('pause');
                item.onClick(() => {
                    const newTimeString = `%% time${repeat || '1'}:${time}+${POMODORO_DURATION - parseInt(time) + parseInt(moment().format('X'))} %%`;
                    // editor.replaceRange(newTimeString, {line: currentLine, ch: index}, {
                    //     line: currentLine,
                    //     ch: index + markText[0].length
                    // });
                    // const currentCursor = editor.getCursor();
                    // editor.setCursor({line: currentLine, ch: index + newTimeString.length - 1});
                    // editor.setCursor(currentCursor);
                    updatePomodoroTime(editor, currentLine, index, newTimeString, markText[0].length);
                });
            });


        });
    }
}
