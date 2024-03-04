import {
    Decoration,
    DecorationSet,
    EditorView,
    MatchDecorator,
    PluginSpec,
    PluginValue,
    ViewPlugin,
    ViewUpdate,
    WidgetType
} from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import InlinePomodoroPlugin from "../InlinePomodoroIndex";
import ReactDOM from 'react-dom/client';
import React, { StrictMode } from "react";
import TimeCircleProgressbar from "@/ui/TimeCircleProgressbar";
import { Transaction } from "@codemirror/state";

interface DecoSpec {
    widget?: InlineTimerWidget;
}

class InlineTimerWidget extends WidgetType {
    public error = false;

    private currentText: string;
    private currentEnd: string;
    private repeatTime: number;
    private currentElapsed: string;
    private root: ReactDOM.Root;

    private span: HTMLSpanElement;

    private currentFrom: number;
    private currentTo: number;

    constructor(
        public readonly view: EditorView,
        public readonly plugin: InlinePomodoroPlugin,
        public readonly timeRange: {
            text: string,
            end: string,
            elapsed: string,
            repeat: string,
        },
        public readonly textRange: {
            from: number,
            to: number,
        },
    ) {
        super();
        this.currentEnd = timeRange.end;

        this.currentText = timeRange.text;
        this.currentFrom = textRange.from;
        this.currentTo = textRange.to;
        this.repeatTime = parseInt(timeRange.repeat || '1');
        this.currentElapsed = timeRange.elapsed;

        this.span = createSpan();
        this.root = ReactDOM.createRoot(this.span);
    }

    eq(widget: InlineTimerWidget): boolean {
        return widget.repeatTime === this.repeatTime && widget.currentEnd === this.currentEnd && widget.currentElapsed === this.currentElapsed;
    }

    updateTime(end: string, elapsed: string, type: 'repeat' | 'restart') {
        this.currentEnd = end;
        this.currentElapsed = elapsed;
        const fromIndex = this.view.state.doc.toString().indexOf(this.currentText);
        const currentLine = this.view.state.doc.lineAt(fromIndex);

        const timeText = currentLine.text.slice(fromIndex - currentLine.from, fromIndex - currentLine.from + this.currentText.length);
        // console.log('timeText', timeText, currentLine.from, currentLine.text);

        this.repeatTime = parseInt(timeText.match(/time(\d*)?:/)?.[1] || '1');
        const beforeLength = this.currentText.length;

        this.currentText = `%% time${type === 'repeat' ? (this.repeatTime ? this.repeatTime + 1 : 2) : (this.repeatTime ? this.repeatTime : 1)}:${end}+${elapsed} %%`;

        this.view.dispatch({
            changes: {
                from: fromIndex !== -1 ? fromIndex : this.textRange.from,
                to: fromIndex !== -1 ? fromIndex + beforeLength : this.textRange.to,
                insert: this.currentText,
            },
            annotations: Transaction.userEvent.of("plugin-update")
        });

    }

    toDOM(): HTMLElement {
        this.root = ReactDOM.createRoot(this.span);
        const line = this.view.state.doc.lineAt(this.currentFrom);
        const text = line.text.replace(/%%\s*?time(\d*)?:(\d{10})(\+(\d{1,4}))?\s*?%%/g, '');
        this.root.render(
            <StrictMode>
                <TimeCircleProgressbar
                    markdownInfo={this.view.state.field(editorInfoField)}
                    plugin={this.plugin}
                    timeInfo={{
                        endTime: this.timeRange.end,
                        elapsedTime: this.timeRange.elapsed,
                        repeat: this.timeRange.repeat || '1',
                    }}
                    textInfo={{
                        text: text
                    }}
                    update={(end, elapsed, type) => {
                        this.updateTime(end, elapsed, type);
                    }}
                />
            </StrictMode>);

        return this.span;
    }

    destroy(dom: HTMLElement) {
        super.destroy(dom);

        this.root?.unmount();
        const intervalRef = dom.find('.cm-inline-pomodoro-timer')?.getAttribute('data-interval-ref');
        if (intervalRef) {
            window.clearInterval(parseInt(intervalRef));
        }
    }
}

export function createInlinePomodoroPlugin(_plugin: InlinePomodoroPlugin) {
    class InlineViewPluginValue implements PluginValue {
        public readonly view: EditorView;
        private readonly match = new MatchDecorator({
            regexp: /%%\s*?time(\d*)?:(\d{10})(\+(\d{1,4}))?\s*?%%/g,
            decorate: (add, from: number, to: number, match: RegExpExecArray, view: EditorView) => {
                // console.log('decorate', view);
                const shouldRender = this.shouldRender(view, from, to);
                if (shouldRender) {
                    add(
                        from,
                        to,
                        Decoration.replace({
                            widget: new InlineTimerWidget(view, _plugin, {
                                text: match[0],
                                end: match[2],
                                elapsed: match[4],
                                repeat: match[1],
                            }, {
                                from,
                                to,
                            }),
                        }),
                    );
                }
            },
        });
        decorations: DecorationSet = Decoration.none;

        constructor(view: EditorView) {
            this.view = view;
            this.updateDecorations(view);
        }

        update(update: ViewUpdate): void {
            this.updateDecorations(update.view, update);
        }

        destroy(): void {
            this.decorations = Decoration.none;
        }

        updateDecorations(view: EditorView, update?: ViewUpdate) {
            // console.log('update decorations', update);
            if (!update || this.decorations.size === 0) {
                this.decorations = this.match.createDeco(view);
            } else {
                // if (update.transactions.find((t) => t.annotation(Transaction.userEvent) === 'plugin-update')) {
                //     return;
                // }
                this.decorations = this.match.updateDeco(update, this.decorations);
            }
        }

        isLivePreview(state: EditorView["state"]): boolean {
            return state.field(editorLivePreviewField);
        }

        shouldRender(view: EditorView, decorationFrom: number, decorationTo: number) {
            const overlap = view.state.selection.ranges.some((r) => {
                if (r.from <= decorationFrom) {
                    return r.to >= decorationFrom;
                } else {
                    return r.from <= decorationTo;
                }
            });
            return !overlap && this.isLivePreview(view.state);
        }
    }

    const InlineViewPluginSpec: PluginSpec<InlineViewPluginValue> = {
        decorations: (plugin) => {
            // Update and return decorations for the CodeMirror view

            return plugin.decorations.update({
                filter: (rangeFrom: number, rangeTo: number, deco: Decoration) => {
                    const widget = (deco.spec as DecoSpec).widget;
                    if (widget && widget.error) {
                        console.log("GOT WIDGET ERROR");
                        return false;
                    }
                    // Check if the range is collapsed (cursor position)
                    return (
                        rangeFrom === rangeTo ||
                        // Check if there are no overlapping selection ranges
                        !plugin.view.state.selection.ranges.filter((selectionRange: { from: number; to: number; }) => {
                            // Determine the start and end positions of the selection range
                            const selectionStart = selectionRange.from;
                            const selectionEnd = selectionRange.to;

                            // Check if the selection range overlaps with the specified range
                            if (selectionStart <= rangeFrom) {
                                return selectionEnd >= rangeFrom; // Overlapping condition
                            } else {
                                return selectionStart <= rangeTo; // Overlapping condition
                            }
                        }).length
                    );
                },
            });
        },
    };

    return ViewPlugin.fromClass(InlineViewPluginValue, InlineViewPluginSpec);
}
